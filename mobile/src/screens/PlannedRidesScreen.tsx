import React, { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../lib/api'
import { useTheme, Theme } from '../theme'

interface PlannedRide {
  id: string
  title: string
  plannedAt: string | null
  distanceKm: number
  elevationGainM: number
  estimatedDurationMin: number
  isCompleted: boolean
  createdAt: string
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

export default function PlannedRidesScreen({ navigation }: any) {
  const t = useTheme()
  const s = styles(t)
  const [plans, setPlans] = useState<PlannedRide[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => {
    api.get('/plan').then(r => setPlans(r.data)).finally(() => setLoading(false))
  }, []))

  async function markComplete(id: string) {
    await api.patch(`/plan/${id}/complete`)
    setPlans(p => p.map(x => x.id === id ? { ...x, isCompleted: true } : x))
  }

  function confirmComplete(id: string) {
    Alert.alert('Sortie effectuée ?', 'Marquer cette planification comme réalisée ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => markComplete(id) },
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator /></View>

  return (
    <View style={s.container}>
      <Text style={s.title}>Sorties planifiées</Text>
      {plans.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>Aucune sortie planifiée.</Text>
          <Text style={s.emptyHint}>Planifie depuis l'appli web et retrouve-les ici.</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, item.isCompleted && s.cardDone]}
              onPress={() => navigation.navigate('PlanDetail', { id: item.id })}
              activeOpacity={0.8}
            >
              <View style={s.cardHeader}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                {!item.isCompleted && (
                  <TouchableOpacity onPress={() => confirmComplete(item.id)} style={s.doneBtn}>
                    <Text style={s.doneBtnText}>✓</Text>
                  </TouchableOpacity>
                )}
                {item.isCompleted && <Text style={s.completedBadge}>✓ Effectuée</Text>}
              </View>
              {item.plannedAt && (
                <Text style={s.date}>
                  📅 {new Date(item.plannedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              <View style={s.stats}>
                <Text style={s.stat}>{item.distanceKm.toFixed(1)} km</Text>
                <Text style={s.statSep}>·</Text>
                <Text style={s.stat}>↑ {item.elevationGainM.toFixed(0)} m</Text>
                <Text style={s.statSep}>·</Text>
                <Text style={s.stat}>{formatDuration(item.estimatedDurationMin)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 16 },
  empty: { color: t.textMuted, fontSize: 15, marginBottom: 8 },
  emptyHint: { color: t.textMuted, fontSize: 12, textAlign: 'center', maxWidth: 240 },
  card: { backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: t.border },
  cardDone: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: t.text, flex: 1 },
  doneBtn: { backgroundColor: '#16a34a', borderRadius: 20, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  completedBadge: { color: '#16a34a', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  date: { fontSize: 12, color: '#3b82f6', marginBottom: 8 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat: { fontSize: 13, color: t.textMuted },
  statSep: { color: t.textMuted, fontSize: 13 },
})
