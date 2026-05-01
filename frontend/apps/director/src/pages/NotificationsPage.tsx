import { useQueryClient } from '@tanstack/react-query';
import Header from '../components/Header';
import { useAlerts } from '../hooks/useDashboard';
import type { Alert, AlertSeverity } from '../types/director';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<AlertSeverity, { bg: string; border: string; icon: string; badge: string; text: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '🔴',
    badge: 'bg-red-100 text-red-700',
    text: 'Критично',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: '🟡',
    badge: 'bg-amber-100 text-amber-700',
    text: 'Предупреждение',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: '🔵',
    badge: 'bg-blue-100 text-blue-700',
    text: 'Информация',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  assignments: 'Назначения',
  competency: 'Компетенции',
  kpi: 'KPI',
  other: 'Прочее',
};

function AlertCard({ alert }: { alert: Alert }) {
  const cfg = SEV_CONFIG[alert.severity];
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <span className="text-lg leading-none mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-800">{alert.title}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.text}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {CATEGORY_LABELS[alert.category] ?? alert.category}
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{alert.description}</p>
        {typeof alert.value === 'number' && (
          <p className="text-xs font-semibold text-gray-700 mt-1">Значение: {alert.value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const alerts = useAlerts();
  const qc = useQueryClient();

  const data = alerts.data;

  // Group by category, preserving severity order (critical first)
  const grouped = data
    ? Object.entries(
        data.alerts.reduce<Record<string, Alert[]>>((acc, a) => {
          const key = a.category ?? 'other';
          if (!acc[key]) acc[key] = [];
          acc[key].push(a);
          return acc;
        }, {}),
      ).sort(([a], [b]) => {
        const order = ['assignments', 'competency', 'kpi', 'other'];
        return order.indexOf(a) - order.indexOf(b);
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-screen-md mx-auto px-4 py-6 space-y-6">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Уведомления</h1>
            {data && (
              <p className="text-xs text-gray-500 mt-0.5">
                Сформировано: {new Date(data.generated_at).toLocaleString('ru-RU')}
              </p>
            )}
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['reports', 'alerts'] })}
            disabled={alerts.isFetching}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition"
          >
            {alerts.isFetching ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        {/* Summary badges */}
        {data && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-semibold text-red-600">{data.critical_count}</span>
              <span className="text-gray-500">критических</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-semibold text-amber-600">{data.warning_count}</span>
              <span className="text-gray-500">предупреждений</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="font-semibold text-blue-600">
                {data.alerts.length - data.critical_count - data.warning_count}
              </span>
              <span className="text-gray-500">информационных</span>
            </div>
          </div>
        )}

        {/* Loading / error */}
        {alerts.isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
        {alerts.error && <p className="text-sm text-red-500">Ошибка загрузки уведомлений</p>}

        {/* Empty */}
        {data && data.alerts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm">Критических событий не обнаружено. Всё в норме.</p>
          </div>
        )}

        {/* Grouped alerts */}
        {grouped.map(([category, items]) => (
          <section key={category}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="space-y-2">
              {items
                .slice()
                .sort((a, b) => {
                  const order: AlertSeverity[] = ['critical', 'warning', 'info'];
                  return order.indexOf(a.severity) - order.indexOf(b.severity);
                })
                .map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
            </div>
          </section>
        ))}

      </main>
    </div>
  );
}
