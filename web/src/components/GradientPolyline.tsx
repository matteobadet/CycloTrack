import { Polyline } from 'react-leaflet'
import { buildGradientSegments, GRADIENT_ZONES } from '@/lib/routing'

interface Props {
  coords: [number, number][]
  elevations: number[]
  weight?: number
}

export default function GradientPolyline({ coords, elevations, weight = 4 }: Props) {
  const segments = buildGradientSegments(coords, elevations)
  return (
    <>
      {segments.map((seg, i) => (
        <Polyline key={i} positions={seg.coords} color={seg.color} weight={weight} />
      ))}
    </>
  )
}

export function GradientLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {GRADIENT_ZONES.map(z => (
        <div key={z.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
          <div className="w-5 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
          <span>{z.label}</span>
        </div>
      ))}
    </div>
  )
}
