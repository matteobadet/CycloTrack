import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native'
import { api } from '../lib/api'
import MarkdownView from '../components/MarkdownView'
import { TrackStats } from '../services/trackingService'
import { useTheme, Theme } from '../theme'

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

function Row({ label, value, t }: { label: string; value: string; t: Theme }) {
  return (
    <View style={rowStyles(t).row}>
      <Text style={rowStyles(t).label}>{label}</Text>
      <Text style={rowStyles(t).value}>{value}</Text>
    </View>
  )
}

const rowStyles = (t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  label: { color: t.textSub, fontSize: 15 },
  value: { fontWeight: 'bold', fontSize: 15, color: t.text },
})

export default function RideSummaryScreen({ route, navigation }: any) {
  const { stats, rideId, plannedRideId }: { stats: TrackStats; rideId: string; plannedRideId?: string } = route.params
  const t = useTheme()
  const s = styles(t)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [feelAfter, setFeelAfter] = useState<number | null>(null)
  const [commentAfter, setCommentAfter] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)

  // Auto-mark planned ride as completed
  React.useEffect(() => {
    if (plannedRideId) api.patch(`/plan/${plannedRideId}/complete`).catch(() => {})
  }, [plannedRideId])

  async function handleSaveFeedback() {
    setSavingFeedback(true)
    try {
      const listRes = await api.get('/rides?pageSize=1')
      const latestRide = listRes.data[0]
      if (!latestRide) { Alert.alert('Sortie pas encore synchronisée', 'Reconnectez-vous au réseau et réessayez.'); return }
      await api.patch(`/rides/${latestRide.id}/feedback`, { feelAfter, commentAfter: commentAfter.trim() || null })
      setFeedbackSaved(true)
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le feedback.')
    } finally {
      setSavingFeedback(false)
    }
  }

  async function handleAiAnalysis() {
    setLoadingAi(true)
    try {
      const listRes = await api.get('/rides?pageSize=1')
      const latestRide = listRes.data[0]
      if (!latestRide) { Alert.alert('Sortie pas encore synchronisée', 'Reconnectez-vous au réseau et réessayez.'); return }
      const { data } = await api.post(`/rides/${latestRide.id}/analyze`)
      setAiAnalysis(data.analysis)
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Impossible d\'obtenir le bilan.'
      Alert.alert('Erreur', msg)
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Sortie terminée 🎉</Text>

      <View style={s.card}>
        <Row label="Durée" value={formatDuration(stats.durationSec)} t={t} />
        <Row label="Distance" value={`${stats.distanceKm.toFixed(2)} km`} t={t} />
        <Row label="Vitesse moy." value={`${stats.avgSpeedKmh.toFixed(1)} km/h`} t={t} />
        <Row label="Vitesse max" value={`${stats.maxSpeedKmh.toFixed(1)} km/h`} t={t} />
        <Row label="Dénivelé +" value={`${stats.elevationGainM.toFixed(0)} m`} t={t} />
        <Row label="Dénivelé -" value={`${stats.elevationLossM.toFixed(0)} m`} t={t} />
        <Row label="Calories" value={`${stats.caloriesBurned} kcal`} t={t} />
        {stats.avgWatts != null && <Row label="Puissance moy." value={`${stats.avgWatts} W`} t={t} />}
        {stats.maxWatts != null && <Row label="Puissance max" value={`${stats.maxWatts} W`} t={t} />}
        {stats.avgCadenceRpm != null && <Row label="Cadence moy." value={`${stats.avgCadenceRpm} rpm`} t={t} />}
        {stats.avgBpm != null && <Row label="FC moy." value={`${stats.avgBpm} bpm`} t={t} />}
        {stats.maxBpm != null && <Row label="FC max" value={`${stats.maxBpm} bpm`} t={t} />}
      </View>

      <View style={s.feedbackCard}>
        <Text style={s.feedbackTitle}>💬 Ton ressenti</Text>
        {feedbackSaved ? (
          <Text style={s.feedbackSaved}>✓ Feedback enregistré</Text>
        ) : (
          <>
            <Text style={s.feelLabel}>Comment tu te sens après la sortie ?</Text>
            <View style={s.feelRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setFeelAfter(n)} style={[s.feelBtn, feelAfter === n && s.feelBtnActive]}>
                  <Text style={s.feelBtnText}>{['😫', '😕', '😐', '😊', '🤩'][n - 1]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[s.commentInput, { color: t.text, borderColor: t.border, backgroundColor: t.inputBg }]}
              placeholder="Problème de selle, douleur, météo... (optionnel)"
              placeholderTextColor={t.textMuted}
              value={commentAfter}
              onChangeText={setCommentAfter}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[s.feedbackBtn, (!feelAfter && !commentAfter.trim()) && s.feedbackBtnDisabled]}
              onPress={handleSaveFeedback}
              disabled={savingFeedback || (!feelAfter && !commentAfter.trim())}
            >
              {savingFeedback ? <ActivityIndicator color="#fff" /> : <Text style={s.feedbackBtnText}>Enregistrer le feedback</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={s.aiCard}>
        <Text style={s.aiTitle}>🤖 Bilan coach IA</Text>
        {aiAnalysis ? (
          <MarkdownView t={t}>{aiAnalysis}</MarkdownView>
        ) : (
          <TouchableOpacity style={s.aiBtn} onPress={handleAiAnalysis} disabled={loadingAi}>
            {loadingAi ? <ActivityIndicator color="#fff" /> : <Text style={s.aiBtnText}>Obtenir le bilan coach</Text>}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={s.doneBtnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}


const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: t.text },
  card: { backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  aiCard: { backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  aiTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12, color: t.text },
  aiText: { fontSize: 14, color: t.textSub, lineHeight: 22 },
  aiBtn: { backgroundColor: t.purple, borderRadius: 12, padding: 14, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  feedbackCard: { backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  feedbackTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12, color: t.text },
  feedbackSaved: { color: t.green, fontWeight: '600', fontSize: 15, textAlign: 'center', paddingVertical: 8 },
  feelLabel: { fontSize: 14, color: t.textSub, marginBottom: 10 },
  feelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  feelBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.inputBg, borderWidth: 2, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  feelBtnActive: { borderColor: t.green, backgroundColor: t.green + '22' },
  feelBtnText: { fontSize: 22 },
  commentInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 72, marginBottom: 12, textAlignVertical: 'top' },
  feedbackBtn: { backgroundColor: t.green, borderRadius: 12, padding: 13, alignItems: 'center' },
  feedbackBtnDisabled: { opacity: 0.4 },
  feedbackBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  doneBtn: { backgroundColor: t.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
