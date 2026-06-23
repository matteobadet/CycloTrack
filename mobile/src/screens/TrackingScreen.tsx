import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { trackingService, TrackStats, TrackPoint } from '../services/trackingService'
import { bleService, BleReadings } from '../services/bleService'
import { saveRideLocally, syncPendingRides } from '../services/offlineStore'
import { startSpotifyPolling, stopSpotifyPolling, SpotifyTrackInfo } from '../services/spotifyMobileService'
import { NavigationService, NavCue } from '../services/navigationService'
import ElevationMiniChart from '../components/ElevationMiniChart'

function getStandaloneNutritionCue(elapsedSec: number): NavCue | null {
  const elapsedMin = elapsedSec / 60
  const hydrationWindow = Math.floor(elapsedMin / 20)
  const foodWindow = Math.floor(elapsedMin / 45)
  const minInHydWindow = elapsedMin % 20
  const minInFoodWindow = elapsedMin % 45
  if (minInHydWindow < 3 && hydrationWindow > 0) {
    return { type: 'nutrition', emoji: '💧', message: 'Bois 150-200ml d\'eau maintenant' }
  }
  if (minInFoodWindow < 3 && foodWindow > 0) {
    const msg = foodWindow % 2 === 1 ? 'Prends une barre énergétique' : 'Prends un gel ou des fruits secs'
    return { type: 'nutrition', emoji: '🍌', message: msg }
  }
  return null
}

function formatEta(remainingM: number, speedKmh: number): string {
  if (speedKmh < 1) return ''
  const remainingSec = (remainingM / 1000) / speedKmh * 3600
  const arrival = new Date(Date.now() + remainingSec * 1000)
  const h = arrival.getHours().toString().padStart(2, '0')
  const min = arrival.getMinutes().toString().padStart(2, '0')
  const distKm = (remainingM / 1000).toFixed(1)
  return `${distKm} km — arrivée ~${h}:${min}`
}

import { api } from '../lib/api'
import { useTheme, Theme } from '../theme'
import LiveMap from '../components/LiveMap'

type Status = 'idle' | 'running' | 'paused'

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function StatBox({ label, value, unit, t }: { label: string; value: string; unit?: string; t: Theme }) {
  return (
    <View style={statBoxStyles(t).box}>
      <Text style={statBoxStyles(t).value}>{value}<Text style={statBoxStyles(t).unit}>{unit}</Text></Text>
      <Text style={statBoxStyles(t).label}>{label}</Text>
    </View>
  )
}

const statBoxStyles = (t: Theme) => StyleSheet.create({
  box: { flex: 1, minWidth: '45%', backgroundColor: t.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: 'bold', color: t.text },
  unit: { fontSize: 13, fontWeight: '400', color: t.textSub },
  label: { fontSize: 11, color: t.textMuted, marginTop: 2 },
})

// Number of consecutive GPS updates off-route before triggering the alert
const OFF_ROUTE_THRESHOLD = 3

export default function TrackingScreen({ route, navigation }: any) {
  const { feelBefore, commentBefore, rideId: initialRideId, plannedRideId } = route.params ?? {}
  const t = useTheme()
  const s = styles(t)
  const [status, setStatus] = useState<Status>('idle')
  const [stats, setStats] = useState<TrackStats | null>(null)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [ble, setBle] = useState<BleReadings>({ bpm: null, watts: null, cadenceRpm: null })
  const [nowPlaying, setNowPlaying] = useState<SpotifyTrackInfo | null>(null)
  const [navCues, setNavCues] = useState<NavCue[]>([])
  const [plannedRouteCoords, setPlannedRouteCoords] = useState<[number, number][] | undefined>()
  const [offRoute, setOffRoute] = useState(false)
  const [batterySaver, setBatterySaverState] = useState(false)
  const [progressM, setProgressM] = useState(0)
  const navServiceRef = useRef<NavigationService | null>(null)
  const rideIdRef = useRef<string | null>(initialRideId ?? null)
  const serverRideIdRef = useRef<string | null>(null)
  const statsRef = useRef<TrackStats | null>(null)
  const bleRef = useRef<BleReadings>({ bpm: null, watts: null, cadenceRpm: null })
  const offRouteCountRef = useRef(0)

  // Screen keep-awake: activate while running
  useEffect(() => {
    if (status === 'running') {
      activateKeepAwakeAsync()
    } else {
      deactivateKeepAwake()
    }
    return () => { deactivateKeepAwake() }
  }, [status])

  // Load planned ride data (route + steps + elevation)
  useEffect(() => {
    if (!plannedRideId) return
    api.get(`/plan/${plannedRideId}`).then(r => {
      const plan = r.data
      if (plan.routePolyline && plan.routeStepsJson && plan.elevationJson) {
        const svc = new NavigationService(plan.routePolyline, plan.routeStepsJson, plan.elevationJson)
        navServiceRef.current = svc
        setPlannedRouteCoords(svc.routeCoords)
      } else if (plan.routePolyline) {
        const svc = new NavigationService(plan.routePolyline, '[]', plan.elevationJson ?? '[]')
        navServiceRef.current = svc
        setPlannedRouteCoords(svc.routeCoords)
      }
    }).catch(() => {})
  }, [plannedRideId])

  useEffect(() => {
    bleService.startScan((readings) => {
      setBle(prev => ({ ...prev, ...readings }))
      bleRef.current = { ...bleRef.current, ...readings }
      trackingService.updateBle(readings)
    })
    return () => { bleService.stopScan() }
  }, [])

  useEffect(() => { statsRef.current = stats }, [stats])

  async function handleStart() {
    const ok = await trackingService.requestPermissions()
    if (!ok) { Alert.alert('Permission GPS requise'); return }
    await trackingService.start((newStats, newPoints) => {
      setStats(newStats)
      setPoints([...newPoints])

      if (newPoints.length > 0) {
        const last = newPoints[newPoints.length - 1]
        const navSvc = navServiceRef.current

        // Navigation cues
        const cues = navSvc
          ? navSvc.getCues(last.lat, last.lng, newStats.durationSec)
          : []
        if (!cues.some(c => c.type === 'nutrition')) {
          const nc = getStandaloneNutritionCue(newStats.durationSec)
          if (nc) cues.push(nc)
        }
        setNavCues(cues)

        // Progress along route
        if (navSvc) {
          const prog = navSvc.distanceAlongRoute(last.lat, last.lng)
          setProgressM(prog)

          // Off-route detection
          const distToRoute = navSvc.minDistToRouteM(last.lat, last.lng)
          if (distToRoute > 150) {
            offRouteCountRef.current++
            if (offRouteCountRef.current >= OFF_ROUTE_THRESHOLD) setOffRoute(true)
          } else {
            offRouteCountRef.current = 0
            setOffRoute(false)
          }
        }
      }
    })
    setStatus('running')

    try {
      const res = await api.post('/rides/start', { startedAt: new Date().toISOString() })
      serverRideIdRef.current = res.data.id
      startPollingForRide(res.data.id)
    } catch {
      // offline — Spotify skipped, ride syncs at end
    }
  }

  function handlePause() { trackingService.pause(); setStatus('paused') }
  async function handleResume() { await trackingService.resume(); setStatus('running') }

  async function handleStop() {
    Alert.alert('Terminer la sortie ?', 'La sortie sera sauvegardée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        onPress: async () => {
          stopSpotifyPolling()
          setNowPlaying(null)
          const { stats: finalStats, points: finalPoints } = trackingService.stop()
          const now = new Date().toISOString()
          const startedAt = finalPoints[0] ? new Date(finalPoints[0].timestamp).toISOString() : now
          const pointsPayload = finalPoints.map(p => ({
            timestamp: new Date(p.timestamp).toISOString(),
            lat: p.lat, lng: p.lng,
            altitudeM: p.altitudeM, speedKmh: p.speedKmh,
            watts: p.watts, bpm: p.bpm, cadenceRpm: p.cadenceRpm,
          }))

          let finalRideId: string
          if (serverRideIdRef.current) {
            finalRideId = serverRideIdRef.current
            await api.patch(`/rides/${finalRideId}/complete`, {
              endedAt: now,
              distanceKm: finalStats.distanceKm,
              durationSec: finalStats.durationSec,
              elevationGainM: finalStats.elevationGainM,
              elevationLossM: finalStats.elevationLossM,
              avgSpeedKmh: finalStats.avgSpeedKmh,
              maxSpeedKmh: finalStats.maxSpeedKmh,
              avgWatts: finalStats.avgWatts ?? null,
              maxWatts: finalStats.maxWatts ?? null,
              avgCadenceRpm: finalStats.avgCadenceRpm ?? null,
              avgBpm: finalStats.avgBpm ?? null,
              maxBpm: finalStats.maxBpm ?? null,
              caloriesBurned: finalStats.caloriesBurned,
              feelBefore: feelBefore ?? null,
              commentBefore: commentBefore ?? null,
              points: pointsPayload,
            }).catch(async () => {
              const localId = `local-${Date.now()}`
              await saveRideLocally({ localId, startedAt, endedAt: now, stats: finalStats, points: finalPoints, feelBefore, commentBefore })
              finalRideId = localId
            })
          } else {
            const localId = `local-${Date.now()}`
            await saveRideLocally({ localId, startedAt, endedAt: now, stats: finalStats, points: finalPoints, feelBefore, commentBefore })
            await syncPendingRides().catch(() => null)
            finalRideId = localId
          }

          bleService.disconnect()
          navigation.replace('RideSummary', { stats: finalStats, points: finalPoints, rideId: finalRideId, plannedRideId })
        },
      },
    ])
  }

  async function toggleBatterySaver() {
    const next = !batterySaver
    setBatterySaverState(next)
    await trackingService.setBatterySaver(next)
  }

  function startPollingForRide(rideId: string) {
    rideIdRef.current = rideId
    startSpotifyPolling(
      rideId,
      () => ({
        currentSpeedKmh: statsRef.current?.avgSpeedKmh,
        currentWatts: bleRef.current.watts ?? undefined,
        currentBpm: bleRef.current.bpm ?? undefined,
        elevDeltaM: undefined,
      }),
      setNowPlaying
    )
  }

  const lastPoint = points[points.length - 1]
  const navSvc = navServiceRef.current
  const totalDistM = navSvc?.totalDistM ?? 0

  // ETA
  const etaText = navSvc && stats && stats.avgSpeedKmh > 1 && totalDistM > 0
    ? formatEta(Math.max(0, totalDistM - progressM), stats.avgSpeedKmh)
    : null

  // Priority cue (off-route overrides everything)
  const primaryCue = offRoute
    ? { type: 'turn' as const, emoji: '↩️', message: 'Hors itinéraire — revenez sur le tracé' }
    : (navCues.find(c => c.type === 'turn' || c.type === 'arrival')
      ?? navCues.find(c => c.type === 'elevation')
      ?? navCues.find(c => c.type === 'nutrition'))

  const showElevChart = navSvc && navSvc.elevProfile.length > 0 && totalDistM > 0

  return (
    <View style={s.container}>
      <View style={s.mapWrapper}>
        <LiveMap points={points} plannedCoords={plannedRouteCoords} style={StyleSheet.absoluteFillObject} />
        {primaryCue && (
          <View style={[
            s.navBanner,
            offRoute ? s.navBannerOffRoute
              : primaryCue.type === 'turn' || primaryCue.type === 'arrival' ? s.navBannerTurn
              : primaryCue.type === 'elevation' ? s.navBannerElev
              : s.navBannerNutrition,
          ]}>
            <Text style={s.navBannerEmoji}>{primaryCue.emoji}</Text>
            <Text style={s.navBannerText} numberOfLines={2}>{primaryCue.message}</Text>
          </View>
        )}
      </View>

      {/* Elevation profile */}
      {showElevChart && (
        <ElevationMiniChart
          elevProfile={navSvc!.elevProfile}
          progressM={progressM}
          totalDistM={totalDistM}
        />
      )}

      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
        <Text style={s.timer}>{stats ? formatDuration(stats.durationSec) : '00:00:00'}</Text>

        {/* ETA */}
        {etaText && (
          <View style={s.etaRow}>
            <Text style={s.etaText}>🏁 {etaText}</Text>
          </View>
        )}

        <View style={s.statsGrid}>
          <StatBox label="Distance" value={stats ? stats.distanceKm.toFixed(2) : '0.00'} unit=" km" t={t} />
          <StatBox label="Vitesse" value={stats ? stats.avgSpeedKmh.toFixed(1) : '0.0'} unit=" km/h" t={t} />
          <StatBox label="Dénivelé +" value={stats ? stats.elevationGainM.toFixed(0) : '0'} unit=" m" t={t} />
          <StatBox label="Calories" value={stats ? String(stats.caloriesBurned) : '0'} unit=" kcal" t={t} />
        </View>

        <View style={s.bleRow}>
          <View style={[s.bleChip, !ble.bpm && s.bleChipOff]}>
            <Text style={s.bleChipText}>❤️ {ble.bpm ? `${ble.bpm} bpm` : '-- bpm'}</Text>
          </View>
          <View style={[s.bleChip, !ble.watts && s.bleChipOff]}>
            <Text style={s.bleChipText}>⚡ {ble.watts ? `${ble.watts} W` : '-- W'}</Text>
          </View>
          <View style={[s.bleChip, !ble.cadenceRpm && s.bleChipOff]}>
            <Text style={s.bleChipText}>🔄 {ble.cadenceRpm ? `${ble.cadenceRpm} rpm` : '-- rpm'}</Text>
          </View>
        </View>

        {nowPlaying && (
          <View style={s.spotifyCard}>
            {nowPlaying.albumArtUrl ? (
              <Image source={{ uri: nowPlaying.albumArtUrl }} style={s.albumArt} />
            ) : (
              <View style={[s.albumArt, { backgroundColor: t.inputBg, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 20 }}>🎵</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.spotifyTrack} numberOfLines={1}>{nowPlaying.trackName}</Text>
              <Text style={s.spotifyArtist} numberOfLines={1}>{nowPlaying.artistName}</Text>
              {nowPlaying.tempo && (
                <Text style={s.spotifyTempo}>{Math.round(nowPlaying.tempo)} BPM</Text>
              )}
            </View>
          </View>
        )}

        <View style={s.controls}>
          {status === 'idle' && (
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: t.green }]} onPress={handleStart}>
              <Text style={s.ctrlBtnText}>▶ Démarrer</Text>
            </TouchableOpacity>
          )}
          {status === 'running' && (<>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: t.amber }]} onPress={handlePause}>
              <Text style={s.ctrlBtnText}>⏸ Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: t.red }]} onPress={handleStop}>
              <Text style={s.ctrlBtnText}>⏹ Terminer</Text>
            </TouchableOpacity>
          </>)}
          {status === 'paused' && (<>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: t.green }]} onPress={handleResume}>
              <Text style={s.ctrlBtnText}>▶ Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: t.red }]} onPress={handleStop}>
              <Text style={s.ctrlBtnText}>⏹ Terminer</Text>
            </TouchableOpacity>
          </>)}
        </View>

        {/* Battery saver toggle (only visible while running) */}
        {status !== 'idle' && (
          <TouchableOpacity
            style={[s.saverBtn, batterySaver && s.saverBtnActive]}
            onPress={toggleBatterySaver}
          >
            <Text style={[s.saverBtnText, batterySaver && s.saverBtnTextActive]}>
              🔋 Mode économie batterie {batterySaver ? 'ON (GPS 1/5s)' : 'OFF (GPS 1/2s)'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  mapWrapper: { flex: 1, borderBottomWidth: 1, borderBottomColor: t.border },
  map: { flex: 1 },
  navBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  navBannerTurn: { backgroundColor: 'rgba(37,99,235,0.92)' },
  navBannerElev: { backgroundColor: 'rgba(234,88,12,0.90)' },
  navBannerNutrition: { backgroundColor: 'rgba(22,163,74,0.90)' },
  navBannerOffRoute: { backgroundColor: 'rgba(220,38,38,0.95)' },
  navBannerEmoji: { fontSize: 22 },
  navBannerText: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  panel: { maxHeight: 400 },
  panelContent: { padding: 16 },
  timer: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2, color: t.text, marginBottom: 8 },
  etaRow: { alignItems: 'center', marginBottom: 12 },
  etaText: { fontSize: 13, color: t.textSub, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  bleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bleChip: { flex: 1, backgroundColor: t.card, borderRadius: 20, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: t.blue },
  bleChipOff: { borderColor: t.border },
  bleChipText: { fontSize: 13, fontWeight: '600', color: t.text },
  spotifyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#1db954' },
  albumArt: { width: 44, height: 44, borderRadius: 6 },
  spotifyTrack: { fontSize: 13, fontWeight: '700', color: t.text },
  spotifyArtist: { fontSize: 12, color: t.textSub },
  spotifyTempo: { fontSize: 11, color: '#1db954', marginTop: 2 },
  controls: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ctrlBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
  ctrlBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  saverBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  saverBtnActive: { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.12)' },
  saverBtnText: { fontSize: 12, color: t.textMuted },
  saverBtnTextActive: { color: '#16a34a', fontWeight: '600' },
})
