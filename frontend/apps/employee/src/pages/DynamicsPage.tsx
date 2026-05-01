import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyAttempts, useSixMonthTrend, scoreToGrade } from '../hooks/useDashboard';
import { useCompetencies } from '../hooks/useTests';
import CompetencyCalendarHeatmap, { type CompetencyRow } from '../components/dynamics/CompetencyCalendarHeatmap';
import CompetencyTrendChart from '../components/dashboard/CompetencyTrendChart';
import type { Grade } from '../types/dashboard';

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: color ?? '#1e293b' }}>
        {value}
      </p>
    </div>
  );
}

const GRADE_COLOR_TEXT: Record<Grade, string> = {
  K1: '#64748b',
  K2: '#3b82f6',
  K3: '#2563eb',
  K4: '#1d4ed8',
  K5: '#1e3a8a',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DynamicsPage() {
  const navigate = useNavigate();

  const attempts = useMyAttempts();
  const competenciesQuery = useCompetencies();
  const trendData = useSixMonthTrend(attempts.data);

  // Build heatmap rows: one row per competency, one column per month
  const heatmapRows = useMemo<CompetencyRow[]>(() => {
    const months = trendData.map((p) => p.month);

    // If we have competencies from API, use them; otherwise derive from trend data
    const competencyNames: { id: string; name: string; area: string }[] =
      competenciesQuery.data
        ? competenciesQuery.data.map((c) => ({
            id: c.competencyId,
            name: c.name,
            area: c.area,
          }))
        : Array.from(
            new Set(trendData.flatMap((p) => Object.keys(p).filter((k) => k !== 'month'))),
          ).map((name) => ({ id: name, name, area: '' }));

    return competencyNames.map(({ id, name, area }) => ({
      competencyId: id,
      name,
      area,
      months: months.map((label, mi) => {
        const raw = trendData[mi][name];
        const score = typeof raw === 'number' ? raw : null;
        return {
          label,
          score,
          grade: score !== null ? scoreToGrade(score) : null,
        };
      }),
    }));
  }, [trendData, competenciesQuery.data]);

  // Summary stats
  const stats = useMemo(() => {
    const completed = (attempts.data ?? []).filter((a) => a.status === 'completed');
    if (completed.length === 0) return null;

    const grades = completed.map((a) => a.gradeAchieved).filter((g): g is Grade => g !== null);
    const gradeOrder: Record<Grade, number> = { K1: 1, K2: 2, K3: 3, K4: 4, K5: 5 };
    const best = grades.reduce<Grade | null>((acc, g) => {
      if (!acc) return g;
      return gradeOrder[g] > gradeOrder[acc] ? g : acc;
    }, null);

    // Latest month with data
    const lastPoint = [...trendData].reverse().find((p) =>
      Object.keys(p).some((k) => k !== 'month'),
    );
    const latestScores = lastPoint
      ? Object.entries(lastPoint)
          .filter(([k]) => k !== 'month')
          .map(([, v]) => v as number)
      : [];
    const avgLatest =
      latestScores.length > 0
        ? Math.round(latestScores.reduce((a, b) => a + b, 0) / latestScores.length)
        : null;

    return { total: completed.length, best, avgLatest };
  }, [attempts.data, trendData]);

  const isLoading = attempts.isLoading || competenciesQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white text-sm transition"
          >
            ← Главная
          </button>
          <span className="text-slate-500">|</span>
          <span className="text-white font-semibold text-sm">📈 Динамика компетенций</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Динамика компетенций</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Прогресс по уровням K1–K5 за последние 6 месяцев
          </p>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <StatBadge label="Аттестаций пройдено" value={String(stats.total)} />
            {stats.best && (
              <StatBadge
                label="Лучший грейд"
                value={stats.best}
                color={GRADE_COLOR_TEXT[stats.best]}
              />
            )}
            {stats.avgLatest !== null && (
              <StatBadge
                label="Средний балл (месяц)"
                value={`${stats.avgLatest}%`}
                color={GRADE_COLOR_TEXT[scoreToGrade(stats.avgLatest)]}
              />
            )}
          </div>
        )}

        {/* Error banners */}
        {(attempts.isError || competenciesQuery.isError) && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ⚠️ Не удалось загрузить данные.{' '}
            <button
              onClick={() => { attempts.refetch(); competenciesQuery.refetch(); }}
              className="underline"
            >
              Повторить
            </button>
          </div>
        )}

        {/* ── Calendar heatmap ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            Тепловая карта K1–K5 по периодам
          </h2>
          <CompetencyCalendarHeatmap rows={heatmapRows} loading={isLoading} />
        </div>

        {/* ── Line trend chart ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            График динамики баллов (%)
          </h2>
          {isLoading ? (
            <div className="h-52 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <CompetencyTrendChart data={trendData} />
          )}
        </div>

        {/* Legend note */}
        <p className="text-xs text-center text-gray-400 pb-2">
          Данные рассчитываются на основе завершённых аттестаций · обновляются в реальном времени
        </p>
      </main>
    </div>
  );
}
