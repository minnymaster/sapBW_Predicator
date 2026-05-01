import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendPoint } from '../../types/dashboard';

const LINE_COLORS = [
  '#3b82f6',
  '#6366f1',
  '#0ea5e9',
  '#8b5cf6',
  '#64748b',
];

interface Props {
  data: TrendPoint[];
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="truncate text-gray-600 max-w-[120px]">{p.name}</span>
          <span className="ml-auto font-semibold text-gray-800">{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function CompetencyTrendChart({ data }: Props) {
  // Collect all competency keys from all points (exclude 'month')
  const allKeys = Array.from(
    new Set(data.flatMap((p) => Object.keys(p).filter((k) => k !== 'month'))),
  );

  const isEmpty = data.every((p) => Object.keys(p).filter((k) => k !== 'month').length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center text-sm text-gray-400">
        <span className="text-3xl mb-2">📈</span>
        <p>Данные появятся после завершения первой аттестации</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value) => (
            <span className="text-gray-600 truncate" style={{ maxWidth: 120 }}>{value}</span>
          )}
        />
        {allKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompetencyTrendSkeleton() {
  return (
    <div className="animate-pulse space-y-2 px-2">
      <div className="h-3 bg-gray-200 rounded w-1/3" />
      <div className="h-44 bg-gray-100 rounded-lg" />
    </div>
  );
}
