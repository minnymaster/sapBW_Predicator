import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Header from '../components/Header';
import { useHeatmap, useGradeTrend, useKpiProgress, useAssignmentStats } from '../hooks/useDashboard';
import type { HeatmapCell, KpiProgressItem } from '../types/director';

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

function gradeColor(avg: number): string {
  if (!avg || avg < 1) return '#f3f4f6';
  if (avg < 1.8) return '#fca5a5'; // red-300
  if (avg < 2.6) return '#fcd34d'; // amber-300
  if (avg < 3.4) return '#86efac'; // green-300
  if (avg < 4.2) return '#4ade80'; // green-400
  return '#16a34a';                // green-600
}

function gradeLabel(avg: number): string {
  if (!avg) return '—';
  return avg.toFixed(1);
}

// ─── KPI Donut ────────────────────────────────────────────────────────────────

const RADIAN = Math.PI / 180;

function KpiDonut({ item }: { item: KpiProgressItem }) {
  const pct = Math.min(100, item.actual_percent);
  const trackColor = item.is_on_track ? '#4ade80' : '#f87171';
  const data = [
    { value: pct },
    { value: 100 - pct },
  ];
  return (
    <div className="flex flex-col items-center gap-1">
      <PieChart width={100} height={100}>
        <Pie
          data={data}
          cx={50}
          cy={50}
          innerRadius={30}
          outerRadius={44}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          stroke="none"
        >
          <Cell fill={trackColor} />
          <Cell fill="#e5e7eb" />
        </Pie>
      </PieChart>
      <p className="text-xs font-semibold text-gray-800 text-center leading-tight" style={{ maxWidth: 96 }}>
        {item.competency_name}
      </p>
      <p className={`text-xs font-bold ${item.is_on_track ? 'text-green-600' : 'text-red-500'}`}>
        {pct.toFixed(0)}% / {item.target_percent}%
      </p>
      <p className="text-[10px] text-gray-400">{item.target_grade}</p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  k1: '#f87171',
  k2: '#fb923c',
  k3: '#facc15',
  k4: '#4ade80',
  k5: '#22c55e',
};

export default function DashboardPage() {
  const heatmap = useHeatmap();
  const trend = useGradeTrend(12);
  const kpiProgress = useKpiProgress();
  const stats = useAssignmentStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-8">

        {/* ── Stat cards ── */}
        {stats.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Всего назначений" value={stats.data.total} color="text-brand-700" />
            <StatCard label="Завершено" value={stats.data.by_status.completed}
              sub={`${stats.data.total ? Math.round((stats.data.by_status.completed / stats.data.total) * 100) : 0}%`}
              color="text-green-600" />
            <StatCard label="В процессе" value={stats.data.by_status.in_progress} color="text-amber-500" />
            <StatCard label="Просрочено" value={stats.data.by_status.overdue}
              sub={`${stats.data.overdue_percent.toFixed(1)}%`}
              color="text-red-500" />
          </div>
        )}

        {/* ── Heatmap ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Тепловая карта компетенций</h2>
          {heatmap.isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
          {heatmap.error && <p className="text-sm text-red-500">Ошибка загрузки</p>}
          {heatmap.data && heatmap.data.departments.length === 0 && (
            <p className="text-sm text-gray-400">Нет данных для отображения</p>
          )}
          {heatmap.data && heatmap.data.departments.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500 border-b border-r border-gray-200 min-w-[140px]">
                      Подразделение
                    </th>
                    {heatmap.data.competencies.map((c) => (
                      <th key={c.id} className="px-2 py-2 font-medium text-gray-500 border-b border-gray-200 text-center whitespace-nowrap min-w-[80px]">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.data.departments.map((dept, di) => {
                    const cellMap = new Map<string, HeatmapCell>();
                    heatmap.data!.cells
                      .filter((c) => c.department_id === dept.id)
                      .forEach((c) => cellMap.set(c.competency_id, c));
                    return (
                      <tr key={dept.id} className={di % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                          {dept.name}
                        </td>
                        {heatmap.data!.competencies.map((comp) => {
                          const cell = cellMap.get(comp.id);
                          const avg = cell?.avg_grade ?? 0;
                          return (
                            <td
                              key={comp.id}
                              className="px-2 py-2 text-center text-xs font-semibold border-gray-100 border"
                              style={{ backgroundColor: gradeColor(avg), color: avg >= 3 ? '#166534' : '#7f1d1d' }}
                              title={cell ? `${dept.name} / ${comp.name}: ср. ${avg.toFixed(2)}, сотр. ${cell.employee_count}` : 'Нет данных'}
                            >
                              {gradeLabel(avg)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500">
                <span>Легенда:</span>
                {[['K1', '#fca5a5'], ['K2', '#fcd34d'], ['K3', '#86efac'], ['K4', '#4ade80'], ['K5', '#16a34a']].map(([g, c]) => (
                  <span key={g} className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── KPI donuts ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Прогресс KPI</h2>
          {kpiProgress.isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
          {kpiProgress.data && kpiProgress.data.data.length === 0 && (
            <p className="text-sm text-gray-400">Целевые KPI не установлены</p>
          )}
          {kpiProgress.data && kpiProgress.data.data.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-wrap gap-6 justify-start">
                {kpiProgress.data.data.map((item) => (
                  <KpiDonut key={item.kpi_id} item={item} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Grade trend ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Динамика грейдов за 12 месяцев</h2>
          {trend.isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
          {trend.data && trend.data.data.length === 0 && (
            <p className="text-sm text-gray-400">Нет данных об аттестациях</p>
          )}
          {trend.data && trend.data.data.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trend.data.data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, name: string) => [v, name.toUpperCase()]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  {(['k1', 'k2', 'k3', 'k4', 'k5'] as const).map((k) => (
                    <Bar key={k} dataKey={k} name={k} stackId="a" fill={GRADE_COLORS[k]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
