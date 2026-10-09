import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { opnameApi } from '../api/opname';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const STATUSES = ['draft', 'counting', 'review', 'approved', 'cancelled'];

export default function OpnameList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const debounced = useDebouncedValue(search, 300);
  const writable = canWrite('opname', user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ['opname', page, debounced, status],
    queryFn: () =>
      opnameApi.list({ page, limit: 20, search: debounced, status: status || undefined }).then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { note: '' } });

  const create = useMutation({
    mutationFn: (payload) => opnameApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['opname'] });
      setModalOpen(false);
      reset({ note: '' });
      // Langsung ke detail untuk mulai menghitung
      navigate(`/opname/${res.data.data.id}`);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const columns = [
    {
      key: 'doc_no',
      header: 'Dokumen',
      render: (r) => (
        <Link to={`/opname/${r.id}`} className="font-medium text-brand hover:underline">
          {r.doc_no}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'total_items', header: 'Item', render: (r) => fmtNum(r.total_items) },
    {
      key: 'counted_items',
      header: 'Dihitung',
      render: (r) => (
        <span className={r.counted_items < r.total_items ? 'text-amber-600' : 'text-emerald-600'}>
          {fmtNum(r.counted_items)} / {fmtNum(r.total_items)}
        </span>
      ),
    },
    { key: 'created_by_name', header: 'Dibuat', render: (r) => r.created_by_name || '-' },
    { key: 'created_at', header: 'Tanggal', render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Opname"
        subtitle="Sesi penghitungan stok fisik"
        icon={PageIcons.clipboard}
        actions={
          writable && (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              + Sesi Opname Baru
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari dokumen…" />
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
        title="Sesi Opname Baru"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
              Batal
            </button>
            <button
              onClick={handleSubmit((d) => create.mutate({ note: d.note || null }))}
              disabled={create.isPending}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {create.isPending ? 'Membuat…' : 'Buat Sesi'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit((d) => create.mutate({ note: d.note || null }))} className="space-y-4">
          <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">
            Seluruh stok aktif (qty &gt; 0) akan di-snapshot otomatis. Bila ingin cakupan tertentu,
            buat sesi lalu hitung manual.
          </p>
          <FormField label="Catatan">
            <textarea {...register('note')} rows={3} className={inputCls()} placeholder="Mis. Opname bulanan Juli" />
          </FormField>
          {errors.note && <span className="text-xs text-rose-600">{errors.note.message}</span>}
        </form>
      </Modal>
    </div>
  );
}



