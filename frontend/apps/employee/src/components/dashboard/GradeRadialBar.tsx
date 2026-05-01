import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { CompetencyProgress, Grade } from '../../types/dashboard';

const GRADE_PERCENT: Record<Grade, number> = {
  K1: 20,
  K2: 40,
  K3: 60,
  K4: 80,
  K5: 100,
};

const GRADE_COLORS: Record<Grade, string> = {
  K1: '#94a3b8',
  K2: '#64748b',
  K3: '#3b82f6',
  K4: '#2563eb',
  K5: '#1d4ed8',
};

const COMP_PALETTE = [
  '#3b82f6',
  '#6366f1',
  '#0ea5e9',
  '#8b5cf6',
  '#64748b',
];

interface Props {
  competencies: CompetencyProgress[];
  overallGrade: Grade;
  coveragePercent: number;
}

interface TooltipPayloadEntry {
  payload?: { name: string; value: number; grade: Grade };
}

interface RadialTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload }: RadialTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-800 truncate max-w-[160px]">{d.name}</p>
      <p className="text-gray-500">
        Грейд: <span className="font-semibold text-blue-600">{d.grade}</span>
      </p>
      <p className="text-gray-500">
        Балл: <span className="font-semibold">{d.value}%</span>
      </p>
    </div>
  );
}

export default function GradeRadialBar({ competencies, overallGrade, coveragePercent }: Props) {
  const data = competencies.map((c, i) => ({
    name: c.competency_name,
    value: c.score_percent > 0 ? Math.round(c.score_percent) : GRADE_PERCENT[c.current_grade],
    grade: c.current_grade,
    fill: COMP_PALETTE[i % COMP_PALETTE.length],
  }));

  return (
    <div className="flex flex-col items-center">
      {/* Radial chart */}
      <div className="relative w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="55%"
            innerRadius={28}
            outerRadius={108}
            startAngle={90}
            endAngle={-270}
            data={data}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={4}
              background={{ fill: '#f1f5f9' }}
              isAnimationActive
            />
            <Tooltip content={<CustomTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Centre overlay: overall grade */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-3xl font-black tracking-tight"
            style={{ color: GRADE_COLORS[overallGrade] }}
          >
            {overallGrade}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">Общий грейд</span>
        </div>
      </div>

      {/* Coverage badge */}
      <p className="text-sm text-gray-500 mt-1">
        Покрытие K3+:{' '}
        <span className="font-semibold text-blue-600">{coveragePercent.toFixed(1)}%</span>
      </p>

      {/* Legend rows */}
      <ul className="mt-4 w-full space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.fill }}
            />
            <span className="truncate flex-1">{d.name}</span>
            <span className="font-semibold text-gray-700 flex-shrink-0">{d.grade}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Skeleton shown while loading
export function GradeRadialBarSkeleton() {
  return (
    <div className="flex flex-col items-center animate-pulse">
      <div className="w-48 h-48 rounded-full bg-gray-200" />
      <div className="mt-4 w-32 h-3 bg-gray-200 rounded" />
      <div className="mt-4 w-full space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded w-full" />
        ))}
      </div>
    </div>
  );
}
