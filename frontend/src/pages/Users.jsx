import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/Modal';
import { FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { ROLE_LABELS } from '../rbac';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const ROLES = ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'];

const emptyForm = { name: '', email: '', password: '', role: 'viewer', is_active: true };

export default function Users() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  const debounced = useDebouncedValue(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debounced, roleFilter],
    queryFn: () =>
      usersApi.list({ page, limit: 20, search: debounced, role: roleFilter || undefined }).then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload) =>
      editing ? usersApi.update(editing.id, payload) : usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleting(null);
    },
    onError: (e) => setError(e.message),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ values: editing ? { ...editing, password: '' } : emptyForm });

  const openCreate = () => {
    setEditing(null);
    setError('');
    reset(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setError('');
    reset({ ...row, password: '' });
    setModalOpen(true);
  };

  const onSubmit = (data) => {
    const payload = { ...data, role: data.role };
    if (!data.password && !editing) return;
    if (!data.password) delete payload.password;
    save.mutate(payload);
  };

  const columns = [
    { key: 'name', header: 'Nama' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => ROLE_LABELS[r.role] || r.role },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => <StatusBadge value={r.is_active ? 'active' : 'inactive'} />,
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
            disabled={r.id === me?.id}
            className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40"
          >
            Nonaktifkan
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pengguna"
        subtitle="Kelola akun & hak akses (admin saja)"
        icon={PageIcons.user}
        actions={
          <button
            onClick={openCreate}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            + Pengguna Baru
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / email…" />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Semua role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

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
        title={editing ? `Ubah Pengguna — ${editing.name}` : 'Pengguna Baru'}
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Nama" error={errors.name}>
            <input {...register('name', { required: 'Nama wajib diisi' })} className={inputCls(!!errors.name)} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <input
              type="email"
              {...register('email', { required: 'Email wajib diisi' })}
              className={inputCls(!!errors.email)}
            />
          </FormField>
          <FormField
            label="Password"
            error={errors.password}
            hint={editing ? 'Kosongkan bila tidak diubah' : undefined}
          >
            <input
              type="password"
              {...register('password', {
                required: editing ? false : 'Password wajib diisi',
                minLength: editing ? undefined : { value: 6, message: 'Password minimal 6 karakter' },
              })}
              className={inputCls(!!errors.password)}
            />
          </FormField>
          <FormField label="Role" error={errors.role}>
            <select {...register('role', { required: true })} className={inputCls(!!errors.role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </FormField>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300" />
              Aktif
            </label>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Nonaktifkan Pengguna"
        message={`Yakin menonaktifkan "${deleting?.name}"? Pengguna tidak bisa login lagi.`}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
      />
    </div>
  );
}



