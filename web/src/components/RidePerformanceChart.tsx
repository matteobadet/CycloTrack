import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { RidePoint } from '@/lib/types'

interface Props {
  points: RidePoint[]
}

interface ChartRow {
  idx: number
  alt?: number | null
  speed?: number | null
  bpm?: number | null
  watts?: number | null
  // normalized 0-100 for visual scaling on shared right axis
  speedN?: number | null
  bpmN?: number | null
  wattsN?: number | null
}

function normalize(val: number | undefined | null, max: number): number | null {
  if (val == null || max === 0) return null
  return Math.round((val / max) * 100)
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ChartRow
  return (
    <div className="bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
      {d.alt != null && <p className="text-orange-500">Altitude: <strong>{d.alt} m</strong></p>}
      {d.speed != null && <p className="text-blue-500">Vitesse: <strong>{d.speed} km/h</strong></p>}
      {d.bpm != null && <p className="text-red-500">FC: <strong>{d.bpm} bpm</strong></p>}
      {d.watts != null && <p className="text-purple-500">Puissance: <strong>{d.watts} W</strong></p>}
    </div>
  )
}

export default function RidePerformanceChart({ points }: Props) {
  const sampled = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 200)) === 0)

  const maxSpeed = Math.max(...sampled.map(p => p.speedKmh ?? 0))
  const maxBpm = Math.max(...sampled.map(p => p.bpm ?? 0))
  const maxWatts = Math.max(...sampled.map(p => p.watts ?? 0))

  const hasSpeed = maxSpeed > 0
  const hasBpm = maxBpm > 0
  const hasWatts = maxWatts > 0
  const hasAlt = sampled.some(p => p.altitudeM != null)

  const data: ChartRow[] = sampled.map((p, i) => ({
    idx: i,
    alt: p.altitudeM != null ? Math.round(p.altitudeM) : null,
    speed: p.speedKmh != null ? parseFloat(p.speedKmh.toFixed(1)) : null,
    bpm: p.bpm ?? null,
    watts: p.watts ?? null,
    speedN: normalize(p.speedKmh, maxSpeed),
    bpmN: normalize(p.bpm, maxBpm),
    wattsN: normalize(p.watts, maxWatts),
  }))

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {hasAlt && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-orange-400" />Altitude (m)</span>}
        {hasSpeed && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500" />Vitesse</span>}
        {hasBpm && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />Fréquence cardiaque</span>}
        {hasWatts && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-purple-500" />Puissance</span>}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gAltPerf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <XAxis dataKey="idx" hide />

          {/* Left axis: altitude */}
          {hasAlt && (
            <YAxis
              yAxisId="alt"
              orientation="left"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={v => `${v}m`}
            />
          )}

          {/* Right axis: normalized 0-100% for speed/bpm/watts */}
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            hide
          />

          <Tooltip content={<CustomTooltip />} />

          {hasAlt && (
            <Area
              yAxisId="alt"
              type="monotone"
              dataKey="alt"
              stroke="#f97316"
              fill="url(#gAltPerf)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}

          {hasSpeed && (
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="speedN"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}

          {hasBpm && (
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="bpmN"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}

          {hasWatts && (
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="wattsN"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
