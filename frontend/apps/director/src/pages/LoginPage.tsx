import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../contexts/AuthContext';
import { manageApi } from '../lib/axios';
import type { JwtPayload, LoginResponse } from '../types/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await manageApi.post<LoginResponse>('/v1/auth/login', { email, password });
      const payload = jwtDecode<JwtPayload>(data.accessToken);
      if (payload.role !== 'director') {
        setError('Доступ разрешён только для директоров.');
        return;
      }
      login(data.accessToken);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Неверный логин или пароль.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SAP BW</h1>
          <p className="text-sm text-gray-500 mt-1">Портал Директора</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Вход в систему</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="username" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="director@company.ru" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg
                         hover:bg-brand-700 disabled:opacity-50 transition">
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">ВКР НИУ ВШЭ — Пермь, 2026</p>
      </div>
    </div>
  );
}
