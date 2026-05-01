import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function UnauthorizedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Нет доступа</h1>
        <p className="text-gray-500 text-sm mb-6">
          Этот раздел недоступен для вашей роли. Используйте соответствующий портал.
        </p>
        <button
          onClick={handleLogout}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold
                     px-5 py-2 rounded-lg text-sm transition"
        >
          Сменить аккаунт
        </button>
      </div>
    </div>
  );
}
