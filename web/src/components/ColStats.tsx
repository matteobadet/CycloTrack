import { Mountain } from 'lucide-react'

interface ElevPoint { dist: number; alt: number }

interface Col {
  startKm: number
  endKm: number
  summitKm: number
  summitAlt: number
  gainM: number
  lengthKm: number
  avgGradientPct: number
}

function detectCols(profile: ElevPoint[]): Col[] {
  if (profile.length < 4) return []

  // Smooth profile with a 3-point moving average to reduce noise
  const smoothed = profile.map((p, i) => ({
    dist: p.dist,
    alt: i === 0 || i === profile.length - 1
      ? p.alt
      : (profile[i - 1].alt + p.alt + profile[i + 1].alt) / 3,
  }))

  const cols: Col[] = []
  let i = 0

  while (i < smoothed.length - 2) {
    // Find a local minimum (potential start of climb)
    // Look for a sustained climb: advance while rising
    let climbStart = i
    let j = i + 1
    let peakIdx = i

    while (j < smoothed.length) {
      if (smoothed[j].alt >= smoothed[peakIdx].alt) {
        peakIdx = j
      }
      // If we've descended more than 20m from peak, climb ended
      if (smoothed[j].alt < smoothed[peakIdx].alt - 20) break
      j++
    }

    const gain = smoothed[peakIdx].alt - smoothed[climbStart].alt
    const length = smoothed[peakIdx].dist - smoothed[climbStart].dist

    if (gain >= 40 && length >= 0.3) {
      const avgGradient = length > 0 ? (gain / (length * 1000)) * 100 : 0
      if (avgGradient >= 2) {
        cols.push({
          startKm: smoothed[climbStart].dist,
          endKm: smoothed[peakIdx].dist,
          summitKm: smoothed[peakIdx].dist,
          summitAlt: Math.round(smoothed[peakIdx].alt),
          gainM: Math.round(gain),
          lengthKm: parseFloat(length.toFixed(1)),
          avgGradientPct: parseFloat(avgGradient.toFixed(1)),
        })
        i = peakIdx + 1
        continue
      }
    }
    i++
  }

  // Remove duplicates (climbs too close together — keep the bigger one)
  const filtered: Col[] = []
  for (const col of cols) {
    const last = filtered[filtered.length - 1]
    if (last && col.startKm - last.endKm < 0.5) {
      if (col.gainM > last.gainM) filtered[filtered.length - 1] = col
    } else {
      filtered.push(col)
    }
  }

  return filtered
}

function difficultyLabel(gainM: number, gradPct: number): { label: string; color: string } {
  const score = gainM * gradPct
  if (score > 6000) return { label: 'HC', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' }
  if (score > 2500) return { label: 'Cat. 1', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400' }
  if (score > 1000) return { label: 'Cat. 2', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' }
  if (score > 300) return { label: 'Cat. 3', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' }
  return { label: 'Cat. 4', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' }
}

interface Props {
  elevProfile: ElevPoint[]
}

export default function ColStats({ elevProfile }: Props) {
  const cols = detectCols(elevProfile)
  if (cols.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5">
      <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200 flex items-center gap-2">
        <Mountain size={16} className="text-orange-500" />
        Cols et montées significatives
        <span className="text-xs font-normal text-gray-400 dark:text-slate-500">({cols.length} détecté{cols.length > 1 ? 's' : ''})</span>
      </h2>
      <div className="space-y-3">
        {cols.map((col, i) => {
          const diff = difficultyLabel(col.gainM, col.avgGradientPct)
          return (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-slate-700/40 rounded-lg">
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mountain size={15} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">
                    Montée {i + 1}
                  </span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${diff.color}`}>
                    {diff.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  km {col.startKm.toFixed(1)} → {col.endKm.toFixed(1)} · sommet à {col.summitAlt} m
                </p>
              </div>
              <div className="flex gap-4 text-center flex-shrink-0">
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{col.lengthKm} km</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">longueur</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-orange-500">+{col.gainM} m</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">dénivelé</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">{col.avgGradientPct}%</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">pente moy.</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
