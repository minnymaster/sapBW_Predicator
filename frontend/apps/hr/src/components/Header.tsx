import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/assignments', label: 'Назначения' },
  { to: '/questions', label: 'Банк вопросов' },
  { to: '/materials', label: 'Материалы' },
  { to: '/reports', label: 'Отчёты' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="bg-violet-800 shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-white font-bold text-sm tracking-tight">SAP BW</span>
          <span className="text-violet-400 text-xs hidden sm:block">|</span>
          <span className="text-violet-200 text-xs hidden sm:block">Портал HR</span>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto flex-1 justify-center">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-violet-200 hover:text-white hover:bg-violet-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-violet-400 text-xs hidden lg:block truncate max-w-[160px]">
            {user?.email}
          </span>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="text-xs text-violet-200 hover:text-white border border-violet-600
                       hover:border-violet-400 px-3 py-1.5 rounded-lg transition"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
