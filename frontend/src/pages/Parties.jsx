import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customersApi, suppliersApi } from '../api/parties';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/Modal';
import { FormField, inputCls, PageHeader, PageIcons, SearchInput } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const emptyForm = { code: '', name: '', phone: '', address: '' };

function PartyCrud({ title, subtitle, api, queryKey, canWrite }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, page, debounced],
    queryFn: () => api.list({ page, limit: 20, search: debounced }).then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload) => (editing ? api.update(editing.id, payload) : api.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
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
    reset({ ...row });
    setModalOpen(true);
  };

  const columns = [
    { key: 'code', header: 'Kode', render: (r) => <span className="font-medium text-slate-800">{r.code}</span> },
    { key: 'name', header: 'Nama' },
    { key: 'phone', header: 'Telepon', render: (r) => r.phone || '-' },
    { key: 'address', header: 'Alamat', render: (r) => r.address || '-' },
    ...(canWrite
      ? [
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
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari kode / nama…" />
        {canWrite && (
          <button
            onClick={openCreate}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            + Baru
          </button>
        )}
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
        title={editing ? `Ubah — ${editing.name}` : 'Entri Baru'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit((d) => save.mutate(d))}
              disabled={save.isPending}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {save.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Kode" error={errors.code}>
              <input {...register('code', { required: 'Kode wajib diisi' })} className={inputCls(!!errors.code)} />
            </FormField>
            <FormField label="Nama" error={errors.name}>
              <input {...register('name', { required: 'Nama wajib diisi' })} className={inputCls(!!errors.name)} />
            </FormField>
          </div>
          <FormField label="Telepon">
            <input {...register('phone')} className={inputCls()} />
          </FormField>
          <FormField label="Alamat">
            <textarea {...register('address')} rows={3} className={inputCls()} />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Hapus Data"
        message={`Yakin menghapus "${deleting?.name}"?`}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
      />
    </div>
  );
}

export default function Parties() {
  const [tab, setTab] = useState('suppliers');
  const { user } = useAuth();

  const isSupplier = tab === 'suppliers';
  const canWrite = ['admin', 'supervisor'].includes(user?.role);

  return (
    <div>
      <PageHeader title="Supplier & Customer" subtitle="Data pihak terkait" icon={PageIcons.users} />

      <div className="mb-6 inline-flex gap-1 rounded-md bg-slate-100 p-1">
        <button
          onClick={() => setTab('suppliers')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            isSupplier ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Supplier
        </button>
        <button
          onClick={() => setTab('customers')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            !isSupplier ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Customer
        </button>
      </div>

      {isSupplier ? (
        <PartyCrud
          title="Supplier"
          subtitle="Daftar supplier"
          api={suppliersApi}
          queryKey="suppliers"
          canWrite={canWrite}
        />
      ) : (
        <PartyCrud
          title="Customer"
          subtitle="Daftar customer"
          api={customersApi}
          queryKey="customers"
          canWrite={canWrite}
        />
      )}
    </div>
  );
}



