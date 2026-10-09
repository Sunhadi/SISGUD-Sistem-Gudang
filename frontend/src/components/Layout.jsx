import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PAGE_ROLES, ROLE_LABELS } from '../rbac';

const ALL = ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'];

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'grid', roles: ALL, end: true },
  { to: '/items', label: 'Barang', icon: 'box', roles: ALL },
  { to: '/locations', label: 'Lokasi', icon: 'pin', roles: ALL },
  { to: '/parties', label: 'Supplier & Customer', icon: 'users', roles: ALL },
  { to: '/inbound', label: 'Inbound', icon: 'in', roles: PAGE_ROLES.inbound },
  { to: '/inventory/stocks', label: 'Stok', icon: 'layers', roles: PAGE_ROLES.inventory },
  { to: '/inventory/stock-card', label: 'Kartu Stok', icon: 'card', roles: PAGE_ROLES.inventory },
  { to: '/opname', label: 'Stock Opname', icon: 'clipboard', roles: PAGE_ROLES.opname },
  { to: '/outbound', label: 'Outbound', icon: 'out', roles: PAGE_ROLES.outbound },
  { to: '/reports', label: 'Laporan', icon: 'chart', roles: PAGE_ROLES.reports },
  { to: '/users', label: 'Pengguna', icon: 'user', roles: PAGE_ROLES.users },
];

const PAGE_TITLES = [
  [/^\/$/, 'Dashboard'],
  [/^\/items/, 'Barang'],
  [/^\/locations/, 'Lokasi'],
  [/^\/parties/, 'Supplier & Customer'],
  [/^\/inbound\/.+/, 'Detail Inbound'],
  [/^\/inbound/, 'Inbound'],
  [/^\/inventory\/stocks/, 'Stok'],
  [/^\/inventory\/stock-card/, 'Kartu Stok'],
  [/^\/opname\/.+/, 'Detail Opname'],
  [/^\/opname/, 'Stock Opname'],
  [/^\/outbound\/.+/, 'Detail Outbound'],
  [/^\/outbound/, 'Outbound'],
  [/^\/reports/, 'Laporan'],
  [/^\/users/, 'Pengguna'],
];

function Icon({ name }) {
  const paths = {
    grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    box: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    in: 'M9 12l3 3 6-6m-3-3l6 6-6 6M3 12h6',
    layers: 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3',
    card: 'M9 12h6m-6 4h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
    clipboard: 'M9 12h6m-6 4h6M9 8h6M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
    out: 'M15 12l-3-3m0 0l-3 3m3-3v12M3 12h6',
    chart: 'M3 13.5l4.5-4.5 4.5 4.5 4.5-6 4.5 6M3 19.5h18',
    user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0',
  };
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = NAV.filter((n) => n.roles.includes(user?.role));
  const pageTitle = PAGE_TITLES.find(([re]) => re.test(location.pathname))?.[1] || 'SISGUD';
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-base font-bold text-white">
          S
        </span>
        <div className="leading-tight">
          <span className="block font-semibold text-white">SISGUD</span>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">Sistem Gudang</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 truncate text-sm">
          <div className="font-semibold text-white">{user?.name}</div>
          <div className="mt-0.5 inline-block rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            {ROLE_LABELS[user?.role] || user?.role}
          </div>
        </div>
        <button
          onClick={doLogout}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-md">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-6">
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-800">{pageTitle}</h2>
            <p className="hidden truncate text-[11px] text-slate-400 sm:block">{today}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Online
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}




