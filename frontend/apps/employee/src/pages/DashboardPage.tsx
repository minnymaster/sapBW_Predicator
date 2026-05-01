import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEmployeeSummary, useMyAttempts, useMyRecommendations, useSixMonthTrend } from '../hooks/useDashboard';
import GradeRadialBar, { GradeRadialBarSkeleton } from '../components/dashboard/GradeRadialBar';
import CompetencyTrendChart, { CompetencyTrendSkeleton } from '../components/dashboard/CompetencyTrendChart';
import UpcomingTestsSection, { UpcomingTestsSkeleton } from '../components/dashboard/UpcomingTestsSection';
import RecommendationsPanel, { RecommendationsSkeleton } from '../components/dashboard/RecommendationsPanel';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3 text-sm text-red-700">
      <span>⚠️</span>
      <span className="flex-1">{message}</span>
      <button onClick={onRetry} className="underline text-red-600 hover:text-red-800 flex-shrink-0">
        Повторить
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const summary = useEmployeeSummary();
  const attempts = useMyAttempts();
  const recommendations = useMyRecommendations();
  const trendData = useSixMonthTrend(attempts.data);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const firstName = user?.email.split('@')[0] ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-800 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm tracking-tight">SAP BW</span>
            <span className="hidden sm:block text-slate-400 text-xs">|</span>
            <span className="hidden sm:block text-slate-300 text-xs">Портал сотрудника</span>
          </div>
          <div className="flex items-center gap-4">
            {summary.data && (
              <span className="text-xs text-slate-300 hidden sm:block">
                Грейд:{' '}
                <span className="font-semibold text-blue-400">{summary.data.overall_grade}</span>
              </span>
            )}
            <span className="text-slate-400 text-xs hidden md:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-300 hover:text-white border border-slate-600
                         hover:border-slate-400 px-3 py-1.5 rounded-lg transition"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Добро пожаловать, {firstName}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Оценка компетенций SAP BW — ваш персональный прогресс
          </p>
        </div>

        {/* ── Row 1: Radial chart + Trend chart ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">

          {/* Radial bar card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <SectionHeading>📊 Компетенции</SectionHeading>
            {summary.isLoading && <GradeRadialBarSkeleton />}
            {summary.isError && (
              <ErrorBanner
                message="Не удалось загрузить профиль компетенций"
                onRetry={() => summary.refetch()}
              />
            )}
            {summary.data && (
              <GradeRadialBar
                competencies={summary.data.competencies}
                overallGrade={summary.data.overall_grade}
                coveragePercent={summary.data.coverage_percent}
              />
            )}
          </div>

          {/* Trend line chart card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <SectionHeading>📈 Динамика за 6 месяцев</SectionHeading>
              <button
                onClick={() => navigate('/dynamics')}
                className="text-xs text-blue-600 hover:text-blue-800 transition"
              >
                Подробнее →
              </button>
            </div>
            {attempts.isLoading && <CompetencyTrendSkeleton />}
            {attempts.isError && (
              <ErrorBanner
                message="Не удалось загрузить историю попыток"
                onRetry={() => attempts.refetch()}
              />
            )}
            {!attempts.isLoading && !attempts.isError && (
              <CompetencyTrendChart data={trendData} />
            )}
          </div>
        </div>

        {/* ── Row 2: Upcoming tests ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>📝 Ближайшие тесты</SectionHeading>
            <button
              onClick={() => navigate('/tests')}
              className="text-xs text-blue-600 hover:text-blue-800 transition"
            >
              Все тесты →
            </button>
          </div>

          {summary.isLoading && <UpcomingTestsSkeleton />}
          {summary.isError && (
            <ErrorBanner
              message="Не удалось загрузить тесты"
              onRetry={() => summary.refetch()}
            />
          )}
          {summary.data && (
            <UpcomingTestsSection tests={summary.data.upcoming_tests} />
          )}
        </div>

        {/* ── Row 3: Recommendations ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>🤖 Рекомендации ИИ</SectionHeading>
            <button
              onClick={() => navigate('/recommendations')}
              className="text-xs text-blue-600 hover:text-blue-800 transition"
            >
              Все рекомендации →
            </button>
          </div>

          {recommendations.isLoading && <RecommendationsSkeleton />}
          {recommendations.isError && (
            <ErrorBanner
              message="Не удалось загрузить рекомендации"
              onRetry={() => recommendations.refetch()}
            />
          )}
          {recommendations.data && (
            <RecommendationsPanel recommendations={recommendations.data} />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-2">
          ВКР НИУ ВШЭ — Пермь, 2026 · Данные кэшируются на 5 минут
        </p>
      </main>
    </div>
  );
}
