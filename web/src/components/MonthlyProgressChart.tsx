import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Ride } from '@/lib/types'

interface Props {
  rides: Ride[]
}

interface MonthData {
  label: string       // "Jan 25"
  distance: number    // km
  elevation: number   // m
  rides: number
  avgSpeed: number    // km/h
}

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default function MonthlyProgressChart({ rides }: Props) {
  if (rides.length < 2) return null

  // Group by month, last 12 months
  const byMonth = new Map<string, { distance: number; elevation: number; count: number; speedSum: number }>()
  for (const r of rides) {
    const key = monthKey(r.startedAt)
    const existing = byMonth.get(key) ?? { distance: 0, elevation: 0, count: 0, speedSum: 0 }
    byMonth.set(key, {
      distance: existing.distance + r.distanceKm,
      elevation: existing.elevation + r.elevationGainM,
      count: existing.count + 1,
      speedSum: existing.speedSum + r.avgSpeedKmh,
    })
  }

  // Sort and take last 12 months
  const sorted = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)

  const data: MonthData[] = sorted.map(([key, v]) => ({
    label: monthLabel(key),
    distance: Math.round(v.distance),
    elevation: Math.round(v.elevation),
    rides: v.count,
    avgSpeed: Math.round((v.speedSum / v.count) * 10) / 10,
  }))

  const showElevation = data.some(d => d.elevation > 0)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
      <h2 className="font-semibold mb-1 text-gray-900 dark:text-white">Progression mensuelle</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Distance (km) et dénivelé (m) par mois</p>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />

          {/* Left axis: distance km */}
          <YAxis
            yAxisId="dist"
            orientation="left"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickFormatter={v => `${v}`}
          />

          {/* Right axis: elevation m (hidden labels to avoid clutter) */}
          {showElevation && (
            <YAxis
              yAxisId="elev"
              orientation="right"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={v => `${v}m`}
            />
          )}

          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'distance') return [`${value} km`, 'Distance']
              if (name === 'elevation') return [`${value} m`, 'Dénivelé +']
              return [value, name]
            }}
          />

          <Bar yAxisId="dist" dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} maxBarSize={40} />
          {showElevation && (
            <Line
              yAxisId="elev"
              type="monotone"
              dataKey="elevation"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: '#f97316', r: 3 }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="mt-3 flex gap-6 text-xs text-gray-500 dark:text-slate-400">
        <span>Sorties : <strong className="text-gray-700 dark:text-slate-200">{data.reduce((a, d) => a + d.rides, 0)}</strong></span>
        <span>Distance totale : <strong className="text-gray-700 dark:text-slate-200">{data.reduce((a, d) => a + d.distance, 0)} km</strong></span>
        <span>Dénivelé total : <strong className="text-gray-700 dark:text-slate-200">{data.reduce((a, d) => a + d.elevation, 0)} m</strong></span>
      </div>
    </div>
  )
}
