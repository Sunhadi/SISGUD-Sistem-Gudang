import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { itemsApi } from '../api/items';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/Modal';
import {
  FormField,
  inputCls,
  PageHeader,
  PageIcons,
  SearchInput,
  StatusBadge,
} from '../components/ui';
import { downloadBlob, fileToBase64, fmtNum } from '../utils/format';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const emptyForm = {
  sku: '',
  name: '',
  category: '',
  uom: 'pcs',
  length_cm: '',
  width_cm: '',
  height_cm: '',
  weight_kg: '',
  min_stock: 0,
  barcode: '',
  is_batch: false,
  has_expiry: false,
};

export default function Items() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['items', page, debounced, category, showInactive],
    queryFn: () =>
      itemsApi
        .list({
          page,
          limit: 20,
          search: debounced,
          category: category || undefined,
          is_active: showInactive ? undefined : true,
        })
        .then((r) => r.data),
  });

  // Kategori unik untuk filter (dari halaman pertama, semua data aktif)
  const { data: allItems } = useQuery({
    queryKey: ['items', 'all-for-filter'],
    queryFn: () => itemsApi.list({ limit: 100 }).then((r) => r.data.data),
  });
  const categories = [...new Set((allItems || []).map((i) => i.category).filter(Boolean))];

  const save = useMutation({
    mutationFn: (payload) =>
      editing ? itemsApi.update(editing.id, payload) : itemsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => itemsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setDeleting(null);
    },
    onError: (e) => setError(e.message),
  });

  const doImport = useMutation({
    mutationFn: (file) => fileToBase64(file).then((b64) => itemsApi.import(b64)),
    onSuccess: (res) => {
      setImportMsg(`Import berhasil: ${res.data.data?.inserted ?? res.data.data?.total ?? 'data tersimpan'}`);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e) => setImportMsg(`Import gagal: ${e.message}`),
  });

  const doExport = useMutation({
    mutationFn: () => itemsApi.export().then((r) => r.data),
    onSuccess: (blob) => downloadBlob(blob, 'barang.xlsx'),
    onError: (e) => setError(e.message),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ values: editing ? { ...editing } : emptyForm });

  const openCreate = () => {
    setEditing(null);
    setError('');
    reset(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setError('');
    reset({ ...row, length_cm: row.length_cm ?? '', width_cm: row.width_cm ?? '', height_cm: row.height_cm ?? '', weight_kg: row.weight_kg ?? '' });
    setModalOpen(true);
  };

  const onSubmit = (d) => {
    const payload = {
      ...d,
      length_cm: d.length_cm === '' ? null : Number(d.length_cm),
      width_cm: d.width_cm === '' ? null : Number(d.width_cm),
      height_cm: d.height_cm === '' ? null : Number(d.height_cm),
      weight_kg: d.weight_kg === '' ? null : Number(d.weight_kg),
      min_stock: Number(d.min_stock) || 0,
    };
    save.mutate(payload);
  };

  const columns = [
    { key: 'sku', header: 'SKU', render: (r) => <span className="font-medium text-slate-800">{r.sku}</span> },
    { key: 'name', header: 'Nama' },
    { key: 'category', header: 'Kategori', render: (r) => r.category || '-' },
    { key: 'uom', header: 'Satuan' },
    {
      key: 'qty_available',
      header: 'Stok',
      render: (r) => fmtNum(r.qty_available ?? 0),
    },
    { key: 'min_stock', header: 'Min.', render: (r) => fmtNum(r.min_stock ?? 0) },
    {
      key: 'flags',
      header: 'Flag',
      render: (r) => (
        <div className="flex gap-1">
          {r.is_batch && <StatusBadge value="batch" />}
          {r.has_expiry && <StatusBadge value="expiry" />}
          {!r.is_batch && !r.has_expiry && <span className="text-slate-300">-</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (r) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(r)}
            className="rounded-md bg-brand/5 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10"
          >
            Ubah
          </button>
          <button
            onClick={() => setDeleting(r)}
            className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Barang"
        subtitle="Master data barang (SKU)"
        icon={PageIcons.box}
        actions={
          <>
            <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
              Import Excel
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && doImport.mutate(e.target.files[0])}
              />
            </label>
            <button
              onClick={() => doExport.mutate()}
              disabled={doExport.isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              {doExport.isPending ? 'Mengekspor…' : 'Export Excel'}
            </button>
            <button
              onClick={openCreate}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              + Barang Baru
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari SKU / nama / barcode…" />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand"
          />
          Tampilkan nonaktif
        </label>
      </div>

      {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {importMsg && (
        <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{importMsg}</div>
      )}
      {doImport.isPending && <p className="mb-4 text-sm text-slate-500">Mengimpor…</p>}

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        page={page}
        onPage={setPage}
        loading={isLoading}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Ubah Barang — ${editing.sku}` : 'Barang Baru'}
        wide
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
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
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="SKU" error={errors.sku}>
            <input {...register('sku', { required: 'SKU wajib diisi' })} className={inputCls(!!errors.sku)} placeholder="BRG-001" />
          </FormField>
          <FormField label="Nama" error={errors.name}>
            <input {...register('name', { required: 'Nama wajib diisi' })} className={inputCls(!!errors.name)} />
          </FormField>
          <FormField label="Kategori">
            <input {...register('category')} className={inputCls()} placeholder="Mis. elektronik" />
          </FormField>
          <FormField label="Satuan (UOM)">
            <input {...register('uom')} className={inputCls()} />
          </FormField>
          <FormField label="Panjang (cm)">
            <input type="number" {...register('length_cm')} className={inputCls()} />
          </FormField>
          <FormField label="Lebar (cm)">
            <input type="number" {...register('width_cm')} className={inputCls()} />
          </FormField>
          <FormField label="Tinggi (cm)">
            <input type="number" {...register('height_cm')} className={inputCls()} />
          </FormField>
          <FormField label="Berat (kg)">
            <input type="number" step="0.001" {...register('weight_kg')} className={inputCls()} />
          </FormField>
          <FormField label="Stok Minimum" error={errors.min_stock}>
            <input type="number" {...register('min_stock', { min: 0 })} className={inputCls(!!errors.min_stock)} />
          </FormField>
          <FormField label="Barcode">
            <input {...register('barcode')} className={inputCls()} />
          </FormField>
          <div className="flex gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('is_batch')} className="h-4 w-4 rounded border-slate-300" />
              Kelola batch
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('has_expiry')} className="h-4 w-4 rounded border-slate-300" />
              Memiliki expiry date
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus Barang"
        message={`Yakin menghapus "${deleting?.name}"? Barang menjadi tidak aktif (soft delete).`}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
      />
    </div>
  );
}



