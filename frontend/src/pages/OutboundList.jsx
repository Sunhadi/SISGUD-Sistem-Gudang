import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { outboundApi } from '../api/outbound';
import { itemsApi } from '../api/items';
import { customersApi } from '../api/parties';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { ApiSelect, FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const STATUSES = ['draft', 'allocated', 'picking', 'packing', 'ready_to_ship', 'shipped', 'cancelled'];
const PRIORITIES = [1, 2, 3, 4, 5];

const defaultValues = {
  customer_id: '',
  due_date: '',
  priority: 3,
  note: '',
  items: [{ item_id: '', qty_ordered: 1 }],
};

export function OutboundFormModal({ open, onClose, editing }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: editing
      ? {
          ...editing,
          items: editing.items.map((i) => ({ ...i })),
        }
      : defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const save = useMutation({
    mutationFn: (payload) =>
      editing ? outboundApi.update(editing.id, payload) : outboundApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['outbound'] });
      onClose();
      if (!editing) navigate(`/outbound/${res.data.data.id}`);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const onSubmit = (d) => {
    const payload = {
      customer_id: d.customer_id === '' ? null : Number(d.customer_id),
      due_date: d.due_date || null,
      priority: Number(d.priority) || 3,
      note: d.note || null,
      items: d.items.map((i) => ({
        item_id: Number(i.item_id),
        qty_ordered: Number(i.qty_ordered),
      })),
    };
    save.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Ubah Outbound — ${editing.doc_no}` : 'Outbound Baru (SO)'}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Customer" error={errors.customer_id}>
            <Controller
              name="customer_id"
              control={control}
              rules={{ required: 'Customer wajib dipilih' }}
              render={({ field }) => (
                <ApiSelect
                  queryFn={(p) => customersApi.list(p)}
                  getOptions={(list) => (list || []).map((c) => ({ value: c.id, raw: c }))}
                  labelOf={(c) => `${c.code} — ${c.name}`}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Jatuh Tempo">
            <input type="date" {...register('due_date')} className={inputCls()} />
          </FormField>
          <FormField label="Prioritas" hint="1 = tertinggi">
            <select {...register('priority')} className={inputCls()}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
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
                      <span className="mt-1 block text-xs text-rose-600">
                        {errors.items[idx].item_id.message}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      {...register(`items.${idx}.qty_ordered`, { required: true, min: 1 })}
                      className={inputCls()}
                    />
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
          onClick={() => append({ item_id: '', qty_ordered: 1 })}
          className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + Tambah Item
        </button>
      </form>
    </Modal>
  );
}

export default function OutboundList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customer, setCustomer] = useState('');
  const [priority, setPriority] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const debounced = useDebouncedValue(search, 300);
  const writable = canWrite('outbound', user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ['outbound', page, debounced, status, customer, priority],
    queryFn: () =>
      outboundApi
        .list({
          page,
          limit: 20,
          search: debounced,
          status: status || undefined,
          customer_id: customer || undefined,
          priority: priority || undefined,
        })
        .then((r) => r.data),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', 'for-filter'],
    queryFn: () => customersApi.list({ limit: 100 }).then((r) => r.data.data),
  });

  const columns = [
    {
      key: 'doc_no',
      header: 'Dokumen',
      render: (r) => (
        <Link to={`/outbound/${r.id}`} className="font-medium text-brand hover:underline">
          {r.doc_no}
        </Link>
      ),
    },
    { key: 'customer_name', header: 'Customer', render: (r) => r.customer_name || '-' },
    { key: 'due_date', header: 'Jatuh Tempo', render: (r) => fmtDate(r.due_date) },
    {
      key: 'priority',
      header: 'Prioritas',
      render: (r) => (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            r.priority <= 2
              ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          P{r.priority}
        </span>
      ),
    },
    { key: 'total_items', header: 'Item', render: (r) => fmtNum(r.total_items) },
    { key: 'total_qty', header: 'Qty', render: (r) => fmtNum(r.total_qty) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Outbound"
        subtitle="Pesanan keluar (SO) — alokasi, picking, packing, kirim"
        icon={PageIcons.out}
        actions={
          writable && (
            <button
              onClick={() => setFormOpen(true)}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              + Outbound Baru
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari dokumen / customer…" />
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
          value={customer}
          onChange={(e) => {
            setCustomer(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua customer</option>
          {(customers || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua prioritas</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Prioritas {p}
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

      <OutboundFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={null} />
    </div>
  );
}



