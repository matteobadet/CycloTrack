import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native'
import { api } from '../lib/api'
import { useTheme, Theme } from '../theme'
import MarkdownView from '../components/MarkdownView'

interface MusicInsight {
  emoji: string
  title: string
  description: string
  trackName: string
  artistName: string
  albumArtUrl?: string
}

interface RideDetail {
  id: string
  startedAt: string
  endedAt: string
  distanceKm: number
  durationSec: number
  elevationGainM: number
  elevationLossM: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  avgWatts: number | null
  maxWatts: number | null
  avgCadenceRpm: number | null
  avgBpm: number | null
  maxBpm: number | null
  caloriesBurned: number
  feelBefore: number | null
  commentBefore: string | null
  aiAnalysis: string | null
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

const FEEL_EMOJI: Record<number, string> = { 1: '😴', 2: '😕', 3: '😐', 4: '😊', 5: '🔥' }

function Row({ label, value, t }: { label: string; value: string; t: Theme }) {
  const s = rowStyles(t)
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  )
}

const rowStyles = (t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  label: { color: t.textSub, fontSize: 15 },
  value: { fontWeight: 'bold', fontSize: 15, color: t.text },
})

function MusicInsightCard({ insight, t }: { insight: MusicInsight; t: Theme }) {
  const s = insightStyles(t)
  return (
    <View style={s.card}>
      <View style={s.left}>
        {insight.albumArtUrl ? (
          <Image source={{ uri: insight.albumArtUrl }} style={s.art} />
        ) : (
          <View style={[s.art, s.artPlaceholder]}>
            <Text style={{ fontSize: 18 }}>🎵</Text>
          </View>
        )}
      </View>
      <View style={s.right}>
        <Text style={s.badge}>{insight.emoji} {insight.title}</Text>
        <Text style={s.track} numberOfLines={1}>{insight.trackName}</Text>
        <Text style={s.artist} numberOfLines={1}>{insight.artistName}</Text>
        <Text style={s.desc}>{insight.description}</Text>
      </View>
    </View>
  )
}

const insightStyles = (t: Theme) => StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  left: {},
  right: { flex: 1 },
  art: { width: 52, height: 52, borderRadius: 8 },
  artPlaceholder: { backgroundColor: t.inputBg, alignItems: 'center', justifyContent: 'center' },
  badge: { fontSize: 11, fontWeight: '700', color: t.green, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  track: { fontSize: 14, fontWeight: '700', color: t.text },
  artist: { fontSize: 13, color: t.textSub, marginBottom: 2 },
  desc: { fontSize: 12, color: t.textMuted },
})

export default function RideDetailScreen({ route }: any) {
  const { rideId } = route.params
  const t = useTheme()
  const s = styles(t)
  const [ride, setRide] = useState<RideDetail | null>(null)
  const [musicInsights, setMusicInsights] = useState<MusicInsight[]>([])
  const [loadingAi, setLoadingAi] = useState(false)

  useEffect(() => { loadRide() }, [rideId])

  async function loadRide() {
    try {
      const { data } = await api.get(`/rides/${rideId}`)
      setRide(data.ride ?? data)
      setMusicInsights(data.musicInsights ?? [])
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la sortie.')
    }
  }

  async function handleAiAnalysis() {
    setLoadingAi(true)
    try {
      const { data } = await api.post(`/rides/${rideId}/analyze`)
      setRide(prev => prev ? { ...prev, aiAnalysis: data.analysis } : prev)
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Impossible d\'obtenir le bilan.'
      Alert.alert('Erreur', msg)
    } finally {
      setLoadingAi(false)
    }
  }

  if (!ride) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={t.blue} size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.dateTitle}>
        {new Date(ride.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {ride.feelBefore && (
        <Text style={s.feel}>{FEEL_EMOJI[ride.feelBefore]} {ride.commentBefore || ''}</Text>
      )}

      {/* Stats principales */}
      <View style={s.card}>
        <Row label="Durée" value={formatDuration(ride.durationSec)} t={t} />
        <Row label="Distance" value={`${ride.distanceKm.toFixed(2)} km`} t={t} />
        <Row label="Vitesse moy." value={`${ride.avgSpeedKmh.toFixed(1)} km/h`} t={t} />
        <Row label="Vitesse max" value={`${ride.maxSpeedKmh.toFixed(1)} km/h`} t={t} />
        <Row label="Dénivelé +" value={`${ride.elevationGainM.toFixed(0)} m`} t={t} />
        <Row label="Dénivelé -" value={`${ride.elevationLossM.toFixed(0)} m`} t={t} />
        <Row label="Calories" value={`${ride.caloriesBurned} kcal`} t={t} />
        {ride.avgWatts != null && <Row label="Puissance moy." value={`${ride.avgWatts} W`} t={t} />}
        {ride.maxWatts != null && <Row label="Puissance max" value={`${ride.maxWatts} W`} t={t} />}
        {ride.avgCadenceRpm != null && <Row label="Cadence moy." value={`${ride.avgCadenceRpm} rpm`} t={t} />}
        {ride.avgBpm != null && <Row label="FC moy." value={`${ride.avgBpm} bpm`} t={t} />}
        {ride.maxBpm != null && <Row label="FC max" value={`${ride.maxBpm} bpm`} t={t} />}
      </View>

      {/* Insights musicaux */}
      {musicInsights.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>🎵 Musique & performance</Text>
          {musicInsights.map((insight, i) => (
            <MusicInsightCard key={i} insight={insight} t={t} />
          ))}
        </View>
      )}

      {/* Bilan IA */}
      <View style={s.aiCard}>
        <Text style={s.aiTitle}>🤖 Bilan coach IA</Text>
        {ride.aiAnalysis ? (
          <MarkdownView t={t}>{ride.aiAnalysis}</MarkdownView>
        ) : (
          <TouchableOpacity style={s.aiBtn} onPress={handleAiAnalysis} disabled={loadingAi}>
            {loadingAi
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.aiBtnText}>Obtenir le bilan coach</Text>}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: 20 },
  dateTitle: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 8, textTransform: 'capitalize' },
  feel: { fontSize: 15, color: t.textSub, marginBottom: 16 },
  card: { backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: t.text, marginBottom: 8 },
  aiCard: { backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  aiTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12, color: t.text },
  aiBtn: { backgroundColor: t.purple, borderRadius: 12, padding: 14, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
})
