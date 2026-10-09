import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { opnameApi } from '../api/opname';
import ConfirmDialog from '../components/Modal';
import ProgressFlow from '../components/ProgressFlow';
import { FormField, inputCls, PageHeader, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';

const OPNAME_FLOW = [
  ['draft', 'Draft'],
  ['counting', 'Penghitungan'],
  ['review', 'Review'],
  ['approved', 'Disetujui'],
  ['cancelled', 'Batal'],
];

export default function OpnameDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState({});
  const [action, setAction] = useState(null); // submit | approve | cancel
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['opname', id],
    queryFn: () => opnameApi.get(id).then((r) => r.data.data),
  });

  // Inisialisasi input dari data server
  useEffect(() => {
    if (!data?.items) return;
    setCounts((prev) => {
      const next = { ...prev };
      for (const it of data.items) {
        const key = `${it.item_id}-${it.location_id}`;
        if (!(key in next)) next[key] = it.qty_counted ?? '';
      }
      return next;
    });
  }, [data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['opname'] });

  const saveCount = useMutation({
    mutationFn: (items) => opnameApi.count(id, { items }),
    onSuccess: () => {
      refresh();
      setError('');
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const submit = useMutation({
    mutationFn: () => opnameApi.submit(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  const approve = useMutation({
    mutationFn: () => opnameApi.approve(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => opnameApi.cancel(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  if (isError) return <p className="py-10 text-center text-slate-500">Sesi opname tidak ditemukan.</p>;

  const status = data?.status;
  const canCount = canWrite('opname', user?.role) && ['draft', 'counting'].includes(status);
  const canSubmit = canWrite('opname', user?.role) && status === 'counting';
  const canApprove = ['admin', 'supervisor'].includes(user?.role) && status === 'review';
  const canCancel = canWrite('opname', user?.role) && ['draft', 'counting'].includes(status);

  const key = (it) => `${it.item_id}-${it.location_id}`;
  const allCounted = (data?.items || []).every((it) => counts[key(it)] !== '' && counts[key(it)] !== null && counts[key(it)] !== undefined);
  const dirty = (data?.items || []).some(
    (it) => String(counts[key(it)] ?? '') !== String(it.qty_counted ?? '')
  );

  const doSaveCount = () => {
    const items = (data.items || [])
      .filter((it) => counts[key(it)] !== '' && counts[key(it)] !== undefined)
      .map((it) => ({
        item_id: it.item_id,
        location_id: it.location_id,
        qty_counted: Number(counts[key(it)]),
        note: notes[key(it)] || null,
      }));
    if (items.length) saveCount.mutate(items);
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/opname" className="mb-2 inline-block text-sm text-brand hover:underline">
          ← Kembali ke daftar
        </Link>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Memuat…</p>
        ) : data && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-slate-800">{data.doc_no}</h1>
                <StatusBadge value={data.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Dibuat {data.created_by_name || '-'} · {fmtDate(data.created_at)}
                {data.approved_by_name ? ` · Disetujui ${data.approved_by_name}` : ''}
              </p>
              {data.note && <p className="mt-1 text-sm text-slate-400">{data.note}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canCount && (
                <button
                  onClick={doSaveCount}
                  disabled={saveCount.isPending || !dirty}
                  className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {saveCount.isPending ? 'Menyimpan…' : 'Simpan Hitungan'}
                </button>
              )}
              {canSubmit && (
                <button
                  onClick={() => setAction('submit')}
                  disabled={!allCounted}
                  title={!allCounted ? 'Semua item harus dihitung dulu' : ''}
                  className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  Kirim untuk Review
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => setAction('approve')}
                  className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Approve & Sesuaikan Stok
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setAction('cancel')}
                  className="rounded-md border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-[0.98]"
                >
                  Batalkan Sesi
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {data && (
        <div className="mb-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <ProgressFlow steps={OPNAME_FLOW} status={data.status} />
        </div>
      )}

      {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">Total Item</div>
              <div className="text-lg font-bold text-slate-800">{fmtNum(data.total_items)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">Sudah Dihitung</div>
              <div className="text-lg font-bold text-sky-600">{fmtNum(data.counted_items)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">Item Selisih</div>
              <div className="text-lg font-bold text-amber-600">{fmtNum(data.diff_count)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">Total Selisih (unit)</div>
              <div className="text-lg font-bold text-rose-600">{fmtNum(data.diff_total)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Barang</th>
                  <th className="px-4 py-3">Lokasi</th>
                  <th className="px-4 py-3 text-right">Sistem</th>
                  <th className="px-4 py-3 text-right">Fisik</th>
                  <th className="px-4 py-3 text-right">Selisih</th>
                  <th className="px-4 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.items || []).map((it) => {
                  const k = key(it);
                  const counted = counts[k];
                  const diff =
                    counted === '' || counted === undefined || counted === null
                      ? null
                      : Number(counted) - it.qty_system;
                  return (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{it.item_name}</div>
                        <div className="text-xs text-slate-400">{it.sku}</div>
                      </td>
                      <td className="px-4 py-3">{it.location_code}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(it.qty_system)}</td>
                      <td className="px-4 py-3 text-right">
                        {canCount ? (
                          <input
                            type="number"
                            min={0}
                            value={counted}
                            onChange={(e) => setCounts((c) => ({ ...c, [k]: e.target.value }))}
                            className={`${inputCls()} w-24 text-right ${
                              diff !== null && diff !== 0 ? 'border-amber-400' : ''
                            }`}
                          />
                        ) : (
                          fmtNum(it.qty_counted ?? '-')
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {diff === null ? (
                          <span className="text-slate-300">-</span>
                        ) : diff === 0 ? (
                          <span className="text-emerald-600">0</span>
                        ) : (
                          <span className="font-semibold text-rose-600">
                            {diff > 0 ? '+' : ''}
                            {fmtNum(diff)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canCount ? (
                          <input
                            value={notes[k] || it.note || ''}
                            onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))}
                            placeholder="Catatan selisih…"
                            className={`${inputCls()} w-40`}
                          />
                        ) : (
                          <span className="text-slate-500">{it.note || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={action === 'submit'}
        title="Kirim untuk Review"
        message="Semua item harus sudah dihitung. Setelah dikirim, sesi masuk status review dan menunggu approval supervisor."
        onCancel={() => setAction(null)}
        onConfirm={() => submit.mutate()}
      />
      <ConfirmDialog
        open={action === 'approve'}
        title="Approve Opname"
        message="Stok akan disesuaikan dengan hasil hitungan fisik dan mutasi tercatat otomatis. Tindakan ini menulis ulang stok available."
        onCancel={() => setAction(null)}
        onConfirm={() => approve.mutate()}
      />
      <ConfirmDialog
        open={action === 'cancel'}
        title="Batalkan Sesi"
        message="Yakin membatalkan sesi opname ini?"
        danger
        onCancel={() => setAction(null)}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );
}



