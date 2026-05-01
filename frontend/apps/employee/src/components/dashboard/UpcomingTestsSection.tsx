import { useNavigate } from 'react-router-dom';
import type { UpcomingTest } from '../../types/dashboard';

function formatTimeLimit(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}

function formatDeadline(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function AttemptsBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? (used / max) * 100 : 0;
  const color = pct >= 100 ? 'bg-red-400' : pct >= 66 ? 'bg-amber-400' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">
        {used}/{max} попыт.
      </span>
    </div>
  );
}

interface Props {
  tests: UpcomingTest[];
}

export default function UpcomingTestsSection({ tests }: Props) {
  const navigate = useNavigate();

  if (tests.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        <span className="text-3xl block mb-2">✅</span>
        Нет назначенных тестов
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tests.slice(0, 6).map((test) => {
        const deadline = formatDeadline((test as unknown as { deadline?: string }).deadline ?? null);
        const timeStr = formatTimeLimit(test.time_limit_sec);
        const exhausted = test.used_attempts >= test.max_attempts;

        return (
          <div
            key={test.test_id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2
                       hover:border-blue-300 hover:shadow-md transition group"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-blue-700 transition line-clamp-2">
                {test.title}
              </h4>
              {deadline && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  до {deadline}
                </span>
              )}
            </div>

            {/* Competency */}
            <p className="text-xs text-gray-500">{test.competency_name}</p>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {timeStr && <span>⏱ {timeStr}</span>}
              {exhausted && (
                <span className="text-red-500 font-medium">Попытки исчерпаны</span>
              )}
            </div>

            <AttemptsBar used={test.used_attempts} max={test.max_attempts} />

            <button
              disabled={exhausted}
              onClick={() => navigate(`/tests/${test.test_id}`)}
              className="mt-auto w-full text-center text-sm font-medium py-1.5 rounded-lg transition
                         bg-blue-600 text-white hover:bg-blue-700
                         disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {exhausted ? 'Нет попыток' : 'Начать тест'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function UpcomingTestsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-1.5 bg-gray-200 rounded-full" />
          <div className="h-8 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
