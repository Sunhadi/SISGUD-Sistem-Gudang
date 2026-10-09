import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { FormField, inputCls } from '../components/ui';

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (data) => {
    try {
      setError('');
      await login(data);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || 'Login gagal');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-xl font-bold text-white">
            S
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-800">SISGUD</h1>
          <p className="text-xs text-slate-500">Sistem Manajemen Gudang</p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <FormField label="Email" error={errors.email}>
              <input
                type="email"
                autoComplete="email"
                {...register('email', { required: 'Email wajib diisi' })}
                className={inputCls(!!errors.email)}
                placeholder="email@wms.local"
              />
            </FormField>

            <FormField label="Password" error={errors.password}>
              <input
                type="password"
                autoComplete="current-password"
                {...register('password', { required: 'Password wajib diisi' })}
                className={inputCls(!!errors.password)}
                placeholder="••••••••"
              />
            </FormField>

            <button
              disabled={isSubmitting}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-400">Akun demo</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">
              admin@wms.local / admin123
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} SISGUD — Sistem Manajemen Gudang
        </p>
      </div>
    </div>
  );
}
