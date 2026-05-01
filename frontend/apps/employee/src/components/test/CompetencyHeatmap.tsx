import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Grade } from '../../types/tests';

const GRADES: Grade[] = ['K1', 'K2', 'K3', 'K4', 'K5'];

const GRADE_COLOR: Record<Grade, string> = {
  K1: '#94a3b8',
  K2: '#60a5fa',
  K3: '#3b82f6',
  K4: '#2563eb',
  K5: '#1d4ed8',
};

// Cell color for the grid: achieved/below → filled, above → light
const CELL_FILL: Record<Grade, string> = {
  K1: '#dbeafe',
  K2: '#93c5fd',
  K3: '#60a5fa',
  K4: '#3b82f6',
  K5: '#1d4ed8',
};

const GRADE_LABEL: Record<Grade, string> = {
  K1: 'Junior',
  K2: 'Middle',
  K3: 'Senior',
  K4: 'Lead',
  K5: 'Architect',
};

function gradeIndex(g: Grade): number {
  return GRADES.indexOf(g);
}

export interface HeatmapRow {
  competencyId: string;
  competencyName: string;
  gradeAchieved: Grade;
  scorePercent: number;
}

interface TooltipPayloadEntry {
  payload?: HeatmapRow;
  value?: number;
}

interface HeatmapTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function HeatmapTooltip({ active, payload }: HeatmapTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800 mb-1 max-w-[200px] truncate">{d.competencyName}</p>
      <p className="text-gray-500">
        Грейд: <span style={{ color: GRADE_COLOR[d.gradeAchieved] }} className="font-bold">{d.gradeAchieved}</span>
      </p>
      <p className="text-gray-500">
        Балл: <span className="font-semibold">{d.scorePercent.toFixed(1)}%</span>
      </p>
    </div>
  );
}

interface Props {
  rows: HeatmapRow[];
}

export default function CompetencyHeatmap({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        Нет данных по компетенциям
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cell grid (true heatmap) ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Достигнутые уровни</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-medium pb-1 pr-3 min-w-[140px]">
                  Компетенция
                </th>
                {GRADES.map((g) => (
                  <th key={g} className="text-center text-gray-500 font-medium pb-1 w-14">
                    <div>{g}</div>
                    <div className="text-gray-400 font-normal text-[10px]">{GRADE_LABEL[g]}</div>
                  </th>
                ))}
                <th className="text-center text-gray-500 font-medium pb-1 pl-2">Балл</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const achieved = gradeIndex(row.gradeAchieved);
                return (
                  <tr key={row.competencyId}>
                    <td className="pr-3 py-0.5">
                      <span className="text-gray-700 font-medium truncate block max-w-[160px]" title={row.competencyName}>
                        {row.competencyName}
                      </span>
                    </td>
                    {GRADES.map((g, gi) => {
                      const isCurrent = gi === achieved;
                      const isBelow = gi < achieved;
                      const bg = isCurrent
                        ? CELL_FILL[g]
                        : isBelow
                        ? '#dbeafe'
                        : '#f8fafc';
                      const border = isCurrent ? `2px solid ${GRADE_COLOR[g]}` : '1px solid #e2e8f0';

                      return (
                        <td key={g} className="text-center py-0.5">
                          <div
                            className="mx-auto w-11 h-8 rounded flex items-center justify-center text-xs font-bold transition"
                            style={{ backgroundColor: bg, border }}
                          >
                            {isCurrent ? (
                              <span style={{ color: GRADE_COLOR[g] }}>{g}</span>
                            ) : isBelow ? (
                              <span className="text-blue-300">✓</span>
                            ) : (
                              <span className="text-gray-300">·</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center pl-2">
                      <span className="font-semibold text-gray-700">
                        {row.scorePercent.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Score bar chart ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Баллы по компетенциям</h3>
        <ResponsiveContainer width="100%" height={rows.length * 44 + 24}>
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="competencyName"
              width={160}
              tick={{ fontSize: 12, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v}
            />
            <Tooltip content={<HeatmapTooltip />} />
            <Bar dataKey="scorePercent" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {rows.map((row) => (
                <Cell key={row.competencyId} fill={GRADE_COLOR[row.gradeAchieved]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
