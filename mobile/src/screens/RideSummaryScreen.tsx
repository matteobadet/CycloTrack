import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { api } from '../lib/api'
import { TrackStats } from '../services/trackingService'

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  )
}

export default function RideSummaryScreen({ route, navigation }: any) {
  const { stats, rideId }: { stats: TrackStats; rideId: string } = route.params
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  async function handleAiAnalysis() {
    setLoadingAi(true)
    try {
      // Chercher la sortie synchro côté serveur via l'ID local — on relit depuis l'API
      // Si pas encore synchro, on informe l'utilisateur
      const listRes = await api.get('/rides?pageSize=1')
      const latestRide = listRes.data[0]
      if (!latestRide) { Alert.alert('Sortie pas encore synchronisée', 'Reconnectez-vous au réseau et réessayez.'); return }
      const { data } = await api.post(`/rides/${latestRide.id}/analyze`)
      setAiAnalysis(data.analysis)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'obtenir le bilan. Vérifiez votre connexion.')
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Sortie terminée 🎉</Text>

      <View style={s.card}>
        <Row label="Durée" value={formatDuration(stats.durationSec)} />
        <Row label="Distance" value={`${stats.distanceKm.toFixed(2)} km`} />
        <Row label="Vitesse moy." value={`${stats.avgSpeedKmh.toFixed(1)} km/h`} />
        <Row label="Vitesse max" value={`${stats.maxSpeedKmh.toFixed(1)} km/h`} />
        <Row label="Dénivelé +" value={`${stats.elevationGainM.toFixed(0)} m`} />
        <Row label="Dénivelé -" value={`${stats.elevationLossM.toFixed(0)} m`} />
        <Row label="Calories" value={`${stats.caloriesBurned} kcal`} />
        {stats.avgWatts && <Row label="Puissance moy." value={`${stats.avgWatts} W`} />}
        {stats.maxWatts && <Row label="Puissance max" value={`${stats.maxWatts} W`} />}
        {stats.avgCadenceRpm && <Row label="Cadence moy." value={`${stats.avgCadenceRpm} rpm`} />}
        {stats.avgBpm && <Row label="FC moy." value={`${stats.avgBpm} bpm`} />}
        {stats.maxBpm && <Row label="FC max" value={`${stats.maxBpm} bpm`} />}
      </View>

      {/* Bilan IA */}
      <View style={s.aiCard}>
        <Text style={s.aiTitle}>🤖 Bilan coach IA</Text>
        {aiAnalysis ? (
          <Text style={s.aiText}>{aiAnalysis}</Text>
        ) : (
          <TouchableOpacity style={s.aiBtn} onPress={handleAiAnalysis} disabled={loadingAi}>
            {loadingAi
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.aiBtnText}>Obtenir le bilan coach</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={s.doneBtnText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { color: '#6b7280', fontSize: 15 },
  rowValue: { fontWeight: 'bold', fontSize: 15, color: '#111' },
  aiCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  aiTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  aiText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  aiBtn: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 14, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  doneBtn: { backgroundColor: '#2563eb', borderRadius: 14, padding: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
