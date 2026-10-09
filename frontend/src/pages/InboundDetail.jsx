import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { inboundApi } from '../api/inbound';
import { locationsApi } from '../api/locations';
import Timeline from '../components/Timeline';
import ConfirmDialog from '../components/Modal';
import Modal from '../components/Modal';
import ProgressFlow from '../components/ProgressFlow';
import { ApiSelect, FormField, inputCls, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';

const ACT_FLOW = [
  ['draft', 'Penerimaan'],
  ['receiving', 'Penerimaan'],
  ['qc', 'Quality Control'],
  ['putaway', 'Putaway'],
  ['completed', 'Selesai'],
  ['cancelled', 'Batal'],
];

export default function InboundDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('items');
  const [action, setAction] = useState(null); // receive | qc | putaway | cancel
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inbound', id],
    queryFn: () => inboundApi.get(id).then((r) => r.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations', 'storage'],
    queryFn: () => locationsApi.list({ limit: 100, type: 'storage' }).then((r) => r.data.data),
    enabled: action === 'putaway',
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inbound'] });

  const receive = useMutation({
    mutationFn: (items) => inboundApi.receive(id, { items }),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const qc = useMutation({
    mutationFn: (items) => inboundApi.qc(id, { items }),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const putaway = useMutation({
    mutationFn: (payload) => inboundApi.putaway(id, payload),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const cancel = useMutation({
    mutationFn: () => inboundApi.cancel(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  if (isError) return <p className="py-10 text-center text-slate-500">Inbound tidak ditemukan.</p>;

  const status = data?.status;
  const writable = canWrite('inbound', user?.role);
  const canReceive = writable && ['draft', 'open', 'receiving'].includes(status);
  const canQc = writable && ['receiving', 'qc'].includes(status);
  const canPutaway = writable && ['qc', 'putaway'].includes(status);
  const canCancel = writable && !['completed', 'cancelled'].includes(status);

  // Sisa qty yang belum diterima
  const remainingReceive = (line) => (line.qty_expected || 0) - (line.qty_received || 0);
  // Sisa qty yang belum di-putaway (dari qty accepted)
  const remainingPutaway = (line) => (line.qty_accepted || 0) - (line.qty_putaway || 0);
  const putawayCandidates = (data?.items || []).filter((l) => remainingPutaway(l) > 0);

  return (
    <div>
      <div className="mb-6">
        <Link to="/inbound" className="mb-2 inline-block text-sm text-brand hover:underline">
          ← Kembali ke daftar
        </Link>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Memuat…</p>
        ) : data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-slate-800">{data.doc_no}</h1>
                  <StatusBadge value={data.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {data.supplier_name || 'Supplier tidak diketahui'}
                  {data.expected_at ? ` · estimasi ${fmtDate(data.expected_at)}` : ''}
                </p>
                {data.note && <p className="mt-1 text-sm text-slate-400">{data.note}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {canReceive && (
                  <button
                    onClick={() => setAction('receive')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Proses Receiving
                  </button>
                )}
                {canQc && (
                  <button
                    onClick={() => setAction('qc')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Quality Control
                  </button>
                )}
                {canPutaway && putawayCandidates.length > 0 && (
                  <button
                    onClick={() => setAction('putaway')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Putaway
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => setAction('cancel')}
                    className="rounded-md border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-50 active:scale-[0.98]"
                  >
                    Batalkan
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <ProgressFlow steps={ACT_FLOW} status={status} />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="mb-4 inline-flex gap-1 rounded-md bg-slate-100 p-1">
        <button
          onClick={() => setTab('items')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            tab === 'items' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Item ({data?.items?.length || 0})
        </button>
        <button
          onClick={() => setTab('timeline')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            tab === 'timeline' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Timeline
        </button>
      </div>

      {tab === 'items' && (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3 text-right">Ekspektasi</th>
                <th className="px-4 py-3 text-right">Diterima</th>
                <th className="px-4 py-3 text-right">QC Lolos</th>
                <th className="px-4 py-3 text-right">Hold</th>
                <th className="px-4 py-3 text-right">Reject</th>
                <th className="px-4 py-3 text-right">Putaway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.items || []).map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{it.item_name}</div>
                    <div className="text-xs text-slate-400">
                      {it.sku} · {it.uom}
                    </div>
                  </td>
                  <td className="px-4 py-3">{it.batch_no || '-'}</td>
                  <td className="px-4 py-3">{it.expiry_date ? fmtDate(it.expiry_date) : '-'}</td>
                  <td className="px-4 py-3 text-right">{fmtNum(it.qty_expected)}</td>
                  <td className="px-4 py-3 text-right">{fmtNum(it.qty_received)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{fmtNum(it.qty_accepted)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{fmtNum(it.qty_hold)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{fmtNum(it.qty_rejected)}</td>
                  <td className="px-4 py-3 text-right">{fmtNum(it.qty_putaway)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <TimelineWithData id={id} />
        </div>
      )}

      {/* Modal Receiving */}
      {action === 'receive' && data && (
        <ReceiveModal
          items={data.items}
          onClose={() => setAction(null)}
          onSubmit={(items) => receive.mutate(items)}
          pending={receive.isPending}
        />
      )}

      {/* Modal QC */}
      {action === 'qc' && data && (
        <QcModal
          items={data.items.filter((l) => (l.qty_received || 0) > 0)}
          onClose={() => setAction(null)}
          onSubmit={(items) => qc.mutate(items)}
          pending={qc.isPending}
        />
      )}

      {/* Modal Putaway */}
      {action === 'putaway' && data && (
        <PutawayModal
          candidates={putawayCandidates}
          locations={locations || []}
          onClose={() => setAction(null)}
          onSubmit={(payload) => putaway.mutate(payload)}
          pending={putaway.isPending}
        />
      )}

      <ConfirmDialog
        open={action === 'cancel'}
        title="Batalkan Inbound"
        message="Yakin membatalkan inbound order ini? Tindakan tidak bisa dibatalkan."
        danger
        onCancel={() => setAction(null)}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );
}

function TimelineWithData({ id }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['inbound', id, 'timeline', page],
    queryFn: () => inboundApi.timeline(id, { page, limit: 20 }).then((r) => r.data),
  });
  return (
    <div>
      <Timeline events={data?.data || []} loading={isLoading} />
      {data?.meta?.total_pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            disabled={page >= data.meta.total_pages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiveModal({ items, onClose, onSubmit, pending }) {
  const [qty, setQty] = useState(() =>
    Object.fromEntries(items.map((i) => [i.item_id, remainingReceive(i)]))
  );

  const submit = () => {
    const payload = items
      .map((i) => ({ item_id: i.item_id, qty_received: Number(qty[i.item_id]) || 0 }))
      .filter((p) => p.qty_received > 0);
    if (!payload.length) return;
    onSubmit(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Receiving — Masukkan Qty Diterima"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : 'Simpan Receiving'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {items.map((i) => {
          const sisa = remainingReceive(i);
          return (
            <div key={i.item_id} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">{i.item_name}</div>
                <div className="text-xs text-slate-400">
                  {i.sku} · sisa {fmtNum(sisa)} {i.uom}
                  {i.batch_no ? ` · batch ${i.batch_no}` : ''}
                </div>
              </div>
              <input
                type="number"
                min={0}
                max={sisa}
                value={qty[i.item_id] ?? 0}
                onChange={(e) => setQty((q) => ({ ...q, [i.item_id]: Math.min(Number(e.target.value) || 0, sisa) }))}
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right"
              />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function QcModal({ items, onClose, onSubmit, pending }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(
      items.map((i) => [i.item_id, { qty_accepted: i.qty_received, qty_hold: 0, qty_rejected: 0, reject_reason: '' }])
    )
  );

  const set = (itemId, patch) => setVals((v) => ({ ...v, [itemId]: { ...v[itemId], ...patch } }));

  const submit = () => {
    const payload = items.map((i) => {
      const v = vals[i.item_id];
      return {
        item_id: i.item_id,
        qty_accepted: Number(v.qty_accepted) || 0,
        qty_hold: Number(v.qty_hold) || 0,
        qty_rejected: Number(v.qty_rejected) || 0,
        reject_reason: v.reject_reason || null,
      };
    });
    onSubmit(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Quality Control"
      wide
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : 'Simpan QC'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Jumlah <strong>lolos + hold + reject</strong> harus sama dengan qty diterima per item.
      </p>
      <div className="space-y-4">
        {items.map((i) => {
          const v = vals[i.item_id];
          const total = (Number(v.qty_accepted) || 0) + (Number(v.qty_hold) || 0) + (Number(v.qty_rejected) || 0);
          const ok = total === (i.qty_received || 0);
          return (
            <div key={i.item_id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{i.item_name}</div>
                  <div className="text-xs text-slate-400">
                    {i.sku} · diterima {fmtNum(i.qty_received)} {i.uom}
                  </div>
                </div>
                <span className={`text-xs font-medium ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {ok ? '✓ seimbang' : `total ${fmtNum(total)} ≠ ${fmtNum(i.qty_received)}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-emerald-700">Lolos</span>
                  <input
                    type="number"
                    min={0}
                    value={v.qty_accepted}
                    onChange={(e) => set(i.item_id, { qty_accepted: e.target.value })}
                    className={inputCls()}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-amber-700">Hold</span>
                  <input
                    type="number"
                    min={0}
                    value={v.qty_hold}
                    onChange={(e) => set(i.item_id, { qty_hold: e.target.value })}
                    className={inputCls()}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-rose-700">Reject</span>
                  <input
                    type="number"
                    min={0}
                    value={v.qty_rejected}
                    onChange={(e) => set(i.item_id, { qty_rejected: e.target.value })}
                    className={inputCls()}
                  />
                </label>
              </div>
              {Number(v.qty_rejected) > 0 && (
                <input
                  placeholder="Alasan reject (opsional)"
                  value={v.reject_reason}
                  onChange={(e) => set(i.item_id, { reject_reason: e.target.value })}
                  className={`${inputCls()} mt-2`}
                />
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PutawayModal({ candidates, locations, onClose, onSubmit, pending }) {
  const [form, setForm] = useState({
    item_id: candidates[0]?.item_id ?? '',
    location_id: '',
    qty: '',
    batch_no: candidates[0]?.batch_no || '',
  });

  const selected = candidates.find((c) => c.item_id === Number(form.item_id));
  const maxQty = selected ? remainingPutaway(selected) : 0;

  const submit = () => {
    onSubmit({
      item_id: Number(form.item_id),
      location_id: Number(form.location_id),
      qty: Number(form.qty),
      batch_no: form.batch_no || null,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Putaway — Staging → Lokasi Storage"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending || !form.item_id || !form.location_id || !form.qty}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : 'Simpan Putaway'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Item" error={!form.item_id ? { message: 'Wajib dipilih' } : null}>
          <select
            value={form.item_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                item_id: e.target.value,
                qty: '',
                batch_no: candidates.find((c) => c.item_id === Number(e.target.value))?.batch_no || '',
              }))
            }
            className={inputCls()}
          >
            <option value="">Pilih item…</option>
            {candidates.map((c) => (
              <option key={c.item_id} value={c.item_id}>
                {c.item_name} ({c.sku}) — sisa {fmtNum(remainingPutaway(c))}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Lokasi Tujuan (tipe storage)" error={!form.location_id ? { message: 'Wajib dipilih' } : null}>
          <select value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))} className={inputCls()}>
            <option value="">Pilih lokasi…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.zone}
                {l.capacity ? ` (kapasitas ${l.capacity})` : ''}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Qty (maks ${fmtNum(maxQty)})`}>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className={inputCls()}
            />
          </FormField>
          <FormField label="Batch No">
            <input value={form.batch_no} onChange={(e) => setForm((f) => ({ ...f, batch_no: e.target.value }))} className={inputCls()} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

function remainingReceive(line) {
  return (line.qty_expected || 0) - (line.qty_received || 0);
}

function remainingPutaway(line) {
  return (line.qty_accepted || 0) - (line.qty_putaway || 0);
}



