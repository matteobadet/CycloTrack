import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { syncPendingRides, getPendingCount } from '../services/offlineStore'

interface RideSummary {
  id: string
  startedAt: string
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  elevationGainM: number
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

export default function HomeScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const [rides, setRides] = useState<RideSummary[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setPendingCount(getPendingCount())
    try {
      const { data } = await api.get('/rides?pageSize=10')
      setRides(data)
    } catch {
      // Offline — rien à afficher
    }
  }

  async function handleSync() {
    const synced = await syncPendingRides()
    Alert.alert('Synchronisation', `${synced} sortie(s) synchronisée(s).`)
    loadData()
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Bonjour, {user?.pseudo} 👋</Text>
          {pendingCount > 0 && (
            <TouchableOpacity onPress={handleSync}>
              <Text style={s.syncBadge}>⚠️ {pendingCount} sortie(s) non synchronisée(s) — Appuyer pour sync</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={s.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton démarrer */}
      <TouchableOpacity style={s.bigStartBtn} onPress={() => navigation.navigate('PreRide')}>
        <Text style={s.bigStartIcon}>🚴</Text>
        <Text style={s.bigStartText}>Nouvelle sortie</Text>
      </TouchableOpacity>

      {/* Dernières sorties */}
      <Text style={s.sectionTitle}>Dernières sorties</Text>
      <FlatList
        data={rides}
        keyExtractor={r => r.id}
        renderItem={({ item: r }) => (
          <View style={s.rideCard}>
            <View style={s.rideLeft}>
              <Text style={s.rideDate}>{new Date(r.startedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
              <Text style={s.rideSub}>{formatDuration(r.durationSec)}</Text>
            </View>
            <View style={s.rideRight}>
              <Text style={s.rideStat}>{r.distanceKm.toFixed(1)} km</Text>
              <Text style={s.rideStatSub}>{r.avgSpeedKmh.toFixed(1)} km/h moy.</Text>
            </View>
            <Text style={s.rideElev}>↑{r.elevationGainM.toFixed(0)}m</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>Aucune sortie enregistrée.</Text>}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 20, fontWeight: 'bold' },
  syncBadge: { fontSize: 12, color: '#d97706', marginTop: 4 },
  logoutText: { color: '#6b7280', fontSize: 14 },
  bigStartBtn: { backgroundColor: '#16a34a', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 28, shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  bigStartIcon: { fontSize: 40, marginBottom: 8 },
  bigStartText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, color: '#111' },
  rideCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  rideLeft: { flex: 1 },
  rideDate: { fontWeight: '600', fontSize: 15 },
  rideSub: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  rideRight: { alignItems: 'flex-end', marginRight: 12 },
  rideStat: { fontWeight: 'bold', fontSize: 17 },
  rideStatSub: { color: '#9ca3af', fontSize: 12 },
  rideElev: { color: '#f97316', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
