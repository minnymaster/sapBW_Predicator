import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyRecommendations, useUpdateRecommendationStatus } from '../hooks/useDashboard';
import type { RecommendationItem, RecommendationStatus } from '../types/dashboard';

// ─── Priority configuration ──────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  number,
  { icon: string; label: string; ring: string; bg: string; text: string }
> = {
  1: { icon: '🥇', label: '#1',  ring: 'ring-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  2: { icon: '🥈', label: '#2',  ring: 'ring-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-600' },
  3: { icon: '🥉', label: '#3',  ring: 'ring-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
};
const PRIORITY_DEFAULT = { icon: '📌', label: '', ring: 'ring-blue-300', bg: 'bg-blue-50', text: 'text-blue-600' };

function priorityConfig(p: number) {
  return PRIORITY_CONFIG[p] ?? { ...PRIORITY_DEFAULT, label: `#${p}` };
}

// ─── Status configuration ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RecommendationStatus, { label: string; cls: string }> = {
  new:         { label: 'Новое',     cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  in_progress: { label: 'В работе', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  completed:   { label: 'Завершено',cls: 'bg-green-50 text-green-700 border-green-200' },
};

const FILTER_TABS: { key: 'all' | RecommendationStatus; label: string }[] = [
  { key: 'all',         label: 'Все' },
  { key: 'new',         label: 'Новые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'completed',   label: 'Завершённые' },
];

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  rec: RecommendationItem;
}

function RecommendationCard({ rec }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const updateStatus = useUpdateRecommendationStatus();
  const navigate = useNavigate();

  const pc = priorityConfig(rec.priority);
  const sc = STATUS_CONFIG[rec.status];
  const hasLongExplanation = (rec.explanation?.length ?? 0) > 200;
  const displayText =
    !expanded && hasLongExplanation
      ? `${rec.explanation!.slice(0, 200)}…`
      : (rec.explanation ?? null);

  function handleStart() {
    if (rec.status === 'new') {
      updateStatus.mutate({ id: rec.recommendationId, status: 'in_progress' });
    }
    navigate(`/courses`);
  }

  function handleComplete() {
    updateStatus.mutate({ id: rec.recommendationId, status: 'completed' });
  }

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition
                  hover:shadow-md ${rec.status === 'completed' ? 'opacity-70' : ''}`}
      style={{ borderColor: rec.priority <= 3 ? pc.ring.replace('ring-', '#') : '#e2e8f0' }}
    >
      {/* Top accent strip coloured by priority */}
      <div
        className={`h-1 w-full ${
          rec.priority === 1 ? 'bg-amber-400' :
          rec.priority === 2 ? 'bg-slate-400' :
          rec.priority === 3 ? 'bg-orange-400' : 'bg-blue-400'
        }`}
      />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`text-xl flex-shrink-0`}>{pc.icon}</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 leading-snug line-clamp-2">
                {rec.courseTitle}
              </p>
            </div>
          </div>
          <span className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 ${sc.cls}`}>
            {sc.label}
          </span>
        </div>

        {/* Competency gap */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">{rec.gap.competency.name}</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono font-semibold text-slate-500">{rec.gap.actualGrade}</span>
          <span className="text-gray-400">→</span>
          <span className="font-mono font-semibold text-blue-600">{rec.gap.targetGrade}</span>
        </div>

        {/* Area badge */}
        <span className="self-start text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
          {rec.gap.competency.area}
        </span>

        {/* LLM explanation */}
        {rec.explanation ? (
          <div className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
            <p>{displayText}</p>
            {hasLongExplanation && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 transition"
              >
                {expanded ? '↑ Свернуть' : '↓ Развернуть'}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-3">
            Объяснение генерируется ИИ…
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-gray-400">
            {new Date(rec.createdAt).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
          <div className="flex gap-2">
            {rec.status !== 'completed' && (
              <button
                onClick={handleComplete}
                disabled={updateStatus.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700
                           hover:bg-green-50 disabled:opacity-50 transition"
              >
                ✓ Завершить
              </button>
            )}
            <button
              onClick={handleStart}
              disabled={rec.status === 'completed' || updateStatus.isPending}
              className={`text-xs px-4 py-1.5 rounded-lg font-semibold transition
                ${rec.status === 'completed'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {rec.status === 'completed'
                ? 'Завершено'
                : rec.status === 'in_progress'
                ? '▶ Продолжить'
                : '▶ Начать курс'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-1 bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-7 h-7 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-16 bg-gray-100 rounded" />
        <div className="h-8 bg-gray-100 rounded-lg mt-auto" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | RecommendationStatus;

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const { data: recs, isLoading, isError, refetch } = useMyRecommendations();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const counts: Record<FilterKey, number> = {
    all:         recs?.length ?? 0,
    new:         recs?.filter((r) => r.status === 'new').length ?? 0,
    in_progress: recs?.filter((r) => r.status === 'in_progress').length ?? 0,
    completed:   recs?.filter((r) => r.status === 'completed').length ?? 0,
  };

  const filtered = (recs ?? [])
    .filter((r) => activeFilter === 'all' || r.status === activeFilter)
    .sort((a, b) => a.priority - b.priority);

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
          <span className="text-white font-semibold text-sm">🤖 Рекомендации ИИ</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Персональные рекомендации</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Сгенерированы ИИ на основе результатов аттестаций — приоритеты расставлены по
            размеру разрыва компетенций
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm flex-wrap">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5
                ${activeFilter === key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
              {label}
              {counts[key] > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums
                    ${activeFilter === key ? 'bg-slate-600 text-slate-200' : 'bg-gray-100 text-gray-500'}`}
                >
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error state */}
        {isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-3">
            <span>⚠️ Не удалось загрузить рекомендации.</span>
            <button onClick={() => refetch()} className="underline">Повторить</button>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🤖</div>
            <p className="font-medium text-gray-600">
              {activeFilter === 'all'
                ? 'Рекомендации появятся после завершения первой аттестации'
                : 'Нет рекомендаций в этой категории'}
            </p>
            {activeFilter === 'all' && (
              <button
                onClick={() => navigate('/tests')}
                className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
              >
                Пройти тест
              </button>
            )}
          </div>
        )}

        {/* Cards grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((rec) => (
              <RecommendationCard key={rec.recommendationId} rec={rec} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
