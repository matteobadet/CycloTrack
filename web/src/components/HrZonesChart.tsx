import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RidePoint } from '@/lib/types'

interface Zone {
  label: string
  shortLabel: string
  color: string
  minPct: number
  maxPct: number
  desc: string
}

const ZONES: Zone[] = [
  { label: 'Z1 — Récupération', shortLabel: 'Z1', color: '#94a3b8', minPct: 0,   maxPct: 0.6,  desc: '<60%' },
  { label: 'Z2 — Endurance',    shortLabel: 'Z2', color: '#3b82f6', minPct: 0.6,  maxPct: 0.7,  desc: '60-70%' },
  { label: 'Z3 — Aérobie',      shortLabel: 'Z3', color: '#22c55e', minPct: 0.7,  maxPct: 0.8,  desc: '70-80%' },
  { label: 'Z4 — Seuil',        shortLabel: 'Z4', color: '#f97316', minPct: 0.8,  maxPct: 0.9,  desc: '80-90%' },
  { label: 'Z5 — Max',          shortLabel: 'Z5', color: '#ef4444', minPct: 0.9,  maxPct: 2,    desc: '>90%' },
]

function getZone(bpm: number, maxHr: number): number {
  const pct = bpm / maxHr
  return ZONES.findIndex(z => pct >= z.minPct && pct < z.maxPct)
}

const RADIAN = Math.PI / 180
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, payload }: any) => {
  if (percent < 0.04) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {payload.shortLabel}
    </text>
  )
}

interface Props {
  points: RidePoint[]
  maxHrBpm?: number | null
}

export default function HrZonesChart({ points, maxHrBpm }: Props) {
  const maxHr = maxHrBpm ?? 190

  const bpmPoints = points.filter(p => p.bpm != null)
  if (bpmPoints.length === 0) return null

  // Count seconds per zone (each point ~ equally spaced)
  const counts = new Array(5).fill(0)
  for (const p of bpmPoints) {
    const z = getZone(p.bpm!, maxHr)
    if (z >= 0) counts[z]++
  }

  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const chartData = ZONES.map((z, i) => ({
    ...z,
    value: counts[i],
    pct: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
  })).filter(d => d.value > 0)

  // Compute time in majority zone
  const dominant = [...chartData].sort((a, b) => b.value - a.value)[0]

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
              labelLine={false}
              label={renderLabel}
              isAnimationActive={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) =>
                [`${props.payload.pct}% (${value} pts)`, props.payload.label]
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + breakdown */}
      <div className="flex-1 space-y-1.5">
        {chartData.map(z => (
          <div key={z.shortLabel} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
            <span className="text-gray-600 dark:text-slate-300 w-28">{z.label}</span>
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
              <div className="h-full rounded-full" style={{ width: `${z.pct}%`, backgroundColor: z.color }} />
            </div>
            <span className="text-gray-500 dark:text-slate-400 w-8 text-right font-medium">{z.pct}%</span>
          </div>
        ))}
        {maxHrBpm == null && (
          <p className="text-xs text-amber-500 dark:text-amber-400 mt-2">
            ⚠️ FC max non renseignée — calcul basé sur 190 bpm. Mettez à jour dans votre profil.
          </p>
        )}
      </div>
    </div>
  )
}
