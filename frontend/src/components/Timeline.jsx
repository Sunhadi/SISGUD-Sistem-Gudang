import { fmtDateTime } from '../utils/format';

export default function Timeline({ events = [], loading }) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-400">Memuat…</p>;
  if (!events.length)
    return (
      <p className="rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
        Belum ada aktivitas.
      </p>
    );

  return (
    <ol className="relative ml-1 border-l-2 border-slate-100">
      {events.map((e) => (
        <li key={e.id} className="mb-5 ml-4">
          <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand shadow-md shadow-black/5" />
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/5 px-2.5 py-0.5 text-xs font-semibold capitalize text-brand">
            {e.stage || e.action || e.event || 'update'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {fmtDateTime(e.created_at)}
            {e.user_name ? ` · ${e.user_name}` : ''}
          </div>
          {e.note && <div className="mt-1 text-sm text-slate-600">{e.note}</div>}
          {e.detail && typeof e.detail === 'object' && (
            <pre className="mt-1 overflow-x-auto rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              {JSON.stringify(e.detail, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}


