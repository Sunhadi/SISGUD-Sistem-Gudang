import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { inventoryApi } from '../api/inventory';
import { itemsApi } from '../api/items';
import { locationsApi } from '../api/locations';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import {
  ApiSelect,
  FormField,
  inputCls,
  PageHeader,
  SearchInput,
  StatusBadge,
} from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const STOCK_STATUSES = ['available', 'reserved', 'hold', 'rejected'];

export default function Stocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [modal, setModal] = useState(null); // transfer | adjustment
  const [error, setError] = useState('');

  const debounced = useDebouncedValue(search, 300);
  const writable = canWrite('inventory', user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'stocks', page, debounced, status, location],
    queryFn: () =>
      inventoryApi
        .stocks({
          page,
          limit: 20,
          search: debounced,
          status: status || undefined,
          location_id: location || undefined,
        })
        .then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', 'for-filter'],
    queryFn: () => locationsApi.list({ limit: 100 }).then((r) => r.data.data),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const transfer = useMutation({
    mutationFn: (payload) => inventoryApi.transfer(payload),
    onSuccess: () => {
      refresh();
      setModal(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const adjustment = useMutation({
    mutationFn: (payload) => inventoryApi.adjustment(payload),
    onSuccess: () => {
      refresh();
      setModal(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const columns = [
    {
      key: 'item',
      header: 'Barang',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-800">{r.name}</div>
          <div className="text-xs text-slate-400">{r.sku}</div>
        </div>
      ),
    },
    { key: 'uom', header: 'Satuan' },
    { key: 'location', header: 'Lokasi', render: (r) => `${r.location_code} (${r.zone})` },
    { key: 'batch_no', header: 'Batch', render: (r) => r.batch_no || '-' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'qty', header: 'Qty', render: (r) => <span className="font-medium">{fmtNum(r.qty)}</span> },
    { key: 'received_at', header: 'Diterima', render: (r) => fmtDate(r.received_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Stok"
        subtitle="Persediaan per barang, lokasi & batch"
        icon={PageIcons.layers}
        actions={
          writable && (
            <>
              <button
                onClick={() => setModal('transfer')}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Transfer Lokasi
              </button>
              <button
                onClick={() => setModal('adjustment')}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                Adjustment
              </button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari SKU / nama / barcode…" />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua status</option>
          {STOCK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua lokasi</option>
          {(locations || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.zone}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        page={page}
        onPage={setPage}
        loading={isLoading}
      />

      {modal === 'transfer' && (
        <TransferModal
          onClose={() => setModal(null)}
          onSubmit={(p) => transfer.mutate(p)}
          pending={transfer.isPending}
        />
      )}
      {modal === 'adjustment' && (
        <AdjustmentModal
          onClose={() => setModal(null)}
          onSubmit={(p) => adjustment.mutate(p)}
          pending={adjustment.isPending}
        />
      )}
    </div>
  );
}

function TransferModal({ onClose, onSubmit, pending }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ defaultValues: { item_id: '', from_location: '', to_location: '', qty: '', batch_no: '', note: '' } });

  const onSub = (d) =>
    onSubmit({
      item_id: Number(d.item_id),
      from_location: Number(d.from_location),
      to_location: Number(d.to_location),
      qty: Number(d.qty),
      batch_no: d.batch_no || null,
      note: d.note || null,
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer Lokasi"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={handleSubmit(onSub)}
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : 'Proses Transfer'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSub)} className="space-y-4">
        <FormField label="Barang" error={errors.item_id}>
          <Controller
            name="item_id"
            control={control}
            rules={{ required: 'Barang wajib dipilih' }}
            render={({ field }) => (
              <ApiSelect
                queryFn={(p) => itemsApi.list(p)}
                getOptions={(list) => (list || []).map((i) => ({ value: i.id, raw: i }))}
                labelOf={(i) => `${i.sku} — ${i.name}`}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Dari Lokasi" error={errors.from_location}>
            <Controller
              name="from_location"
              control={control}
              rules={{ required: 'Wajib dipilih' }}
              render={({ field }) => (
                <ApiSelect
                  queryFn={(p) => locationsApi.list(p)}
                  getOptions={(list) => (list || []).map((l) => ({ value: l.id, raw: l }))}
                  labelOf={(l) => `${l.code} — ${l.zone}`}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Ke Lokasi" error={errors.to_location}>
            <Controller
              name="to_location"
              control={control}
              rules={{ required: 'Wajib dipilih' }}
              render={({ field }) => (
                <ApiSelect
                  queryFn={(p) => locationsApi.list(p)}
                  getOptions={(list) => (list || []).map((l) => ({ value: l.id, raw: l }))}
                  labelOf={(l) => `${l.code} — ${l.zone}`}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Qty" error={errors.qty}>
            <input type="number" min={1} {...register('qty', { required: 'Qty wajib diisi', min: 1 })} className={inputCls(!!errors.qty)} />
          </FormField>
          <FormField label="Batch No">
            <input {...register('batch_no')} className={inputCls()} placeholder="Opsional" />
          </FormField>
        </div>
        <FormField label="Catatan">
          <input {...register('note')} className={inputCls()} />
        </FormField>
      </form>
    </Modal>
  );
}

function AdjustmentModal({ onClose, onSubmit, pending }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ defaultValues: { item_id: '', location_id: '', qty_new: '', reason: '', batch_no: '' } });

  const onSub = (d) =>
    onSubmit({
      item_id: Number(d.item_id),
      location_id: Number(d.location_id),
      qty_new: Number(d.qty_new),
      reason: d.reason,
      batch_no: d.batch_no || null,
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjustment — Set Ulang Stok"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={handleSubmit(onSub)}
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : 'Simpan Adjustment'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSub)} className="space-y-4">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Adjustment mengganti stok dengan nilai baru dan mencatat mutasi. Gunakan hanya untuk koreksi.
        </p>
        <FormField label="Barang" error={errors.item_id}>
          <Controller
            name="item_id"
            control={control}
            rules={{ required: 'Barang wajib dipilih' }}
            render={({ field }) => (
              <ApiSelect
                queryFn={(p) => itemsApi.list(p)}
                getOptions={(list) => (list || []).map((i) => ({ value: i.id, raw: i }))}
                labelOf={(i) => `${i.sku} — ${i.name}`}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField label="Lokasi" error={errors.location_id}>
          <Controller
            name="location_id"
            control={control}
            rules={{ required: 'Lokasi wajib dipilih' }}
            render={({ field }) => (
              <ApiSelect
                queryFn={(p) => locationsApi.list(p)}
                getOptions={(list) => (list || []).map((l) => ({ value: l.id, raw: l }))}
                labelOf={(l) => `${l.code} — ${l.zone}`}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Qty Baru" error={errors.qty_new}>
            <input type="number" min={0} {...register('qty_new', { required: 'Qty baru wajib diisi', min: 0 })} className={inputCls(!!errors.qty_new)} />
          </FormField>
          <FormField label="Batch No">
            <input {...register('batch_no')} className={inputCls()} placeholder="Opsional" />
          </FormField>
        </div>
        <FormField label="Alasan" error={errors.reason}>
          <textarea {...register('reason', { required: 'Alasan wajib diisi' })} rows={2} className={inputCls(!!errors.reason)} />
        </FormField>
      </form>
    </Modal>
  );
}




