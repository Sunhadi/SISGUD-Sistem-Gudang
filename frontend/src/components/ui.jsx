import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* FormField & input                                                   */
/* ------------------------------------------------------------------ */
export function FormField({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error.message}</span>}
    </label>
  );
}

export function inputCls(hasError) {
  return `w-full rounded-md border px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
      : 'border-slate-300 focus:border-brand focus:ring-brand/20'
  }`;
}

export function btnPrimary({ pending } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:shadow-brand/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50`;
}

export function btnGhost() {
  return `inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50`;
}

/* ------------------------------------------------------------------ */
/* Status badge                                                        */
/* ------------------------------------------------------------------ */
const STATUS_RULES = [
  [/active|available|approved|completed|closed|shipped|success/i, 'green'],
  [/ready|allocated|picked|packed|received|in_progress|counting|submitted|open|partial/i, 'blue'],
  [/pending|draft|waiting|new/i, 'amber'],
  [/hold|expiring|review/i, 'slate'],
  [/reject|cancel|fail|expired/i, 'rose'],
];

const BADGE_STYLES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

export function StatusBadge({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-300">-</span>;
  const str = String(value);
  const [, color] = STATUS_RULES.find(([re]) => re.test(str)) || ['', 'slate'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${BADGE_STYLES[color]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {str.replace(/_/g, ' ')}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Spinner & PageHeader                                                */
/* ------------------------------------------------------------------ */
export function Spinner({ label = 'Memuat…' }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
      <svg className="h-4 w-4 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3.5">
        {icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-white shadow-sm shadow-brand/20">
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ikon halaman untuk PageHeader                                     */
/* ------------------------------------------------------------------ */
const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const PageIcons = {
  box: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25" />
    </svg>
  ),
  pin: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  users: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  in: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M9 12l3 3 6-6m-3-3l6 6-6 6M3 12h6" />
    </svg>
  ),
  out: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M15 12l-3-3m0 0l-3 3m3-3v12M3 12h6" />
    </svg>
  ),
  layers: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  ),
  card: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M9 12h6m-6 4h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  ),
  clipboard: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M9 12h6m-6 4h6M9 8h6M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  ),
  chart: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M3 13.5l4.5-4.5 4.5 4.5 4.5-6 4.5 6M3 19.5h18" />
    </svg>
  ),
  user: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
    </svg>
  ),
  grid: (
    <svg {...svgProps} className="h-6 w-6">
      <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
};

export function SearchInput({ value, onChange, placeholder = 'Cari…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ApiSelect — select dengan pencarian dari API                        */
/* ------------------------------------------------------------------ */
export function ApiSelect({ queryFn, getOptions, labelOf, value, onChange, placeholder = 'Pilih…', disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    queryFn({ search, limit: 20 })
      .then((res) => setOptions(getOptions(res.data?.data || res.data || [])))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [open, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? labelOf(selected.raw) : placeholder}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari…"
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-2 text-sm text-slate-400">Memuat…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">Tidak ditemukan</p>
            ) : (
              options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-brand/5"
                >
                  {labelOf(o.raw)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


