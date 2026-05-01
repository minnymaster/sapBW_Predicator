import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import CompetencyHeatmap, { type HeatmapRow } from '../components/test/CompetencyHeatmap';
import { useCompetencies } from '../hooks/useTests';
import type { FinishAttemptResponse, Grade } from '../types/tests';

const GRADE_CONFIG: Record<
  Grade,
  { label: string; description: string; color: string; bg: string; border: string }
> = {
  K1: { label: 'K1', description: 'Junior',    color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  K2: { label: 'K2', description: 'Middle',    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  K3: { label: 'K3', description: 'Senior',    color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  K4: { label: 'K4', description: 'Lead',      color: '#1d4ed8', bg: '#bfdbfe', border: '#60a5fa' },
  K5: { label: 'K5', description: 'Architect', color: '#1e3a8a', bg: '#1d4ed8', border: '#1d4ed8' },
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ResultsPage() {
  useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Result passed via navigation state from finish mutation
  const result = (location.state as { result?: FinishAttemptResponse } | null)?.result;

  const { data: competencies } = useCompetencies();

  const heatmapRows = useMemo<HeatmapRow[]>(() => {
    if (!result?.competencyResults) return [];
    return result.competencyResults.map((cr) => {
      const comp = competencies?.find((c) => c.competencyId === cr.competencyId);
      const scorePercent = cr.maxScore > 0 ? (cr.score / cr.maxScore) * 100 : 0;
      return {
        competencyId: cr.competencyId,
        competencyName: comp?.name ?? cr.competencyId.slice(0, 8) + '…',
        gradeAchieved: cr.gradeAchieved,
        scorePercent,
      };
    });
  }, [result, competencies]);

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-700 font-medium mb-4">
            Результаты не найдены. Возможно, страница была перезагружена.
          </p>
          <button
            onClick={() => navigate('/tests')}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
          >
            К списку тестов
          </button>
        </div>
      </div>
    );
  }

  const grade = result.gradeAchieved ?? 'K1';
  const gc = GRADE_CONFIG[grade];
  const scorePct = result.maxScore > 0 ? (result.totalScore / result.maxScore) * 100 : 0;
  const hasGaps = result.competencyGapsCount > 0;

  const duration = result.finishedAt
    ? (() => {
        // We don't have startedAt in finish response; show finishedAt only
        return new Date(result.finishedAt).toLocaleString('ru-RU', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
      })()
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/tests')}
              className="text-slate-400 hover:text-white text-sm transition"
            >
              ← Тесты
            </button>
            <span className="text-slate-500">|</span>
            <span className="text-white font-semibold text-sm">Результаты аттестации</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-slate-300 hover:text-white border border-slate-600
                       hover:border-slate-400 px-3 py-1.5 rounded-lg transition"
          >
            На главную
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Grade hero ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6"
          style={{ borderColor: gc.border }}>

          {/* Big grade badge */}
          <div
            className="w-28 h-28 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-inner"
            style={{ backgroundColor: gc.bg, border: `2px solid ${gc.border}` }}
          >
            <span className="text-4xl font-black" style={{ color: gc.color }}>{grade}</span>
            <span className="text-xs font-medium mt-0.5" style={{ color: gc.color }}>{gc.description}</span>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-2xl font-bold text-gray-800 mb-1">
              {grade === 'K5' ? 'Отличный результат!' : grade === 'K4' ? 'Хороший результат!' : 'Аттестация завершена'}
            </p>
            <p className="text-gray-500 text-sm">
              Итоговый грейд: <span className="font-semibold" style={{ color: gc.color }}>{grade} — {gc.description}</span>
            </p>
            {hasGaps && (
              <p className="text-sm text-amber-600 mt-1">
                ⚡ Выявлено {result.competencyGapsCount} зон роста — проверьте рекомендации ИИ
              </p>
            )}
            {duration && (
              <p className="text-xs text-gray-400 mt-2">Завершён {duration}</p>
            )}
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Итоговый балл"
            value={`${scorePct.toFixed(1)}%`}
            sub={`${result.totalScore} / ${result.maxScore}`}
          />
          <StatCard
            label="Компетенций оценено"
            value={String(result.competencyResultsCount)}
          />
          <StatCard
            label="Зоны роста"
            value={String(result.competencyGapsCount)}
            sub={hasGaps ? 'Есть рекомендации' : 'Всё на целевом уровне'}
          />
          <StatCard
            label="Статус"
            value={result.status === 'completed' ? 'Зачтено' : result.status}
          />
        </div>

        {/* ── Competency heatmap ──────────────────────────────────────────── */}
        {heatmapRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">
              📊 Разбивка по компетенциям
            </h2>
            <CompetencyHeatmap rows={heatmapRows} />
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/recommendations')}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       rounded-xl text-sm transition"
          >
            🤖 Посмотреть рекомендации
          </button>
          <button
            onClick={() => navigate('/tests')}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold
                       rounded-xl text-sm transition"
          >
            К списку тестов
          </button>
        </div>
      </main>
    </div>
  );
}
