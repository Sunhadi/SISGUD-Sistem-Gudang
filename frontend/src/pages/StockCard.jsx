import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { inventoryApi } from '../api/inventory';
import { itemsApi } from '../api/items';
import DataTable from '../components/DataTable';
import { ApiSelect, FormField, inputCls, PageHeader, PageIcons, StatusBadge } from '../components/ui';
import { fmtDateTime, fmtNum } from '../utils/format';

const TYPES = ['inbound', 'outbound', 'transfer', 'putaway', 'adjustment', 'opname', 'reject'];

export default function StockCard() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [type, setType] = useState('');

  const { control, watch } = useForm({ defaultValues: { item_id: '' } });
  const itemId = watch('item_id');

  // Respons: { item, data: [...movements], meta }
  const { data: card, isLoading } = useQuery({
    queryKey: ['inventory', 'stock-card', Number(itemId) || 0, page, dateFrom, dateTo],
    queryFn: () =>
      inventoryApi
        .stockCard(itemId, { page, limit: 20, date_from: dateFrom || undefined, date_to: dateTo || undefined })
        .then((r) => r.data),
    enabled: !!itemId,
  });

  const movements = card?.data || [];
  const filtered = movements.filter((m) => !type || m.type === type);
  const info = card?.item;

  const columns = [
    { key: 'created_at', header: 'Waktu', render: (r) => fmtDateTime(r.created_at) },
    { key: 'type', header: 'Tipe', render: (r) => <StatusBadge value={r.type} /> },
    {
      key: 'route',
      header: 'Lokasi',
      render: (r) =>
        r.from_location_code && r.to_location_code
          ? `${r.from_location_code} → ${r.to_location_code}`
          : r.to_location_code
            ? `→ ${r.to_location_code}`
            : r.from_location_code
              ? `${r.from_location_code} →`
              : '-',
    },
    { key: 'qty', header: 'Qty', render: (r) => <span className="font-medium">{fmtNum(r.qty)}</span> },
    { key: 'batch_no', header: 'Batch', render: (r) => r.batch_no || '-' },
    {
      key: 'ref',
      header: 'Referensi',
      render: (r) => (r.ref_type ? `${r.ref_type} #${r.ref_id}` : '-'),
    },
    { key: 'user_name', header: 'User', render: (r) => r.user_name || '-' },
    { key: 'note', header: 'Catatan', render: (r) => r.note || '-' },
  ];

  return (
    <div>
      <PageHeader title="Kartu Stok" subtitle="Riwayat seluruh mutasi suatu barang" icon={PageIcons.card} />

      <div className="mb-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Barang">
            <Controller
              name="item_id"
              control={control}
              render={({ field }) => (
                <ApiSelect
                  queryFn={(p) => itemsApi.list(p)}
                  getOptions={(list) => (list || []).map((i) => ({ value: i.id, raw: i }))}
                  labelOf={(i) => `${i.sku} — ${i.name}`}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setPage(1);
                  }}
                />
              )}
            />
          </FormField>
          <FormField label="Dari Tanggal">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputCls()} />
          </FormField>
          <FormField label="Sampai Tanggal">
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputCls()} />
          </FormField>
          <FormField label="Tipe Mutasi">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls()}>
              <option value="">Semua tipe</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {info && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">SKU</div>
            <div className="font-semibold text-slate-800">{info.sku}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Nama</div>
            <div className="truncate font-semibold text-slate-800">{info.name}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Stok Available</div>
            <div className="font-semibold text-emerald-600">{fmtNum(info.qty_available ?? 0)}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Total Mutasi</div>
            <div className="font-semibold text-slate-800">{fmtNum(card?.meta?.total || 0)}</div>
          </div>
        </div>
      )}

      {/* Tipe difilter di client karena endpoint stock-card tidak menerima filter tipe */}
      <DataTable
        columns={columns}
        data={filtered}
        meta={type ? null : card?.meta}
        page={page}
        onPage={setPage}
        loading={isLoading}
        empty={itemId ? 'Belum ada mutasi untuk barang ini' : 'Pilih barang terlebih dahulu'}
      />
    </div>
  );
}


