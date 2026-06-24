import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { trackingService, TrackStats, TrackPoint } from '../services/trackingService'
import { bleService, BleReadings } from '../services/bleService'
import { saveRideLocally, syncPendingRides } from '../services/offlineStore'
import { startSpotifyPolling, stopSpotifyPolling, SpotifyTrackInfo, openSpotifyAuth, getSpotifyStatus, spotifyPlay, spotifyPause, spotifyNext, spotifyPrevious } from '../services/spotifyMobileService'
import { NavigationService, NavCue } from '../services/navigationService'
import ElevationMiniChart from '../components/ElevationMiniChart'

// ── Parse AI plan phases for mobile display ──
interface AiPhase { fromKm: number; toKm: number; label: string; target: string }

function parseAiPhases(advice: string): AiPhase[] {
  const phases: AiPhase[] = []
  const lines = advice.split('\n')
  // Match patterns like: "Phase 1 : km 0 → 15" or "Phase 1 : km 0→15" or "km 0 → 4.0 (avant la montée)"
  const phaseRe = /(?:phase\s+\d+\s*:?\s*)?km\s*([\d.]+)\s*[→→-]+\s*([\d.]+)/i
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(phaseRe)
    if (!m) continue
    const fromKm = parseFloat(m[1])
    const toKm = parseFloat(m[2])
    // Grab label from same line (text after the km range)
    const labelMatch = lines[i].match(/\(([^)]+)\)/) || lines[i].match(/[-–:]\s*(.+)$/)
    const label = labelMatch ? labelMatch[1].replace(/\*/g, '').trim() : `Phase km ${fromKm}→${toKm}`
    // Collect target info from next few bullet lines
    const targetLines: string[] = []
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const l = lines[j].trim()
      if (!l || l.match(/^#{1,3}/) || l.match(/^phase\s+\d/i)) break
      if (l.startsWith('-') || l.startsWith('*')) {
        const txt = l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')
        // Only keep power/FC/tactical lines, skip long nutritional ones
        if (txt.match(/W|bpm|FC|puissance|Z[1-5]|km\/h|cadence|relancer|gérer|descente|montée/i) && txt.length < 100) {
          targetLines.push(txt)
        }
        if (targetLines.length >= 2) break
      }
    }
    phases.push({ fromKm, toKm, label, target: targetLines.join(' · ') || '' })
  }
  return phases
}

function getCurrentPhase(phases: AiPhase[], progressKm: number): AiPhase | null {
  // Find the phase that contains current distance, with 0.3km lookahead
  return phases.find(p => progressKm >= p.fromKm - 0.3 && progressKm < p.toKm) ?? null
}

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
  const [ble, setBle] = useState<BleReadings>({ bpm: null, watts: null, cadenceRpm: null, speedKmh: null })
  const [conn, setConn] = useState(() => bleService.connectionStatus)
  const [tab, setTab] = useState<'map' | 'stats' | 'spotify'>('map')
  const [nowPlaying, setNowPlaying] = useState<SpotifyTrackInfo | null>(null)
  const [spotifyLinked, setSpotifyLinked] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [navCues, setNavCues] = useState<NavCue[]>([])
  const [plannedRouteCoords, setPlannedRouteCoords] = useState<[number, number][] | undefined>()
  const [aiPhases, setAiPhases] = useState<AiPhase[]>([])
  const [offRoute, setOffRoute] = useState(false)
  const [batterySaver, setBatterySaverState] = useState(false)
  const [progressM, setProgressM] = useState(0)
  const navServiceRef = useRef<NavigationService | null>(null)
  const rideIdRef = useRef<string | null>(initialRideId ?? null)
  const serverRideIdRef = useRef<string | null>(null)
  const statsRef = useRef<TrackStats | null>(null)
  const bleRef = useRef<BleReadings>({ bpm: null, watts: null, cadenceRpm: null })
  const offRouteCountRef = useRef(0)

  // Check Spotify link status on mount
  useEffect(() => {
    getSpotifyStatus().then(setSpotifyLinked)
  }, [])

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
      if (plan.aiAdvice) {
        setAiPhases(parseAiPhases(plan.aiAdvice))
      }
    }).catch(() => {})
  }, [plannedRideId])

  useEffect(() => {
    const onBle = (readings: Partial<import('../services/bleService').BleReadings>) => {
      setBle(prev => ({ ...prev, ...readings }))
      bleRef.current = { ...bleRef.current, ...readings }
      trackingService.updateBle(readings)
    }
    bleService.addReadingsListener(onBle)
    bleService.addStatusListener(setConn)
    bleService.startScan()
    return () => {
      bleService.removeReadingsListener(onBle)
      bleService.removeStatusListener(setConn)
      bleService.stopScan()
    }
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

  async function handleSpotifyConnect() {
    setSpotifyLoading(true)
    const ok = await openSpotifyAuth()
    setSpotifyLoading(false)
    setSpotifyLinked(ok)
    if (ok) {
      // Start polling immediately even before a ride starts
      const pollId = serverRideIdRef.current ?? rideIdRef.current ?? 'local'
      startPollingForRide(pollId)
    }
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

  // BLE chips — only slots actually connected
  const bleChips = [
    conn.hr === 'connected'      && { key: 'hr',  icon: '❤️', value: ble.bpm      ? `${ble.bpm} bpm`        : '…' },
    conn.power === 'connected'   && { key: 'pwr', icon: '⚡', value: ble.watts     ? `${ble.watts} W`        : '…' },
    conn.cadence === 'connected' && { key: 'cad', icon: '🔄', value: ble.cadenceRpm ? `${ble.cadenceRpm} rpm` : '…' },
    conn.speed === 'connected'   && { key: 'spd', icon: '💨', value: ble.speedKmh  ? `${ble.speedKmh} km/h`  : '…' },
  ].filter(Boolean) as { key: string; icon: string; value: string }[]

  // Controls bar (always visible)
  const Controls = () => (
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
  )

  return (
    <View style={s.container}>

      {/* ── MAP (always visible, shrinks on stats/spotify tabs) ── */}
      <View style={[s.mapWrapper, tab !== 'map' && s.mapWrapperSmall]}>
        <LiveMap points={points} plannedCoords={plannedRouteCoords} style={StyleSheet.absoluteFillObject} />

        {/* Nav banner */}
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

        {/* Map tab: key stats overlay (timer + speed + distance) */}
        {tab === 'map' && (
          <View style={s.mapOverlay}>
            <Text style={s.mapTimer}>{stats ? formatDuration(stats.durationSec) : '00:00:00'}</Text>
            <View style={s.mapStatRow}>
              <View style={s.mapStat}>
                <Text style={s.mapStatVal}>{stats ? stats.distanceKm.toFixed(2) : '0.00'}</Text>
                <Text style={s.mapStatLabel}>km</Text>
              </View>
              <View style={s.mapStatDivider} />
              <View style={s.mapStat}>
                <Text style={s.mapStatVal}>{stats ? stats.avgSpeedKmh.toFixed(1) : '0.0'}</Text>
                <Text style={s.mapStatLabel}>km/h</Text>
              </View>
              <View style={s.mapStatDivider} />
              <View style={s.mapStat}>
                <Text style={s.mapStatVal}>{stats ? stats.elevationGainM.toFixed(0) : '0'}</Text>
                <Text style={s.mapStatLabel}>m D+</Text>
              </View>
              {bleChips.length > 0 && <View style={s.mapStatDivider} />}
              {bleChips.map(c => (
                <View key={c.key} style={s.mapStat}>
                  <Text style={s.mapStatVal}>{c.value}</Text>
                  <Text style={s.mapStatLabel}>{c.icon}</Text>
                </View>
              ))}
            </View>
            {etaText && <Text style={s.mapEta}>🏁 {etaText}</Text>}
          </View>
        )}
      </View>

      {/* Elevation chart */}
      {showElevChart && (
        <ElevationMiniChart elevProfile={navSvc!.elevProfile} progressM={progressM} totalDistM={totalDistM} />
      )}

      {/* ── TAB BAR ── */}
      <View style={s.tabBar}>
        {([['map', '🗺️', 'Carte'], ['stats', '📊', 'Stats'], ['spotify', '🎵', 'Musique']] as const).map(([key, icon, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={s.tabIcon}>{icon}</Text>
            <Text style={[s.tabLabel, tab === key && s.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PANELS ── */}
      {tab === 'map' && (
        <View style={s.panelControls}>
          <Controls />
          {status !== 'idle' && (
            <TouchableOpacity style={[s.saverBtn, batterySaver && s.saverBtnActive]} onPress={toggleBatterySaver}>
              <Text style={[s.saverBtnText, batterySaver && s.saverBtnTextActive]}>
                🔋 Éco batterie {batterySaver ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {tab === 'stats' && (
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          <Text style={s.timer}>{stats ? formatDuration(stats.durationSec) : '00:00:00'}</Text>
          {etaText && <View style={s.etaRow}><Text style={s.etaText}>🏁 {etaText}</Text></View>}

          {aiPhases.length > 0 && status === 'running' && (() => {
            const phase = getCurrentPhase(aiPhases, progressM / 1000)
            if (!phase) return null
            return (
              <View style={s.phaseCard}>
                <Text style={s.phaseLabel}>🎯 {phase.label}</Text>
                {phase.target ? <Text style={s.phaseTarget}>{phase.target}</Text> : null}
                <Text style={s.phaseKm}>km {phase.fromKm.toFixed(1)} → {phase.toKm.toFixed(1)}</Text>
              </View>
            )
          })()}

          <View style={s.statsGrid}>
            <StatBox label="Distance"  value={stats ? stats.distanceKm.toFixed(2) : '0.00'} unit=" km"   t={t} />
            <StatBox label="Vitesse"   value={stats ? stats.avgSpeedKmh.toFixed(1) : '0.0'}  unit=" km/h" t={t} />
            <StatBox label="Vit. max"  value={stats ? stats.maxSpeedKmh.toFixed(1) : '0.0'}  unit=" km/h" t={t} />
            <StatBox label="Dénivelé +" value={stats ? stats.elevationGainM.toFixed(0) : '0'} unit=" m"  t={t} />
            <StatBox label="Calories"  value={stats ? String(stats.caloriesBurned) : '0'}    unit=" kcal" t={t} />
            {ble.bpm      !== null && <StatBox label="Fréq. cardiaque" value={String(ble.bpm)}      unit=" bpm"   t={t} />}
            {ble.watts    !== null && <StatBox label="Puissance"       value={String(ble.watts)}    unit=" W"     t={t} />}
            {ble.cadenceRpm !== null && <StatBox label="Cadence"       value={String(ble.cadenceRpm)} unit=" rpm" t={t} />}
            {ble.speedKmh !== null && <StatBox label="Vit. capteur"   value={String(ble.speedKmh)} unit=" km/h"  t={t} />}
          </View>

          <Controls />
          {status !== 'idle' && (
            <TouchableOpacity style={[s.saverBtn, batterySaver && s.saverBtnActive]} onPress={toggleBatterySaver}>
              <Text style={[s.saverBtnText, batterySaver && s.saverBtnTextActive]}>
                🔋 Éco batterie {batterySaver ? 'ON (GPS 1/5s)' : 'OFF (GPS 1/2s)'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {tab === 'spotify' && (
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          {!spotifyLinked ? (
            <View style={s.spotifyEmpty}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🎵</Text>
              <Text style={s.spotifyEmptyText}>Connecte ton compte Spotify pour voir la musique en cours</Text>
              <TouchableOpacity
                style={[s.spotifyConnectBtn, spotifyLoading && { opacity: 0.6 }]}
                onPress={handleSpotifyConnect}
                disabled={spotifyLoading}
              >
                <Text style={s.spotifyConnectText}>{spotifyLoading ? 'Connexion…' : '🔗 Connecter Spotify'}</Text>
              </TouchableOpacity>
            </View>
          ) : nowPlaying ? (
            <View style={s.spotifyFull}>
              {nowPlaying.albumArtUrl ? (
                <Image source={{ uri: nowPlaying.albumArtUrl }} style={s.albumArtLarge} />
              ) : (
                <View style={[s.albumArtLarge, { backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 48 }}>🎵</Text>
                </View>
              )}
              <Text style={s.spotifyTrack} numberOfLines={2}>{nowPlaying.trackName}</Text>
              <Text style={s.spotifyArtist}>{nowPlaying.artistName}</Text>
              <View style={s.spotifyControls}>
                <TouchableOpacity style={s.spotifyCtrlBtn} onPress={() => { spotifyPrevious(); setTimeout(() => startPollingForRide(serverRideIdRef.current ?? 'local'), 800) }}>
                  <Text style={s.spotifyCtrlIcon}>⏮</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.spotifyCtrlBtn, s.spotifyCtrlBtnMain]} onPress={() => {
                  if (nowPlaying.isPlaying) spotifyPause()
                  else spotifyPlay()
                  setTimeout(() => startPollingForRide(serverRideIdRef.current ?? 'local'), 800)
                }}>
                  <Text style={[s.spotifyCtrlIcon, { fontSize: 28, color: '#fff' }]}>{nowPlaying.isPlaying ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.spotifyCtrlBtn} onPress={() => { spotifyNext(); setTimeout(() => startPollingForRide(serverRideIdRef.current ?? 'local'), 800) }}>
                  <Text style={s.spotifyCtrlIcon}>⏭</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.spotifyEmpty}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🎵</Text>
              <Text style={s.spotifyEmptyText}>Lance Spotify sur ton téléphone pour voir la musique ici</Text>
            </View>
          )}
          <Controls />
        </ScrollView>
      )}
    </View>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: t.bg },

  // Map
  mapWrapper:       { flex: 1 },
  mapWrapperSmall:  { flex: 0, height: 140 },
  navBanner:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  navBannerTurn:    { backgroundColor: 'rgba(37,99,235,0.92)' },
  navBannerElev:    { backgroundColor: 'rgba(234,88,12,0.90)' },
  navBannerNutrition: { backgroundColor: 'rgba(22,163,74,0.90)' },
  navBannerOffRoute:{ backgroundColor: 'rgba(220,38,38,0.95)' },
  navBannerEmoji:   { fontSize: 22 },
  navBannerText:    { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },

  // Map overlay stats (tab=map)
  mapOverlay:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', padding: 10 },
  mapTimer:         { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2, marginBottom: 6 },
  mapStatRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  mapStat:          { alignItems: 'center', paddingHorizontal: 8 },
  mapStatVal:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  mapStatLabel:     { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  mapStatDivider:   { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.3)' },
  mapEta:           { color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center', marginTop: 4 },

  // Tab bar
  tabBar:           { flexDirection: 'row', backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.border },
  tab:              { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabActive:        { borderTopWidth: 2, borderTopColor: t.blue },
  tabIcon:          { fontSize: 18 },
  tabLabel:         { fontSize: 10, color: t.textMuted },
  tabLabelActive:   { color: t.blue, fontWeight: '600' },

  // Panels
  panelControls:    { padding: 16 },
  panel:            { flex: 1 },
  panelContent:     { padding: 16 },

  timer:            { fontSize: 44, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2, color: t.text, marginBottom: 8 },
  etaRow:           { alignItems: 'center', marginBottom: 12 },
  etaText:          { fontSize: 13, color: t.textSub, fontWeight: '600' },
  phaseCard:        { backgroundColor: '#7c3aed22', borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed66', padding: 12, marginBottom: 12 },
  phaseLabel:       { fontSize: 13, fontWeight: '700', color: '#a78bfa', marginBottom: 3 },
  phaseTarget:      { fontSize: 12, color: t.text, marginBottom: 3, lineHeight: 18 },
  phaseKm:          { fontSize: 11, color: t.textMuted },
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },

  controls:         { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ctrlBtn:          { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
  ctrlBtnText:      { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  saverBtn:         { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  saverBtnActive:   { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.12)' },
  saverBtnText:     { fontSize: 12, color: t.textMuted },
  saverBtnTextActive: { color: '#16a34a', fontWeight: '600' },

  // Spotify
  spotifyFull:      { alignItems: 'center', paddingVertical: 20, gap: 12 },
  albumArtLarge:    { width: 180, height: 180, borderRadius: 16, marginBottom: 8 },
  spotifyTrack:     { fontSize: 20, fontWeight: '700', color: t.text, textAlign: 'center' },
  spotifyArtist:    { fontSize: 15, color: t.textSub, textAlign: 'center' },
  spotifyTempo:     { fontSize: 13, color: '#1db954', fontWeight: '600' },
  spotifyControls:      { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 20 },
  spotifyCtrlBtn:       { width: 56, height: 56, borderRadius: 28, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
  spotifyCtrlBtnMain:   { width: 68, height: 68, borderRadius: 34, backgroundColor: '#1db954' },
  spotifyCtrlIcon:      { fontSize: 22, color: t.text },
  spotifyHint:          { fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 8 },
  spotifyEmpty:      { alignItems: 'center', paddingVertical: 40 },
  spotifyEmptyText:  { color: t.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  spotifyConnectBtn: { backgroundColor: '#1db954', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 4 },
  spotifyConnectText:{ color: '#fff', fontWeight: 'bold', fontSize: 15 },
})
