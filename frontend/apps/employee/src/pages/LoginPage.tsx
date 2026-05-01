import { type FormEvent, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { jwtDecode } from 'jwt-decode';
import { manageApi } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import type { LoginRequest, LoginResponse, JwtPayload, UserRole } from '../types/auth';

const ROLE_HOME: Record<UserRole, string | null> = {
  employee: '/dashboard',
  hr: null,
  director: null,
};

const ROLE_LABEL: Record<UserRole, string> = {
  employee: 'Сотрудник',
  hr: 'HR-менеджер',
  director: 'Директор',
};

const PORTAL_HINT: Partial<Record<UserRole, string>> = {
  hr: 'Используйте портал HR-менеджера.',
  director: 'Используйте портал директора.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';

  const mutation = useMutation({
    mutationFn: (dto: LoginRequest) =>
      manageApi.post<LoginResponse>('/v1/auth/login', dto).then((r) => r.data),

    onSuccess: ({ accessToken }) => {
      login(accessToken);

      const payload = jwtDecode<JwtPayload>(accessToken);
      const redirect = ROLE_HOME[payload.role];

      if (redirect) {
        navigate(from === '/login' ? redirect : from, { replace: true });
      } else {
        // Non-employee logged in — show portal hint instead of redirecting
        setRoleError(
          `Вы вошли как ${ROLE_LABEL[payload.role]}. ${PORTAL_HINT[payload.role] ?? ''}`,
        );
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setRoleError(null);
    mutation.mutate({ email, password });
  }

  const errorMessage =
    roleError ??
    (mutation.isError
      ? mutation.error instanceof Error
        ? mutation.error.message
        : 'Неверный email или пароль'
      : null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand-700 px-8 py-6 text-center">
          <h1 className="text-white text-2xl font-bold tracking-tight">SAP BW</h1>
          <p className="text-brand-100 text-sm mt-1">Портал сотрудника</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                         placeholder-gray-400 transition"
              placeholder="ivan.ivanov@company.ru"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                         placeholder-gray-400 transition"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60
                       text-white font-semibold py-2.5 text-sm transition focus:outline-none
                       focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            {mutation.isPending ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 pb-6">
          ВКР НИУ ВШЭ — Пермь, 2026
        </p>
      </div>
    </div>
  );
}
