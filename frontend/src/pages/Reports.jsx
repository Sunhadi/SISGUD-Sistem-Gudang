import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import DataTable from '../components/DataTable';
import { FormField, inputCls, PageHeader, PageIcons, SearchInput, StatusBadge } from '../components/ui';
import { downloadBlob, fmtDate, fmtNum } from '../utils/format';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const TABS = [
  { key: 'activity', label: 'Aktivitas Harian' },
  { key: 'aging', label: 'Aging Stok' },
  { key: 'opname', label: 'Akurasi Opname' },
  { key: 'movements', label: 'Mutasi Harian' },
];

export default function Reports() {
  const [tab, setTab] = useState('activity');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('');

  const debounced = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();

  const activity = useQuery({
    queryKey: ['reports', 'activity', dateFrom, dateTo],
    queryFn: () =>
      reportsApi.dailyActivity({ date_from: dateFrom || undefined, date_to: dateTo || undefined }).then((r) => r.data.data),
    enabled: tab === 'activity',
  });

  const aging = useQuery({
    queryKey: ['reports', 'aging'],
    queryFn: () => reportsApi.stockAging().then((r) => r.data.data),
    enabled: tab === 'aging',
  });

  const opname = useQuery({
    queryKey: ['reports', 'opname'],
    queryFn: () => reportsApi.opnameAccuracy().then((r) => r.data.data),
    enabled: tab === 'opname',
  });

  const movements = useQuery({
    queryKey: ['reports', 'movements', page, type, dateFrom, dateTo],
    queryFn: () =>
      reportsApi
        .movements({ page, limit: 20, type: type || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined })
        .then((r) => r.data),
    enabled: tab === 'movements',
  });

  const doExport = useMutation({
    mutationFn: ({ name, params }) => reportsApi.export(name, params).then((r) => r.data),
    onSuccess: (blob, { name }) => {
      downloadBlob(blob, `${name}.xlsx`);
      queryClient.invalidateQueries();
    },
  });

  const filteredAging = (aging.data || []).filter((r) =>
    `${r.sku} ${r.name}`.toLowerCase().includes(debounced.toLowerCase())
  );

  const filteredOpname = (opname.data || []).filter((r) =>
    `${r.doc_no} ${r.created_by_name || ''}`.toLowerCase().includes(debounced.toLowerCase())
  );

  const dateFilters = (
    <div className="flex flex-wrap gap-2">
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => {
          setDateFrom(e.target.value);
          setPage(1);
        }}
        className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        placeholder="Dari"
      />
      <input
        type="date"
        value={dateTo}
        onChange={(e) => {
          setDateTo(e.target.value);
          setPage(1);
        }}
        className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        placeholder="Sampai"
      />
    </div>
  );

  return (
    <div>
      <PageHeader title="Laporan" subtitle="Data operasional gudang" icon={PageIcons.chart} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === 'activity' && (
            <>
              {dateFilters}
              <button
                onClick={() =>
                  doExport.mutate({
                    name: 'daily-activity',
                    params: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
                  })
                }
                disabled={doExport.isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                Export Excel
              </button>
            </>
          )}
          {tab === 'aging' && (
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Cari SKU / nama…" />
              <button
                onClick={() => doExport.mutate({ name: 'stock-aging', params: {} })}
                disabled={doExport.isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export Excel
              </button>
            </>
          )}
          {tab === 'opname' && (
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Cari dokumen…" />
              <button
                onClick={() => doExport.mutate({ name: 'opname-accuracy', params: {} })}
                disabled={doExport.isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export Excel
              </button>
            </>
          )}
          {tab === 'movements' && (
            <>
              <FormField label="">
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls()}
                >
                  <option value="">Semua tipe</option>
                  {['inbound', 'outbound', 'transfer', 'putaway', 'adjustment', 'opname', 'reject'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FormField>
              {dateFilters}
              <button
                onClick={() =>
                  doExport.mutate({
                    name: 'movements',
                    params: { type: type || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined },
                  })
                }
                disabled={doExport.isPending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aktivitas harian */}
      {tab === 'activity' && (
        <DataTable
          columns={[
            { key: 'date', header: 'Tanggal', render: (r) => fmtDate(r.date) },
            { key: 'total_movements', header: 'Total Mutasi', render: (r) => fmtNum(r.total_movements) },
            { key: 'qty_in', header: 'Qty Masuk', render: (r) => <span className="text-emerald-600">{fmtNum(r.qty_in)}</span> },
            { key: 'qty_out', header: 'Qty Keluar', render: (r) => <span className="text-amber-600">{fmtNum(r.qty_out)}</span> },
            { key: 'active_users', header: 'User Aktif', render: (r) => fmtNum(r.active_users) },
          ]}
          data={activity.data || []}
          loading={activity.isLoading}
          empty="Belum ada aktivitas pada rentang tanggal ini"
        />
      )}

      {/* Aging stok */}
      {tab === 'aging' && (
        <DataTable
          columns={[
            { key: 'sku', header: 'SKU', render: (r) => <span className="font-medium text-slate-800">{r.sku}</span> },
            { key: 'name', header: 'Nama' },
            { key: 'location_code', header: 'Lokasi' },
            { key: 'batch_no', header: 'Batch', render: (r) => r.batch_no || '-' },
            { key: 'qty', header: 'Qty', render: (r) => fmtNum(r.qty) },
            { key: 'received_at', header: 'Diterima', render: (r) => fmtDate(r.received_at) },
            { key: 'age_days', header: 'Usia (hari)', render: (r) => fmtNum(r.age_days) },
            {
              key: 'age_bucket',
              header: 'Kategori',
              render: (r) => <StatusBadge value={r.age_bucket} />,
            },
          ]}
          data={filteredAging}
          loading={aging.isLoading}
          empty="Belum ada stok"
        />
      )}

      {/* Akurasi opname */}
      {tab === 'opname' && (
        <DataTable
          columns={[
            { key: 'doc_no', header: 'Dokumen', render: (r) => <span className="font-medium text-slate-800">{r.doc_no}</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            { key: 'created_at', header: 'Dibuat', render: (r) => fmtDate(r.created_at) },
            { key: 'total_items', header: 'Item', render: (r) => fmtNum(r.total_items) },
            { key: 'counted_items', header: 'Dihitung', render: (r) => fmtNum(r.counted_items) },
            { key: 'diff_items', header: 'Selisih', render: (r) => (r.diff_items > 0 ? <span className="font-medium text-amber-600">{fmtNum(r.diff_items)}</span> : <span className="text-emerald-600">0</span>) },
            { key: 'total_diff_qty', header: 'Total Selisih Qty', render: (r) => (r.total_diff_qty > 0 ? <span className="font-medium text-rose-600">{fmtNum(r.total_diff_qty)}</span> : <span className="text-slate-400">0</span>) },
          ]}
          data={filteredOpname}
          loading={opname.isLoading}
          empty="Belum ada sesi opname"
        />
      )}

      {/* Mutasi harian */}
      {tab === 'movements' && (
        <DataTable
          columns={[
            { key: 'date', header: 'Tanggal', render: (r) => fmtDate(r.date) },
            { key: 'type', header: 'Tipe', render: (r) => <StatusBadge value={r.type} /> },
            { key: 'total_qty', header: 'Total Qty', render: (r) => fmtNum(r.total_qty) },
            { key: 'count', header: 'Jumlah Transaksi', render: (r) => fmtNum(r.count) },
          ]}
          data={movements.data?.data || []}
          meta={movements.data?.meta}
          page={page}
          onPage={setPage}
          loading={movements.isLoading}
        />
      )}
    </div>
  );
}



