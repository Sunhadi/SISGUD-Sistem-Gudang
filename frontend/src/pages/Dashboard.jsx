import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '../api/reports';
import { inventoryApi } from '../api/inventory';
import { inboundApi } from '../api/inbound';
import { outboundApi } from '../api/outbound';
import { fmtDate, fmtNum } from '../utils/format';
import { StatusBadge } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const BRAND = '#1e3a5f';
const SLATE_BAR = '#94a3b8';
const DANGER = '#be123c';
const WARN = '#b45309';
const NEUTRAL = '#1e293b';

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const pctColor = (pct) => (pct >= 90 ? DANGER : pct >= 70 ? '#d97706' : BRAND);

/**
 * Kartu KPI tanpa dekorasi. Angka hanya berwarna kalau `alertColor` diisi
 * dan nilainya lebih dari 0 (artinya ada yang perlu perhatian).
 */
function KpiCard({ label, value, sub, to, alertColor }) {
  const n = Number(value) || 0;
  const color = alertColor && n > 0 ? alertColor : NEUTRAL;
  const inner = (
    <div className="rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight" style={{ color }}>
        {fmtNum(n)}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function MiniTable({ headers, rows, empty, renderRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="transition-colors hover:bg-slate-50">
              {renderRow(r)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          {empty}
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-md border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Loading() {
  return <p className="py-8 text-center text-sm text-slate-400">Memuat…</p>;
}

export default function Dashboard() {
  const [expSearch, setExpSearch] = useState('');
  const debounced = useDebouncedValue(expSearch, 300);
  const todayStr = getTodayStr();

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data.data),
  });
  const throughput = useQuery({
    queryKey: ['dashboard', 'throughput', 14],
    queryFn: () => dashboardApi.throughput(14).then((r) => r.data.data),
  });
  const utilization = useQuery({
    queryKey: ['dashboard', 'utilization'],
    queryFn: () => dashboardApi.utilization().then((r) => r.data.data),
  });
  const lowStock = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.lowStock().then((r) => r.data.data),
  });
  const expiring = useQuery({
    queryKey: ['inventory', 'expiring'],
    queryFn: () => inventoryApi.expiring(30).then((r) => r.data.data),
  });
  const dueToday = useQuery({
    queryKey: ['dashboard', 'due-today', todayStr],
    queryFn: async () => {
      const res = await outboundApi.list({ page: 1, limit: 100 });
      const list = res.data?.data || [];
      return list
        .filter(
          (o) =>
            o.status !== 'shipped' &&
            o.status !== 'cancelled' &&
            o.due_date &&
            o.due_date <= todayStr
        )
        .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
    },
  });
  const pendingInbound = useQuery({
    queryKey: ['dashboard', 'pending-inbound'],
    queryFn: async () => {
      const res = await inboundApi.list({ page: 1, limit: 100 });
      const list = res.data?.data || [];
      return list.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
    },
  });

  const s = summary.data || {};
  const locs = utilization.data || [];
  const totalUsed = locs.reduce((a, l) => a + Number(l.qty_used || 0), 0);
  const totalCap = locs.reduce((a, l) => a + Number(l.capacity || 0), 0);
  const avgPct = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : null;

  // Warna angka hanya muncul kalau nilainya > 0 (ada yang perlu perhatian)
  const kpis = [
    {
      label: 'SO Siap Kirim',
      value: s.ready_to_ship ?? 0,
      sub: 'menunggu pengiriman',
      to: '/outbound?status=ready_to_ship',
    },
    {
      label: 'Order Terlambat',
      value: s.overdue_orders ?? 0,
      sub: 'lewat jatuh tempo',
      to: '/outbound',
      alertColor: DANGER,
    },
    {
      label: 'Stok Di Bawah Minimum',
      value: s.low_stock_count ?? 0,
      sub: 'perlu pengisian',
      to: '/inventory/stocks',
      alertColor: WARN,
    },
    {
      label: 'Inbound Menunggu',
      value: pendingInbound.data ?? 0,
      sub: 'proses belum selesai',
      to: '/inbound',
    },
  ];

  const dueRows = dueToday.data || [];
  const lowRows = lowStock.data || [];

  // Filter dulu baru dipotong 8, supaya pencarian menjangkau semua data
  const keyword = debounced.trim().toLowerCase();
  const expRows = (expiring.data || [])
    .filter((it) => `${it.name ?? ''} ${it.sku ?? ''}`.toLowerCase().includes(keyword))
    .slice(0, 8);

  const topLocs = [...locs]
    .filter((l) => Number(l.qty_used || 0) > 0)
    .sort((a, b) => Number(b.pct_used || 0) - Number(a.pct_used || 0))
    .slice(0, 6);

  return (
    // Judul "Dashboard" dan tanggal sudah ada di topbar Layout, jadi tidak diulang di sini
    <div className="space-y-4">
      {/* KPI: 4 kartu */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Throughput + Utilisasi */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title="Throughput Harian"
          subtitle="Qty barang masuk & keluar, 14 hari terakhir"
        >
          {throughput.isLoading ? (
            <Loading />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={throughput.data || []}
                  margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
                    }
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })
                    }
                    contentStyle={{
                      borderRadius: 4,
                      border: '1px solid #e2e8f0',
                      boxShadow: 'none',
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="qty_in" name="Qty Masuk" fill={BRAND} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="qty_out" name="Qty Keluar" fill={SLATE_BAR} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Utilisasi Gudang" subtitle="Persentase kapasitas terpakai">
          {utilization.isLoading ? (
            <Loading />
          ) : (
            <>
              <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-xs text-slate-500">Rata-rata terpakai</span>
                <span className="ml-2 text-lg font-bold text-slate-800">
                  {avgPct === null ? '-' : `${avgPct}%`}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {fmtNum(totalUsed)} / {fmtNum(totalCap)} unit
                </span>
              </div>
              {topLocs.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                  Belum ada stok tersimpan.
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {topLocs.map((l) => {
                    const pct = Math.min(100, Math.round(Number(l.pct_used || 0)));
                    return (
                      <li key={l.id}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {l.code}
                            <span className="ml-1.5 font-normal text-slate-400">{l.zone}</span>
                          </span>
                          <span className="text-slate-500">
                            {fmtNum(l.qty_used)}/{fmtNum(l.capacity ?? 0)} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-sm bg-slate-100">
                          <div
                            className="h-1.5 rounded-sm"
                            style={{ width: `${pct}%`, backgroundColor: pctColor(pct) }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Section>
      </div>

      {/* Perlu dikerjakan hari ini */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-800">Perlu dikerjakan hari ini</h2>
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Section
            title="SO Harus Kirim"
            subtitle={`${dueRows.length} order jatuh tempo hari ini atau lebih awal`}
            action={
              <Link to="/outbound" className="text-xs font-medium text-slate-500 hover:text-slate-700">
                Lihat semua
              </Link>
            }
          >
            {dueToday.isLoading ? (
              <Loading />
            ) : (
              <MiniTable
                headers={['Dokumen', 'Customer', 'Jatuh Tempo', 'Status']}
                rows={dueRows}
                empty="Tidak ada SO yang harus dikirim hari ini."
                renderRow={(o) => (
                  <>
                    <td className="py-2 pr-3">
                      <Link
                        to={`/outbound/${o.id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {o.doc_no}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{o.customer_name || '-'}</td>
                    <td className="py-2 pr-3 text-slate-600">{fmtDate(o.due_date)}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge value={o.status} />
                    </td>
                  </>
                )}
              />
            )}
          </Section>

          <Section
            title="Stok Di Bawah Minimum"
            subtitle={`${lowRows.length} barang perlu pengisian`}
            action={
              <Link
                to="/inventory/stocks"
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Lihat stok
              </Link>
            }
          >
            {lowStock.isLoading ? (
              <Loading />
            ) : (
              <MiniTable
                headers={['Barang', 'SKU', 'Tersedia', 'Minimum']}
                rows={lowRows}
                empty="Semua stok di atas minimum."
                renderRow={(it) => {
                  const avail = Number(it.qty_available ?? 0);
                  return (
                    <>
                      <td className="py-2 pr-3 font-medium text-slate-800">{it.name}</td>
                      <td className="py-2 pr-3 text-slate-500">{it.sku}</td>
                      {/* Stok 0 merah, sisanya amber. Pakai inline style supaya tidak tertimpa config Tailwind */}
                      <td
                        className="py-2 pr-3 font-semibold"
                        style={{ color: avail <= 0 ? DANGER : WARN }}
                      >
                        {fmtNum(avail)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{fmtNum(it.min_stock ?? 0)}</td>
                    </>
                  );
                }}
              />
            )}
          </Section>
        </div>
      </div>

      {/* Barang mendekati expirasi */}
      <Section
        title="Barang Mendekati Expirasi"
        subtitle="Batch yang expirasi dalam 30 hari ke depan"
        action={
          <input
            type="search"
            value={expSearch}
            onChange={(e) => setExpSearch(e.target.value)}
            placeholder="Cari barang / SKU…"
            className="w-48 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-slate-500 focus:outline-none"
          />
        }
      >
        {expiring.isLoading ? (
          <Loading />
        ) : (
          <MiniTable
            headers={['Barang', 'Batch', 'Lokasi', 'Expirasi', 'Sisa Hari']}
            rows={expRows}
            empty={
              keyword ? 'Tidak ada barang yang cocok dengan pencarian.' : 'Tidak ada barang mendekati expirasi.'
            }
            renderRow={(it) => (
              <>
                <td className="py-2 pr-3 font-medium text-slate-800">{it.name}</td>
                <td className="py-2 pr-3 text-slate-500">{it.batch_no || '-'}</td>
                <td className="py-2 pr-3 text-slate-600">{it.location_code || '-'}</td>
                <td className="py-2 pr-3 text-slate-600">{fmtDate(it.expiry_date)}</td>
                <td className="py-2 pr-3">
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-semibold"
                    style={
                      it.days_left <= 7
                        ? { color: DANGER, backgroundColor: '#fff1f2' }
                        : { color: WARN, backgroundColor: '#fffbeb' }
                    }
                  >
                    {it.days_left}
                  </span>
                </td>
              </>
            )}
          />
        )}
      </Section>
    </div>
  );
}