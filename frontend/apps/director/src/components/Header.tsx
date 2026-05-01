import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../hooks/useDashboard';

const NAV = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/kpi', label: 'Целевые KPI' },
  { to: '/notifications', label: 'Уведомления' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: alerts } = useAlerts();
  const criticalCount = alerts?.critical_count ?? 0;

  return (
    <header className="bg-brand-800 shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-white font-bold text-sm tracking-tight">SAP BW</span>
          <span className="text-brand-400 text-xs hidden sm:block">|</span>
          <span className="text-brand-200 text-xs hidden sm:block">Портал Директора</span>
        </div>

        <nav className="flex items-center gap-1 flex-1 justify-center">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const isBell = item.to === '/notifications';
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition
                  ${active ? 'bg-brand-600 text-white' : 'text-brand-200 hover:text-white hover:bg-brand-700'}`}
              >
                {item.label}
                {isBell && criticalCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px]
                                   font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-brand-400 text-xs hidden lg:block truncate max-w-[160px]">
            {user?.email}
          </span>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="text-xs text-brand-200 hover:text-white border border-brand-600
                       hover:border-brand-400 px-3 py-1.5 rounded-lg transition"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
