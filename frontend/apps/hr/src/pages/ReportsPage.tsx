import { useState, useCallback } from 'react';
import Header from '../components/Header';
import { useCompetencyCoverage, useKpiProgress } from '../hooks/useDashboard';
import { useDepartments } from '../hooks/useAssignments';
import { analyticsApi } from '../lib/axios';

// ─── Primitives ───────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <h2 className="text-sm font-semibold text-gray-700">{children}</h2>
    </div>
  );
}

// ─── Competency coverage table ────────────────────────────────────────────────

function CoverageTable({ departmentId, periodFrom, periodTo }: {
  departmentId?: string;
  periodFrom?: string;
  periodTo?: string;
}) {
  const { data, isLoading, isError, refetch } = useCompetencyCoverage({
    department_id: departmentId || undefined,
    period_from: periodFrom || undefined,
    period_to: periodTo || undefined,
  });

  if (isLoading) return <div className="p-5"><Skeleton className="h-48" /></div>;
  if (isError) return (
    <div className="p-5 text-sm text-red-600 text-center">
      Ошибка загрузки.{' '}
      <button onClick={() => refetch()} className="underline">Повторить</button>
    </div>
  );
  if (!data?.data.length) return (
    <div className="p-8 text-center text-sm text-gray-400">
      Данные о компетенциях отсутствуют за выбранный период
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Компетенция
            </th>
            {['K1','K2','K3','K4','K5'].map((g) => (
              <th key={g}
                className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">
                {g}
              </th>
            ))}
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
              Всего
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
              Покрытие K3+
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.data.map((row) => {
            const k3plus = row.k3_count + row.k4_count + row.k5_count;
            const pct = row.total_count > 0 ? Math.round((k3plus / row.total_count) * 100) : 0;
            return (
              <tr key={row.competency_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-gray-700 font-medium max-w-xs truncate"
                  title={row.competency_name}>
                  {row.competency_name}
                </td>
                {[row.k1_count, row.k2_count, row.k3_count, row.k4_count, row.k5_count].map((v, i) => (
                  <td key={i} className={`px-3 py-3 text-center text-sm font-mono
                    ${i === 0 && v > 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {v}
                  </td>
                ))}
                <td className="px-3 py-3 text-center text-gray-500 font-mono">{row.total_count}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
        Всего компетенций: {data.total}
        {data.period_from && ` · период с ${data.period_from}`}
        {data.period_to && ` по ${data.period_to}`}
      </div>
    </div>
  );
}

// ─── KPI progress table ───────────────────────────────────────────────────────

function KpiTable({ departmentId, periodFrom, periodTo }: {
  departmentId?: string;
  periodFrom?: string;
  periodTo?: string;
}) {
  const { data, isLoading, isError, refetch } = useKpiProgress({
    department_id: departmentId || undefined,
    period_from: periodFrom || undefined,
    period_to: periodTo || undefined,
  });

  if (isLoading) return <div className="p-5"><Skeleton className="h-40" /></div>;
  if (isError) return (
    <div className="p-5 text-sm text-red-600 text-center">
      Ошибка загрузки.{' '}
      <button onClick={() => refetch()} className="underline">Повторить</button>
    </div>
  );
  if (!data?.data.length) return (
    <div className="p-8 text-center text-sm text-gray-400">
      KPI не настроены{departmentId ? ' для выбранного подразделения' : ''}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Компетенция
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
              Грейд
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
              Цель
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
              Факт
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
              Выполнение
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Период
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
              Статус
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.data.map((kpi) => {
            const actual = Math.min(kpi.actual_percent, 100);
            const target = Math.min(kpi.target_percent, 100);
            return (
              <tr key={kpi.kpi_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-gray-700 font-medium max-w-xs truncate"
                  title={kpi.competency_name}>
                  {kpi.competency_name}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-semibold">
                    {kpi.target_grade}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-gray-500 text-xs">
                  {kpi.target_percent}%
                </td>
                <td className="px-3 py-3 text-center text-xs font-semibold
                  ${kpi.is_on_track ? 'text-green-600' : 'text-red-600'}">
                  <span className={kpi.is_on_track ? 'text-green-600' : 'text-red-600'}>
                    {kpi.actual_percent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mx-2">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                      style={{ left: `${target}%` }}
                    />
                    <div
                      className={`h-full rounded-full ${kpi.is_on_track ? 'bg-green-500' : 'bg-red-400'}`}
                      style={{ width: `${actual}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-0.5">
                    {kpi.met_count}/{kpi.total_employees}
                  </p>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {kpi.period_start}
                  {kpi.period_end ? ` — ${kpi.period_end}` : ' — н.в.'}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                    ${kpi.is_on_track ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {kpi.is_on_track ? 'Выполнен' : 'Отстаёт'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ReportTab = 'coverage' | 'kpi';

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('coverage');
  const [departmentId, setDepartmentId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: departments } = useDepartments();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'xlsx' });
      if (departmentId) params.set('department_id', departmentId);
      if (periodFrom) params.set('period_from', periodFrom);
      if (periodTo) params.set('period_to', periodTo);

      const response = await analyticsApi.get(`/v1/reports/export?${params}`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [departmentId, periodFrom, periodTo]);

  function resetFilters() {
    setDepartmentId('');
    setPeriodFrom('');
    setPeriodTo('');
  }

  const hasFilters = departmentId || periodFrom || periodTo;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Отчёты по компетенциям</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Покрытие грейдами и прогресс KPI по подразделениям
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm
                       font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            {exporting
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Экспорт…</>
              : <>⬇ Экспорт Excel</>}
          </button>
        </div>

        {/* Filter bar */}
        <Card className="px-5 py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Подразделение</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">Все подразделения</option>
                {(departments ?? []).map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">Период с</label>
              <input
                type="date"
                value={periodFrom}
                max={periodTo || undefined}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">по</label>
              <input
                type="date"
                value={periodTo}
                min={periodFrom || undefined}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-gray-400 hover:text-gray-600 underline pb-2"
              >
                Сбросить
              </button>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1 w-fit">
          {([
            { key: 'coverage', label: '📊 Покрытие компетенций' },
            { key: 'kpi', label: '🎯 Прогресс KPI' },
          ] as { key: ReportTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                tab === t.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card>
          {tab === 'coverage' && (
            <>
              <SectionHeader>
                Распределение грейдов по компетенциям
                {departmentId && departments && (
                  <> · {departments.find(d => d.departmentId === departmentId)?.name}</>
                )}
              </SectionHeader>
              <CoverageTable
                departmentId={departmentId}
                periodFrom={periodFrom}
                periodTo={periodTo}
              />
            </>
          )}
          {tab === 'kpi' && (
            <>
              <SectionHeader>
                KPI по компетенциям
                {departmentId && departments && (
                  <> · {departments.find(d => d.departmentId === departmentId)?.name}</>
                )}
              </SectionHeader>
              <KpiTable
                departmentId={departmentId}
                periodFrom={periodFrom}
                periodTo={periodTo}
              />
            </>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 pb-2">
          ВКР НИУ ВШЭ — Пермь, 2026 · Данные обновляются каждые 5 минут
        </p>
      </main>
    </div>
  );
}
