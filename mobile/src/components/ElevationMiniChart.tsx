import React, { useMemo } from 'react'
import { View, Text, Dimensions, StyleSheet } from 'react-native'
import { useTheme } from '../theme'

interface ElevPoint { dist: number; alt: number }

interface Props {
  elevProfile: ElevPoint[]
  progressM: number
  totalDistM: number
}

const W = Dimensions.get('window').width
const H = 56
const NUM_BARS = 80

export default function ElevationMiniChart({ elevProfile, progressM, totalDistM }: Props) {
  const t = useTheme()

  const bars = useMemo(() => {
    if (!elevProfile.length || totalDistM <= 0) return []
    const totalKm = totalDistM / 1000
    const alts = Array.from({ length: NUM_BARS }, (_, i) => {
      const km = (i / NUM_BARS) * totalKm
      // Interpolate altitude at km
      for (let j = 0; j < elevProfile.length - 1; j++) {
        if (km >= elevProfile[j].dist && km <= elevProfile[j + 1].dist) {
          const t = (km - elevProfile[j].dist) / (elevProfile[j + 1].dist - elevProfile[j].dist)
          return elevProfile[j].alt + t * (elevProfile[j + 1].alt - elevProfile[j].alt)
        }
      }
      if (km <= elevProfile[0].dist) return elevProfile[0].alt
      return elevProfile[elevProfile.length - 1].alt
    })

    const minAlt = Math.min(...alts)
    const maxAlt = Math.max(...alts)
    const range = maxAlt - minAlt || 1

    return alts.map((alt, i) => ({
      height: Math.max(4, ((alt - minAlt) / range) * (H - 12)),
      done: i / NUM_BARS < progressM / totalDistM,
    }))
  }, [elevProfile, progressM, totalDistM])

  if (!bars.length) return null

  const cursorX = (progressM / totalDistM) * W
  const progressKm = (progressM / 1000).toFixed(1)
  const totalKm = (totalDistM / 1000).toFixed(1)

  return (
    <View style={[s.container, { backgroundColor: t.card, borderTopColor: t.border }]}>
      <View style={s.chart}>
        {bars.map((bar, i) => (
          <View
            key={i}
            style={[
              s.bar,
              {
                height: bar.height,
                backgroundColor: bar.done ? '#3b82f6' : '#94a3b8',
                opacity: bar.done ? 1 : 0.5,
              },
            ]}
          />
        ))}
        {/* Cursor */}
        <View style={[s.cursor, { left: cursorX - 1 }]} />
      </View>
      <Text style={[s.label, { color: t.textMuted }]}>
        {progressKm} km / {totalKm} km
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 2,
  },
  chart: {
    height: H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    position: 'relative',
  },
  bar: {
    flex: 1,
    borderRadius: 1,
  },
  cursor: {
    position: 'absolute',
    bottom: 0,
    top: 0,
    width: 2,
    backgroundColor: '#f97316',
    borderRadius: 1,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
})
