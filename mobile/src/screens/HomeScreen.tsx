import React, { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
  StatusBar, ScrollView,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { syncPendingRides, getPendingCount } from '../services/offlineStore'
import { useTheme, useThemeStore, useIsDark, Theme } from '../theme'
import { openSpotifyAuth, getSpotifyStatus, unlinkSpotify } from '../services/spotifyMobileService'

interface RideSummary {
  id: string
  startedAt: string
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  elevationGainM: number
  caloriesBurned: number
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function weeklyStats(rides: RideSummary[]) {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const recent = rides.filter(r => new Date(r.startedAt).getTime() >= weekAgo && r.distanceKm > 0)
  return {
    count: recent.length,
    km: recent.reduce((s, r) => s + r.distanceKm, 0),
    elev: recent.reduce((s, r) => s + r.elevationGainM, 0),
    kcal: recent.reduce((s, r) => s + r.caloriesBurned, 0),
  }
}

export default function HomeScreen({ navigation }: any) {
  const t = useTheme()
  const s = styles(t)
  const isDark = useIsDark()
  const setOverride = useThemeStore(st => st.setOverride)
  const user = useAuthStore(st => st.user)
  const logout = useAuthStore(st => st.logout)
  const [rides, setRides] = useState<RideSummary[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [spotifyLinked, setSpotifyLinked] = useState(false)

  useFocusEffect(useCallback(() => { loadData() }, []))

  async function loadData() {
    setPendingCount(getPendingCount())
    try {
      const { data } = await api.get('/rides?pageSize=20')
      setRides(data)
    } catch {}
    const linked = await getSpotifyStatus()
    setSpotifyLinked(linked)
  }

  async function handleSpotifyToggle() {
    if (spotifyLinked) {
      Alert.alert('Spotify', 'Déconnecter Spotify ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: async () => { await unlinkSpotify(); setSpotifyLinked(false) } },
      ])
    } else {
      await openSpotifyAuth()
      const linked = await getSpotifyStatus()
      setSpotifyLinked(linked)
    }
  }

  async function handleSync() {
    const synced = await syncPendingRides()
    Alert.alert('Synchronisation', `${synced} sortie(s) synchronisée(s).`)
    loadData()
  }

  const week = weeklyStats(rides)
  const meaningfulRides = rides.filter(r => r.distanceKm > 0)

  return (
    <View style={s.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarText}>{(user?.pseudo ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Bonjour, {user?.pseudo} 👋</Text>
          {pendingCount > 0 && (
            <TouchableOpacity onPress={handleSync}>
              <Text style={s.syncBadge}>⚠️ {pendingCount} sortie(s) à synchroniser</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setOverride(isDark ? 'light' : 'dark')} style={s.iconBtn}>
          <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={[s.iconBtn, { marginLeft: 6 }]}>
          <Text style={s.logoutIcon}>⎋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={meaningfulRides}
        keyExtractor={r => r.id}
        onRefresh={loadData}
        refreshing={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            {/* Quick actions */}
            <View style={s.actions}>
              <TouchableOpacity style={s.actionPrimary} onPress={() => navigation.navigate('PreRide')} activeOpacity={0.85}>
                <Text style={s.actionIcon}>🚴</Text>
                <Text style={s.actionPrimaryText}>Nouvelle{'\n'}sortie</Text>
              </TouchableOpacity>
              <View style={s.actionsCol}>
                <TouchableOpacity style={s.actionSecondary} onPress={() => navigation.navigate('PlannedRides')} activeOpacity={0.85}>
                  <Text style={s.actionSecondaryIcon}>🗓️</Text>
                  <Text style={s.actionSecondaryText}>Planifications</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionSecondary, spotifyLinked && s.actionSpotifyLinked]}
                  onPress={handleSpotifyToggle}
                  activeOpacity={0.85}
                >
                  <Text style={s.actionSecondaryIcon}>🎵</Text>
                  <Text style={[s.actionSecondaryText, spotifyLinked && { color: '#1db954' }]}>
                    {spotifyLinked ? 'Spotify ✓' : 'Spotify'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekly stats */}
            {week.count > 0 && (
              <View style={s.weekCard}>
                <Text style={s.weekTitle}>Cette semaine</Text>
                <View style={s.weekRow}>
                  {[
                    { val: `${week.km.toFixed(0)} km`, label: 'Distance' },
                    { val: `↑${week.elev.toFixed(0)} m`, label: 'Dénivelé' },
                    { val: `${week.count}`, label: 'Sorties' },
                    { val: `${week.kcal.toFixed(0)}`, label: 'kcal' },
                  ].map(item => (
                    <View key={item.label} style={s.weekStat}>
                      <Text style={s.weekStatVal}>{item.val}</Text>
                      <Text style={s.weekStatLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={s.sectionTitle}>Dernières sorties</Text>
          </>
        }
        renderItem={({ item: r }) => (
          <TouchableOpacity style={s.rideCard} onPress={() => navigation.navigate('RideDetail', { rideId: r.id })} activeOpacity={0.75}>
            <View style={s.rideAccent} />
            <View style={s.rideBody}>
              <View style={s.rideTop}>
                <Text style={s.rideDate}>
                  {new Date(r.startedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <Text style={s.rideDist}>{r.distanceKm.toFixed(1)} km</Text>
              </View>
              <View style={s.rideBottom}>
                <Text style={s.rideSub}>{formatDuration(r.durationSec)} · {r.caloriesBurned} kcal</Text>
                <View style={s.rideStats}>
                  <Text style={s.rideSpeed}>{r.avgSpeedKmh.toFixed(1)} km/h</Text>
                  <Text style={s.rideElev}>↑{r.elevationGainM.toFixed(0)} m</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🚲</Text>
            <Text style={s.emptyText}>Aucune sortie enregistrée</Text>
            <Text style={s.emptyHint}>Lance ta première sortie avec le bouton ci-dessus</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, gap: 10 },
  avatarWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  greeting: { fontSize: 16, fontWeight: '700', color: t.text },
  syncBadge: { fontSize: 11, color: t.amber, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  logoutIcon: { fontSize: 16, color: t.textSub },

  // Actions grid
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  actionPrimary: {
    flex: 1.1, backgroundColor: t.green, borderRadius: 18, padding: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: t.green, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
    minHeight: 130,
  },
  actionIcon: { fontSize: 34, marginBottom: 6 },
  actionPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 22 },
  actionsCol: { flex: 1, gap: 10 },
  actionSecondary: {
    flex: 1, backgroundColor: t.card, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: t.border,
  },
  actionSecondaryIcon: { fontSize: 22, marginBottom: 4 },
  actionSecondaryText: { color: t.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actionSpotifyLinked: { borderColor: '#1db954' },

  // Weekly stats
  weekCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: t.card, borderRadius: 16,
    borderWidth: 1, borderColor: t.border,
    padding: 14,
  },
  weekTitle: { fontSize: 12, fontWeight: '600', color: t.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekStat: { alignItems: 'center', flex: 1 },
  weekStatVal: { fontSize: 15, fontWeight: '700', color: t.text },
  weekStatLabel: { fontSize: 11, color: t.textMuted, marginTop: 2 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '700', color: t.text, paddingHorizontal: 16, marginBottom: 10 },

  // Ride cards
  rideCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: t.card, borderRadius: 14,
    borderWidth: 1, borderColor: t.border,
    overflow: 'hidden',
  },
  rideAccent: { width: 4, backgroundColor: t.blue },
  rideBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rideDate: { fontWeight: '600', fontSize: 14, color: t.text },
  rideDist: { fontWeight: '800', fontSize: 17, color: t.text },
  rideBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideSub: { color: t.textMuted, fontSize: 12 },
  rideStats: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rideSpeed: { color: t.textSub, fontSize: 12 },
  rideElev: { color: t.orange, fontWeight: '600', fontSize: 12 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: t.textSub },
  emptyHint: { fontSize: 13, color: t.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
})
