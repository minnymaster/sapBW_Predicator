import type { RecommendationItem, RecommendationStatus } from '../../types/dashboard';

const STATUS_LABEL: Record<RecommendationStatus, { label: string; cls: string }> = {
  new: { label: 'Новое', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  in_progress: { label: 'В работе', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  completed: { label: 'Завершено', cls: 'bg-green-50 text-green-600 border-green-200' },
};

const PRIORITY_ICON = ['🥇', '🥈', '🥉'];

interface Props {
  recommendations: RecommendationItem[];
}

export default function RecommendationsPanel({ recommendations }: Props) {
  const top3 = recommendations.slice(0, 3);

  if (top3.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        <span className="text-3xl block mb-2">🤖</span>
        Рекомендации появятся после завершения аттестации
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {top3.map((rec, i) => {
        const badge = STATUS_LABEL[rec.status];
        return (
          <div
            key={rec.recommendationId}
            className="flex gap-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4
                       hover:border-blue-200 hover:shadow-md transition"
          >
            {/* Priority icon */}
            <span className="text-xl flex-shrink-0 pt-0.5">{PRIORITY_ICON[i] ?? `#${i + 1}`}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-gray-800 leading-snug line-clamp-2">
                  {rec.courseTitle}
                </p>
                <span
                  className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>

              <p className="text-xs text-blue-600 mt-0.5">
                {rec.gap.competency.name} · {rec.gap.actualGrade} → {rec.gap.targetGrade}
              </p>

              {rec.explanation && (
                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{rec.explanation}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecommendationsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
