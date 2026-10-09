/* ProgressFlow — stepper horizontal untuk alur kerja (dipakai Inbound & Outbound detail) */

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ProgressFlow({ steps, status }) {
  const current = steps.findIndex(([s]) => s === status);
  const isCancelled = current !== -1 && steps[current][0] === 'cancelled';
  const done = (i) => current !== -1 && i < current;
  const active = (i) => i === current;

  return (
    <ol className="flex items-start">
      {steps.map(([s, label], i) => (
        <li key={s} className={`flex items-start ${i < steps.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center">
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                done(i)
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                  : active(i)
                    ? isCancelled
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/40'
                      : 'bg-brand text-white shadow-sm shadow-brand/20'
                    : 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200'
              }`}
            >
              {done(i) ? <CheckIcon /> : i + 1}
              {active(i) && (
                <span
                  className={`absolute inset-0 animate-ping rounded-full ${
                    isCancelled ? 'bg-rose-500/30' : 'bg-brand/30'
                  }`}
                />
              )}
            </span>
            <span
              className={`mt-2 whitespace-nowrap text-[11px] font-semibold ${
                done(i) || active(i) ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="mx-1.5 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-emerald-500 transition-all duration-500 ${
                  done(i) ? 'w-full' : 'w-0'
                }`}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

