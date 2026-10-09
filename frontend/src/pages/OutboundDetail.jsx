import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { outboundApi } from '../api/outbound';
import Timeline from '../components/Timeline';
import ConfirmDialog from '../components/Modal';
import Modal from '../components/Modal';
import ProgressFlow from '../components/ProgressFlow';
import { FormField, inputCls, StatusBadge } from '../components/ui';
import { fmtDate, fmtNum } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { canWrite } from '../rbac';

const FLOW = [
  ['draft', 'Draft'],
  ['allocated', 'Alokasi'],
  ['picking', 'Picking'],
  ['packing', 'Packing'],
  ['ready_to_ship', 'Siap Kirim'],
  ['shipped', 'Dikirim'],
  ['cancelled', 'Batal'],
];

export default function OutboundDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('items');
  const [action, setAction] = useState(null); // allocate | pick | pack | ship | cancel
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['outbound', id],
    queryFn: () => outboundApi.get(id).then((r) => r.data.data),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['outbound', id, 'picking-tasks'],
    queryFn: () => outboundApi.pickingTasks(id).then((r) => r.data.data),
    enabled: action === 'pick',
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['outbound'] });

  const allocate = useMutation({
    mutationFn: () => outboundApi.allocate(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const pick = useMutation({
    mutationFn: (items) => outboundApi.pick(id, { tasks: items }),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const pack = useMutation({
    mutationFn: (items) => outboundApi.pack(id, { items }),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.errors?.[0]?.message || e.message),
  });

  const ship = useMutation({
    mutationFn: (note) => outboundApi.ship(id, { note: note || undefined }),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => outboundApi.cancel(id),
    onSuccess: () => {
      refresh();
      setAction(null);
    },
    onError: (e) => setError(e.message),
  });

  if (isError) return <p className="py-10 text-center text-slate-500">Outbound tidak ditemukan.</p>;

  const status = data?.status;
  const writable = canWrite('outbound', user?.role);
  const canAllocate = writable && status === 'draft';
  const canPick = writable && ['allocated', 'picking'].includes(status);
  const canPack = writable && ['picking', 'packing'].includes(status);
  const canShip = writable && status === 'ready_to_ship';
  const canCancel = writable && !['shipped', 'cancelled'].includes(status);

  const remainingPack = (line) => (line.qty_picked || 0) - (line.qty_packed || 0);

  return (
    <div>
      <div className="mb-6">
        <Link to="/outbound" className="mb-2 inline-block text-sm text-brand hover:underline">
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
                  {data.customer_name || 'Customer tidak diketahui'}
                  {data.due_date ? ` · jatuh tempo ${fmtDate(data.due_date)}` : ''}
                  {data.priority ? ` · prioritas ${data.priority}` : ''}
                </p>
                {data.note && <p className="mt-1 text-sm text-slate-400">{data.note}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {canAllocate && (
                  <button
                    onClick={() => setAction('allocate')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Alokasi Stok (FIFO/FEFO)
                  </button>
                )}
                {canPick && (
                  <button
                    onClick={() => setAction('pick')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Proses Picking
                  </button>
                )}
                {canPack && (
                  <button
                    onClick={() => setAction('pack')}
                    className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Proses Packing
                  </button>
                )}
                {canShip && (
                  <button
                    onClick={() => setAction('ship')}
                    className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Kirim
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
              <ProgressFlow steps={FLOW} status={status} />
            </div>
          </>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

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
                <th className="px-4 py-3 text-right">Order</th>
                <th className="px-4 py-3 text-right">Dialokasi</th>
                <th className="px-4 py-3 text-right">Dipick</th>
                <th className="px-4 py-3 text-right">Dipack</th>
                <th className="px-4 py-3">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.items || []).map((it) => {
                const pct = it.qty_ordered ? Math.min(100, Math.round(((it.qty_packed || 0) / it.qty_ordered) * 100)) : 0;
                return (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{it.item_name}</div>
                      <div className="text-xs text-slate-400">
                        {it.sku} · {it.uom}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmtNum(it.qty_ordered)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(it.qty_allocated)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(it.qty_picked)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(it.qty_packed)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <TimelineWithData id={id} />
        </div>
      )}

      {/* Modal Picking */}
      {action === 'pick' && (
        <PickModal
          tasks={tasks || []}
          loading={tasksLoading}
          onClose={() => setAction(null)}
          onSubmit={(items) => pick.mutate(items)}
          pending={pick.isPending}
        />
      )}

      {/* Modal Packing */}
      {action === 'pack' && data && (
        <PackModal
          items={data.items.filter((l) => remainingPack(l) > 0)}
          onClose={() => setAction(null)}
          onSubmit={(items) => pack.mutate(items)}
          pending={pack.isPending}
        />
      )}

      {/* Modal Ship */}
      {action === 'ship' && (
        <ShipModal
          onClose={() => setAction(null)}
          onSubmit={(note) => ship.mutate(note)}
          pending={ship.isPending}
        />
      )}

      <ConfirmDialog
        open={action === 'allocate'}
        title="Alokasi Stok"
        message="Sistem akan mengalokasikan stok available (FIFO/FEFO) ke order ini dan membuat tugas picking. Lanjutkan?"
        onCancel={() => setAction(null)}
        onConfirm={() => allocate.mutate()}
      />
      <ConfirmDialog
        open={action === 'cancel'}
        title="Batalkan Outbound"
        message="Stok yang sudah dialokasikan akan dikembalikan. Yakin membatalkan order ini?"
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
    queryKey: ['outbound', id, 'timeline', page],
    queryFn: () => outboundApi.timeline(id, { page, limit: 20 }).then((r) => r.data),
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

function PickModal({ tasks, loading, onClose, onSubmit, pending }) {
  const [qty, setQty] = useState({});

  const submit = () => {
    const payload = tasks
      .map((t) => ({ task_id: t.id, qty_picked: Number(qty[t.id]) || 0 }))
      .filter((p) => p.qty_picked > 0);
    if (!payload.length) return;
    onSubmit(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Picking — Pindai Lokasi & Ambil Barang"
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
            {pending ? 'Memproses…' : 'Simpan Hasil Picking'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Memuat tugas…</p>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Tidak ada tugas picking.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const sisa = t.qty_plan - t.qty_picked;
            const val = qty[t.id] ?? sisa;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{t.item_name}</div>
                  <div className="text-xs text-slate-400">
                    {t.sku} · lokasi <strong className="text-slate-600">{t.location_code}</strong>
                    {t.status === 'done' ? ' · ✓ selesai' : ` · sisa ${fmtNum(sisa)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">rencana {fmtNum(t.qty_plan)}</span>
                  <input
                    type="number"
                    min={0}
                    max={sisa}
                    disabled={t.status === 'done' || sisa <= 0}
                    value={t.status === 'done' ? 0 : val}
                    onChange={(e) =>
                      setQty((q) => ({ ...q, [t.id]: Math.min(Number(e.target.value) || 0, sisa) }))
                    }
                    className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right disabled:bg-slate-100"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function PackModal({ items, onClose, onSubmit, pending }) {
  const [qty, setQty] = useState(() =>
    Object.fromEntries(items.map((i) => [i.item_id, remainingPack(i)]))
  );

  const submit = () => {
    const payload = items
      .map((i) => ({ item_id: i.item_id, qty_packed: Number(qty[i.item_id]) || 0 }))
      .filter((p) => p.qty_packed > 0);
    if (!payload.length) return;
    onSubmit(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Packing — Verifikasi Hasil Picking"
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
            {pending ? 'Memproses…' : 'Simpan Packing'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {items.map((i) => {
          const sisa = remainingPack(i);
          return (
            <div key={i.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">{i.item_name}</div>
                <div className="text-xs text-slate-400">
                  {i.sku} · dipick {fmtNum(i.qty_picked)} · tersisa {fmtNum(sisa)}
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

function ShipModal({ onClose, onSubmit, pending }) {
  const [note, setNote] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title="Kirim Order"
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]">
            Batal
          </button>
          <button
            onClick={() => onSubmit(note)}
            disabled={pending}
            className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? 'Memproses…' : ' Konfirmasi Kirim'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Order berubah ke status <strong>shipped</strong>. Stok reserved akan dikeluarkan sepenuhnya.
      </p>
      <FormField label="Resi / Catatan Pengiriman">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opsional — nomor resi kurir"
          className={inputCls()}
        />
      </FormField>
    </Modal>
  );
}

function remainingPack(line) {
  return (line.qty_picked || 0) - (line.qty_packed || 0);
}



