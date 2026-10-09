import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import QRCode from 'qrcode';
import { locationsApi } from '../api/locations';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/Modal';
import { FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const TYPES = ['storage', 'receiving', 'staging', 'reject', 'hold'];
const emptyForm = {
  code: '',
  zone: '',
  rack: '',
  level: '',
  bin: '',
  type: 'storage',
  capacity: '',
  pos_x: '',
  pos_y: '',
  pos_z: '',
};

export default function Locations() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [type, setType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [labelTarget, setLabelTarget] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['locations', page, debounced, zone, type],
    queryFn: () =>
      locationsApi
        .list({ page, limit: 20, search: debounced, zone: zone || undefined, type: type || undefined })
        .then((r) => r.data),
  });

  const { data: allLocations } = useQuery({
    queryKey: ['locations', 'all-for-filter'],
    queryFn: () => locationsApi.list({ limit: 100 }).then((r) => r.data.data),
  });
  const zones = [...new Set((allLocations || []).map((l) => l.zone).filter(Boolean))];

  const save = useMutation({
    mutationFn: (payload) =>
      editing ? locationsApi.update(editing.id, payload) : locationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => locationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDeleting(null);
    },
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
    reset({ ...row, capacity: row.capacity ?? '', pos_x: row.pos_x ?? '', pos_y: row.pos_y ?? '', pos_z: row.pos_z ?? '' });
    setModalOpen(true);
  };

  const openLabel = async (row) => {
    setLabelTarget(row);
    try {
      setQrUrl(
        await QRCode.toDataURL(JSON.stringify({ type: 'location', code: row.code, id: row.id }), {
          width: 256,
          margin: 1,
        })
      );
    } catch {
      setQrUrl('');
    }
  };

  const printLabel = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Label ${labelTarget.code}</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
        <img src="${qrUrl}" alt="QR" style="width:256px;height:256px"/>
        <h2 style="margin-top:12px">${labelTarget.code}</h2>
        <p>${labelTarget.zone}${labelTarget.rack ? ' · ' + labelTarget.rack : ''}</p>
        <script>window.onload=()=>setTimeout(()=>{window.print();},300)</script>
      </body></html>`);
    w.document.close();
  };

  const onSubmit = (d) => {
    const payload = {
      ...d,
      capacity: d.capacity === '' ? null : Number(d.capacity),
      pos_x: d.pos_x === '' ? null : Number(d.pos_x),
      pos_y: d.pos_y === '' ? null : Number(d.pos_y),
      pos_z: d.pos_z === '' ? null : Number(d.pos_z),
    };
    save.mutate(payload);
  };

  const columns = [
    { key: 'code', header: 'Kode', render: (r) => <span className="font-medium text-slate-800">{r.code}</span> },
    { key: 'zone', header: 'Zona' },
    {
      key: 'rack',
      header: 'Rack / Level / Bin',
      render: (r) => [r.rack, r.level, r.bin].filter(Boolean).join(' / ') || '-',
    },
    { key: 'type', header: 'Tipe', render: (r) => <StatusBadge value={r.type} /> },
    { key: 'capacity', header: 'Kapasitas', render: (r) => (r.capacity ?? '-') },
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
            onClick={() => openLabel(r)}
            className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
          >
            Label QR
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
        title="Lokasi"
        subtitle="Rak & bin penyimpanan"
        icon={PageIcons.pin}
        actions={
          <button
            onClick={openCreate}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            + Lokasi Baru
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari kode / zona…" />
        <select
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua zona</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua tipe</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Ubah Lokasi — ${editing.code}` : 'Lokasi Baru'}
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
          <FormField label="Kode" error={errors.code}>
            <input {...register('code', { required: 'Kode wajib diisi' })} className={inputCls(!!errors.code)} placeholder="A-01-01" />
          </FormField>
          <FormField label="Zona" error={errors.zone}>
            <input {...register('zone', { required: 'Zona wajib diisi' })} className={inputCls(!!errors.zone)} placeholder="A" />
          </FormField>
          <FormField label="Rack">
            <input {...register('rack')} className={inputCls()} />
          </FormField>
          <FormField label="Level">
            <input {...register('level')} className={inputCls()} />
          </FormField>
          <FormField label="Bin">
            <input {...register('bin')} className={inputCls()} />
          </FormField>
          <FormField label="Tipe">
            <select {...register('type')} className={inputCls()}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Kapasitas (unit)">
            <input type="number" {...register('capacity')} className={inputCls()} />
          </FormField>
          <div className="flex gap-2 md:col-span-2">
            <FormField label="X" hint="koordinat peta">
              <input type="number" {...register('pos_x')} className={inputCls()} />
            </FormField>
            <FormField label="Y">
              <input type="number" {...register('pos_y')} className={inputCls()} />
            </FormField>
            <FormField label="Z">
              <input type="number" {...register('pos_z')} className={inputCls()} />
            </FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus Lokasi"
        message={`Yakin menghapus lokasi "${deleting?.code}"?`}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
      />

      <Modal
        open={!!labelTarget}
        onClose={() => setLabelTarget(null)}
        title={`Label QR — ${labelTarget?.code || ''}`}
        footer={
          <button
            onClick={printLabel}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Cetak
          </button>
        }
      >
        {qrUrl ? (
          <div className="flex flex-col items-center">
            <img src={qrUrl} alt={`QR ${labelTarget?.code}`} className="h-48 w-48" />
            <p className="mt-3 text-lg font-semibold text-slate-800">{labelTarget?.code}</p>
            <p className="text-sm text-slate-500">
              {labelTarget?.zone}
              {labelTarget?.rack ? ` · ${labelTarget.rack}` : ''}
              {labelTarget?.level ? ` / ${labelTarget.level}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Gagal membuat QR.</p>
        )}
      </Modal>
    </div>
  );
}



