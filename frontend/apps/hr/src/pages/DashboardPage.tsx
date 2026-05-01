import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts';
import { useAssignmentStats, useCompetencyCoverage, useKpiProgress } from '../hooks/useDashboard';
import Header from '../components/Header';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-600 mb-4">{children}</h2>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-3">
      <span>⚠️ Не удалось загрузить данные.</span>
      <button onClick={onRetry} className="underline">Повторить</button>
    </div>
  );
}

// ─── Overdue metric card ──────────────────────────────────────────────────────

function OverdueCard() {
  const { data, isLoading, isError, refetch } = useAssignmentStats();

  if (isLoading) return <Skeleton className="h-36" />;
  if (isError) return <ErrorBanner onRetry={() => refetch()} />;

  const pct = data?.overdue_percent ?? 0;
  const ring =
    pct > 20 ? 'text-red-600' : pct > 10 ? 'text-amber-500' : 'text-green-600';

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>⚠️ Просроченные назначения</SectionTitle>
      <div className="flex items-end gap-4">
        <span className={`text-5xl font-black tabular-nums ${ring}`}>
          {pct.toFixed(1)}%
        </span>
        <div className="text-xs text-gray-500 leading-relaxed mb-1">
          просроченных<br />от активных назначений
        </div>
      </div>
      {data && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-xs text-center">
          <div>
            <p className="font-semibold text-amber-600">{data.by_status.pending}</p>
            <p className="text-gray-400">Ожидают</p>
          </div>
          <div>
            <p className="font-semibold text-blue-600">{data.by_status.in_progress}</p>
            <p className="text-gray-400">В процессе</p>
          </div>
          <div>
            <p className="font-semibold text-red-600">{data.by_status.overdue}</p>
            <p className="text-gray-400">Просрочено</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Top-5 competency gaps bar chart ─────────────────────────────────────────

const GAP_COLORS = ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d'];

interface GapTooltipProps {
  active?: boolean;
  payload?: { payload?: { name: string; k1: number; total: number } }[];
}
function GapTooltip({ active, payload }: GapTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const pct = d.total > 0 ? ((d.k1 / d.total) * 100).toFixed(1) : '0';
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800 mb-1 max-w-[200px] truncate">{d.name}</p>
      <p className="text-red-600">K1: {d.k1} чел. ({pct}%)</p>
      <p className="text-gray-500">Всего: {d.total}</p>
    </div>
  );
}

function TopGapsChart() {
  const { data, isLoading, isError, refetch } = useCompetencyCoverage();

  if (isLoading) return <Skeleton className="h-52" />;
  if (isError) return <ErrorBanner onRetry={() => refetch()} />;
  if (!data?.data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        Данные о компетенциях отсутствуют
      </div>
    );
  }

  const top5 = [...data.data]
    .sort((a, b) => b.k1_count - a.k1_count)
    .slice(0, 5)
    .map((c) => ({
      name: c.competency_name.length > 28 ? c.competency_name.slice(0, 28) + '…' : c.competency_name,
      fullName: c.competency_name,
      k1: c.k1_count,
      total: c.total_count,
    }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 11, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<GapTooltip />} />
        <Bar dataKey="k1" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {top5.map((_, i) => (
            <Cell key={i} fill={GAP_COLORS[i] ?? '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── KPI progress panel ───────────────────────────────────────────────────────

function KpiProgressPanel() {
  const { data, isLoading, isError, refetch } = useKpiProgress();

  if (isLoading) return <Skeleton className="h-48" />;
  if (isError) return <ErrorBanner onRetry={() => refetch()} />;
  if (!data?.data.length) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        Целевые KPI не настроены
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.data.map((kpi) => {
        const actual = Math.min(kpi.actual_percent, 100);
        const target = Math.min(kpi.target_percent, 100);
        const onTrack = kpi.is_on_track;
        return (
          <div key={kpi.kpi_id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-700 font-medium truncate max-w-[55%]" title={kpi.competency_name}>
                {kpi.competency_name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-gray-500">
                  {kpi.met_count}/{kpi.total_employees} · {actual.toFixed(1)}%
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-full font-semibold ${
                    onTrack
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {kpi.target_grade}
                </span>
              </div>
            </div>
            <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
              {/* target line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                style={{ left: `${target}%` }}
              />
              {/* actual bar */}
              <div
                className={`h-full rounded-full transition-all ${
                  onTrack ? 'bg-green-500' : 'bg-red-400'
                }`}
                style={{ width: `${actual}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Цель: {kpi.target_percent}% · период {kpi.period_start}
              {kpi.period_end ? ` – ${kpi.period_end}` : ' – н.в.'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Completion rate donut (simple) ──────────────────────────────────────────

function CompletionRing({ data }: { data: ReturnType<typeof useAssignmentStats>['data'] }) {
  if (!data) return null;
  const { completed, pending, in_progress, overdue } = data.by_status;
  const active = pending + in_progress + overdue;
  const total = data.total;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const circumference = 2 * Math.PI * 38;
  const dash = (completedPct / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width={96} height={96} className="flex-shrink-0">
        <circle cx={48} cy={48} r={38} fill="none" stroke="#f1f5f9" strokeWidth={10} />
        <circle
          cx={48} cy={48} r={38}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={48} textAnchor="middle" dominantBaseline="central"
          fontSize={18} fontWeight={700} fill="#1e293b">
          {completedPct}%
        </text>
      </svg>
      <div className="text-xs space-y-1.5">
        <p className="text-gray-700 font-semibold">Завершено назначений</p>
        <div className="flex gap-3 flex-wrap">
          <span className="text-green-600">{completed} завершено</span>
          <span className="text-amber-500">{active} активных</span>
        </div>
        <p className="text-gray-400">Всего: {total}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const statsQuery = useAssignmentStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Аналитический дашборд</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Обзор назначений, компетентностных пробелов и прогресса KPI
          </p>
        </div>

        {/* Row 1: overdue card + completion ring */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <OverdueCard />
          <Card className="flex flex-col gap-3">
            <SectionTitle>✅ Выполнение назначений</SectionTitle>
            <CompletionRing data={statsQuery.data} />
          </Card>
        </div>

        {/* Row 2: top-5 gaps */}
        <Card>
          <SectionTitle>📉 Топ-5 компетенций с наибольшим числом K1</SectionTitle>
          <p className="text-xs text-gray-400 -mt-2 mb-3">
            Сотрудники с минимальным грейдом — приоритет для развития
          </p>
          <TopGapsChart />
        </Card>

        {/* Row 3: KPI progress */}
        <Card>
          <SectionTitle>🎯 Прогресс KPI по компетенциям</SectionTitle>
          <KpiProgressPanel />
        </Card>

        <p className="text-center text-xs text-gray-400 pb-2">
          ВКР НИУ ВШЭ — Пермь, 2026 · Данные обновляются каждые 2 минуты
        </p>
      </main>
    </div>
  );
}
