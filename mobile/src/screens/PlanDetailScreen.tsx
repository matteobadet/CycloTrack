import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { api } from '../lib/api'
import { useTheme, Theme } from '../theme'

interface PlanDetail {
  id: string
  title: string
  plannedAt: string | null
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  estimatedDurationMin: number
  isCompleted: boolean
  aiAdvice: string | null
}

// Simple markdown-like renderer for bold/bullets
function renderAdvice(text: string, t: Theme) {
  return text.split('\n').map((line, i) => {
    // Headers ##
    if (line.startsWith('## ') || line.startsWith('# ')) {
      return <Text key={i} style={{ color: t.text, fontWeight: '700', fontSize: 15, marginTop: 14, marginBottom: 4 }}>{line.replace(/^#+\s/, '')}</Text>
    }
    // Bold **text**
    if (line.includes('**')) {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <Text key={i} style={{ color: t.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 2 }}>
          {parts.map((p, j) => j % 2 === 1 ? <Text key={j} style={{ fontWeight: '700', color: t.text }}>{p}</Text> : p)}
        </Text>
      )
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <Text key={i} style={{ color: t.textMuted, fontSize: 13, lineHeight: 20, marginLeft: 12 }}>• {line.slice(2)}</Text>
    }
    // Numbered list
    if (/^\d+\./.test(line)) {
      return <Text key={i} style={{ color: t.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6, fontWeight: '600', color: t.text }}>{line}</Text>
    }
    if (!line.trim()) return <View key={i} style={{ height: 6 }} />
    return <Text key={i} style={{ color: t.textMuted, fontSize: 13, lineHeight: 20 }}>{line}</Text>
  })
}

export default function PlanDetailScreen({ route, navigation }: any) {
  const t = useTheme()
  const s = styles(t)
  const { id } = route.params
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/plan/${id}`).then(r => setPlan(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <View style={s.center}><ActivityIndicator /></View>
  if (!plan) return <View style={s.center}><Text style={{ color: t.textMuted }}>Introuvable</Text></View>

  const stats = [
    { label: 'Distance', value: `${plan.distanceKm.toFixed(1)} km` },
    { label: 'Dénivelé +', value: `${plan.elevationGainM.toFixed(0)} m` },
    { label: 'Dénivelé -', value: `${plan.elevationLossM.toFixed(0)} m` },
    { label: 'Durée', value: `${Math.floor(plan.estimatedDurationMin / 60)}h${String(plan.estimatedDurationMin % 60).padStart(2, '0')}` },
  ]

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text style={s.title}>{plan.title}</Text>
      {plan.plannedAt && (
        <Text style={s.date}>
          📅 {new Date(plan.plannedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
      {plan.isCompleted && <Text style={s.completedBadge}>✓ Sortie effectuée</Text>}

      {/* Stats grid */}
      <View style={s.statsGrid}>
        {stats.map(st => (
          <View key={st.label} style={s.statBox}>
            <Text style={s.statValue}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Launch ride button */}
      {!plan.isCompleted && (
        <TouchableOpacity
          style={s.launchBtn}
          onPress={() => navigation.navigate('PreRide', { plannedRideId: plan.id, plannedTitle: plan.title })}
        >
          <Text style={s.launchBtnText}>🚴  Lancer cette sortie</Text>
        </TouchableOpacity>
      )}

      {/* AI advice */}
      {plan.aiAdvice && (
        <View style={s.adviceCard}>
          <Text style={s.adviceTitle}>🧠 Conseils du coach IA</Text>
          <View style={{ marginTop: 8 }}>{renderAdvice(plan.aiAdvice, t)}</View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg },
  title: { fontSize: 20, fontWeight: '700', color: t.text, marginBottom: 6 },
  date: { fontSize: 13, color: '#3b82f6', marginBottom: 8 },
  completedBadge: { color: '#16a34a', fontWeight: '600', fontSize: 13, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  statBox: { flex: 1, minWidth: '44%', backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: t.text },
  statLabel: { fontSize: 11, color: t.textMuted, marginTop: 2 },
  adviceCard: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16 },
  adviceTitle: { fontSize: 15, fontWeight: '700', color: t.text, marginBottom: 4 },
  launchBtn: { backgroundColor: '#2563eb', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  launchBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
