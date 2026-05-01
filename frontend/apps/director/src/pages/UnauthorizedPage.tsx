import { useNavigate } from 'react-router-dom';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-5xl">🔒</p>
        <h1 className="text-xl font-bold text-gray-800">Доступ запрещён</h1>
        <p className="text-sm text-gray-500">Эта страница доступна только для директоров.</p>
        <button onClick={() => navigate('/login', { replace: true })}
          className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg
                     hover:bg-brand-700 transition">
          На страницу входа
        </button>
      </div>
    </div>
  );
}
