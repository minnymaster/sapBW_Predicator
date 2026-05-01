import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import type { Grade } from '../../types/dashboard';
import { scoreToGrade } from '../../hooks/useDashboard';

// ─── Grade palette ────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<Grade, string> = {
  K1: '#e2e8f0',
  K2: '#bfdbfe',
  K3: '#60a5fa',
  K4: '#2563eb',
  K5: '#1d4ed8',
};

const GRADE_TEXT: Record<Grade, string> = {
  K1: '#64748b',
  K2: '#1e40af',
  K3: '#1e3a8a',
  K4: '#ffffff',
  K5: '#ffffff',
};

const GRADE_LABEL: Record<Grade, string> = {
  K1: 'Junior',
  K2: 'Middle',
  K3: 'Senior',
  K4: 'Lead',
  K5: 'Architect',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetencyRow {
  competencyId: string;
  name: string;
  area: string;
  months: {
    label: string;    // е.g. "Ноя"
    score: number | null;
    grade: Grade | null;
  }[];
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function GradeLegend() {
  const grades: Grade[] = ['K1', 'K2', 'K3', 'K4', 'K5'];
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
      <span className="font-medium">Уровень:</span>
      {grades.map((g) => (
        <div key={g} className="flex items-center gap-1">
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: GRADE_COLOR[g], color: GRADE_TEXT[g] }}
          >
            {g}
          </div>
          <span>{GRADE_LABEL[g]}</span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <div className="w-5 h-5 rounded bg-gray-100 border border-dashed border-gray-300" />
        <span>Нет данных</span>
      </div>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: { name: string; month: string; score: number | null; grade: Grade | null } }[];
  label?: string;
}

function HeatmapTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[200px]">
      <p className="font-semibold text-gray-800 mb-1 truncate">{d.name}</p>
      <p className="text-gray-500">{d.month}</p>
      {d.grade ? (
        <>
          <p className="text-gray-600">
            Грейд:{' '}
            <span className="font-bold" style={{ color: d.grade >= 'K3' ? '#2563eb' : '#64748b' }}>
              {d.grade}
            </span>
          </p>
          <p className="text-gray-500">Балл: {d.score?.toFixed(0)}%</p>
        </>
      ) : (
        <p className="text-gray-400 italic">Нет данных за период</p>
      )}
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

interface GridProps {
  rows: CompetencyRow[];
}

function CalendarGrid({ rows }: GridProps) {
  if (rows.length === 0) return null;
  const monthLabels = rows[0].months.map((m) => m.label);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate" style={{ borderSpacing: '3px' }}>
        <thead>
          <tr>
            <th className="text-left text-gray-500 font-medium pb-2 pr-4 min-w-[150px] sticky left-0 bg-white">
              Компетенция
            </th>
            {monthLabels.map((m) => (
              <th key={m} className="text-center text-gray-500 font-medium pb-2 w-16">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.competencyId}>
              <td className="pr-4 py-0.5 sticky left-0 bg-white">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700 truncate max-w-[170px]" title={row.name}>
                    {row.name}
                  </span>
                  <span className="text-gray-400 text-[10px]">{row.area}</span>
                </div>
              </td>
              {row.months.map((m, mi) => (
                <td key={mi} className="text-center py-0.5">
                  {m.grade ? (
                    <div
                      className="mx-auto w-12 h-9 rounded-lg flex flex-col items-center justify-center
                                 text-[10px] font-bold leading-tight transition hover:opacity-80 cursor-default"
                      style={{ backgroundColor: GRADE_COLOR[m.grade], color: GRADE_TEXT[m.grade] }}
                      title={`${m.grade} — ${m.score?.toFixed(0)}%`}
                    >
                      <span>{m.grade}</span>
                      {m.score !== null && (
                        <span className="font-normal opacity-80">{m.score.toFixed(0)}%</span>
                      )}
                    </div>
                  ) : (
                    <div
                      className="mx-auto w-12 h-9 rounded-lg bg-gray-50 border border-dashed
                                 border-gray-200 flex items-center justify-center text-gray-300 cursor-default"
                      title="Нет данных"
                    >
                      —
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recharts bar: average score per month ────────────────────────────────────

interface MonthBarData {
  month: string;
  avg: number;
  grade: Grade;
}

interface MonthAvgBarProps {
  rows: CompetencyRow[];
}

function MonthAverageBar({ rows }: MonthAvgBarProps) {
  if (rows.length === 0) return null;
  const months = rows[0].months.map((m) => m.label);

  const barData: MonthBarData[] = months.map((month, mi) => {
    const scores = rows
      .map((r) => r.months[mi].score)
      .filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { month, avg: Math.round(avg), grade: scoreToGrade(avg) };
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Средний балл по всем компетенциям
      </h3>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip content={<HeatmapTooltip />} />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {barData.map((d, i) => (
              <Cell key={i} fill={GRADE_COLOR[d.grade]} stroke={GRADE_COLOR[d.grade]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

interface Props {
  rows: CompetencyRow[];
  loading?: boolean;
}

export default function CompetencyCalendarHeatmap({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-40" />
        <div className="h-52 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  const hasData = rows.some((r) => r.months.some((m) => m.grade !== null));

  if (!hasData) {
    return (
      <div className="text-center py-14 text-gray-400">
        <div className="text-4xl mb-3">📅</div>
        <p className="font-medium text-gray-600">Нет исторических данных</p>
        <p className="text-sm mt-1">
          Тепловая карта заполнится после завершения аттестаций
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GradeLegend />
      <CalendarGrid rows={rows} />
      <MonthAverageBar rows={rows} />
    </div>
  );
}

// Re-export helper so DynamicsPage can use it
export { scoreToGrade };
