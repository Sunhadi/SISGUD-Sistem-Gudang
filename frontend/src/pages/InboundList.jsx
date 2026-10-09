import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { inboundApi } from '../api/inbound';
import { itemsApi } from '../api/items';
import { suppliersApi } from '../api/parties';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { ApiSelect, FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const STATUSES = ['draft', 'receiving', 'qc', 'putaway', 'completed', 'cancelled'];

const defaultValues = {
  supplier_id: '',
  expected_at: '',
  note: '',
  items: [{ item_id: '', qty_expected: 1, batch_no: '', expiry_date: '' }],
};

export function InboundFormModal({ open, onClose, editing }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: editing ? { ...editing, items: editing.items.map((i) => ({ ...i })) } : defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const save = useMutation({
    mutationFn: (payload) =>
      editing ? inboundApi.update(editing.id, payload) : inboundApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inbound'] });
      onClose();
      if (!editing) navigate(`/inbound/${res.data.data.id}`);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const onSubmit = (d) => {
    const payload = {
      supplier_id: d.supplier_id === '' ? null : Number(d.supplier_id),
      expected_at: d.expected_at || null,
      note: d.note || null,
      items: d.items.map((i) => ({
        item_id: Number(i.item_id),
        qty_expected: Number(i.qty_expected),
        batch_no: i.batch_no || null,
        expiry_date: i.expiry_date || null,
      })),
    };
    save.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Ubah Inbound — ${editing.doc_no}` : 'Inbound Baru (PO/ASN)'}
      wide
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={save.isPending}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Supplier" error={errors.supplier_id}>
            <Controller
              name="supplier_id"
              control={control}
              rules={{ required: 'Supplier wajib dipilih' }}
              render={({ field }) => (
                <ApiSelect
                  queryFn={(p) => suppliersApi.list(p)}
                  getOptions={(list) => (list || []).map((s) => ({ value: s.id, raw: s }))}
                  labelOf={(s) => `${s.code} — ${s.name}`}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Estimasi Datang" error={errors.expected_at}>
            <input type="date" {...register('expected_at')} className={inputCls(!!errors.expected_at)} />
          </FormField>
          <FormField label="Catatan">
            <input {...register('note')} className={inputCls()} />
          </FormField>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Barang</th>
                <th className="px-3 py-2 w-28">Qty</th>
                <th className="px-3 py-2 w-32">Batch</th>
                <th className="px-3 py-2 w-36">Expiry</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((field, idx) => (
                <tr key={field.id}>
                  <td className="px-3 py-2">
                    <Controller
                      name={`items.${idx}.item_id`}
                      control={control}
                      rules={{ required: 'Wajib dipilih' }}
                      render={({ field: f }) => (
                        <ApiSelect
                          queryFn={(p) => itemsApi.list(p)}
                          getOptions={(list) => (list || []).map((i) => ({ value: i.id, raw: i }))}
                          labelOf={(i) => `${i.sku} — ${i.name}`}
                          value={f.value}
                          onChange={f.onChange}
                          placeholder="Pilih barang…"
                        />
                      )}
                    />
                    {errors.items?.[idx]?.item_id && (
                      <span className="mt-1 block text-xs text-rose-600">{errors.items[idx].item_id.message}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      {...register(`items.${idx}.qty_expected`, { required: true, min: 1 })}
                      className={inputCls()}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input {...register(`items.${idx}.batch_no`)} className={inputCls()} placeholder="Opsional" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" {...register(`items.${idx}.expiry_date`)} className={inputCls()} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      aria-label="Hapus baris"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => append({ item_id: '', qty_expected: 1, batch_no: '', expiry_date: '' })}
          className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + Tambah Item
        </button>
      </form>
    </Modal>
  );
}

export default function InboundList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [supplier, setSupplier] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['inbound', page, debounced, status, supplier],
    queryFn: () =>
      inboundApi
        .list({ page, limit: 20, search: debounced, status: status || undefined, supplier_id: supplier || undefined })
        .then((r) => r.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'for-filter'],
    queryFn: () => suppliersApi.list({ limit: 100 }).then((r) => r.data.data),
  });

  const canWrite = ['admin', 'supervisor', 'operator_inbound'].includes(user?.role);

  const columns = [
    {
      key: 'doc_no',
      header: 'Dokumen',
      render: (r) => (
        <Link to={`/inbound/${r.id}`} className="font-medium text-brand hover:underline">
          {r.doc_no}
        </Link>
      ),
    },
    { key: 'supplier_name', header: 'Supplier', render: (r) => r.supplier_name || '-' },
    { key: 'expected_at', header: 'Estimasi', render: (r) => fmtDate(r.expected_at) },
    { key: 'total_items', header: 'Item', render: (r) => fmtNum(r.total_items) },
    { key: 'total_qty', header: 'Qty', render: (r) => fmtNum(r.total_qty) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'created_at', header: 'Dibuat', render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Inbound"
        subtitle="Pesanan masuk (PO/ASN) — receiving, QC, putaway"
        icon={PageIcons.in}
        actions={
          canWrite && (
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              + Inbound Baru
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari dokumen / supplier…" />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={supplier}
          onChange={(e) => {
            setSupplier(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua supplier</option>
          {(suppliers || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        page={page}
        onPage={setPage}
        loading={isLoading}
      />

      <InboundFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </div>
  );
}



