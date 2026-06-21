import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { trackingService, TrackStats, TrackPoint } from '../services/trackingService'
import { bleService, BleReadings } from '../services/bleService'
import { saveRideLocally, syncPendingRides } from '../services/offlineStore'
import { useAuthStore } from '../stores/authStore'

type Status = 'idle' | 'running' | 'paused'

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}<Text style={s.statUnit}>{unit}</Text></Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

export default function TrackingScreen({ route, navigation }: any) {
  const { feelBefore, commentBefore } = route.params ?? {}
  const [status, setStatus] = useState<Status>('idle')
  const [stats, setStats] = useState<TrackStats | null>(null)
  const [points, setPoints] = useState<TrackPoint[]>([])
  const [ble, setBle] = useState<BleReadings>({ bpm: null, watts: null, cadenceRpm: null })
  const mapRef = useRef<MapView>(null)

  useEffect(() => {
    // Brancher les lectures BLE sur le service de tracking
    bleService.startScan((readings) => {
      setBle(prev => ({ ...prev, ...readings }))
      trackingService.updateBle(readings)
    })
    return () => { bleService.stopScan() }
  }, [])

  async function handleStart() {
    const ok = await trackingService.requestPermissions()
    if (!ok) { Alert.alert('Permission GPS requise'); return }
    await trackingService.start((newStats, newPoints) => {
      setStats(newStats)
      setPoints([...newPoints])
      // Recentrer la carte sur la dernière position
      if (newPoints.length > 0 && mapRef.current) {
        const last = newPoints[newPoints.length - 1]
        mapRef.current.animateCamera({ center: { latitude: last.lat, longitude: last.lng } }, { duration: 500 })
      }
    })
    setStatus('running')
  }

  function handlePause() {
    trackingService.pause()
    setStatus('paused')
  }

  async function handleResume() {
    await trackingService.resume()
    setStatus('running')
  }

  async function handleStop() {
    Alert.alert('Terminer la sortie ?', 'La sortie sera sauvegardée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        onPress: async () => {
          const { stats: finalStats, points: finalPoints } = trackingService.stop()
          const now = new Date().toISOString()
          const rideId = `local-${Date.now()}`
          await saveRideLocally({
            localId: rideId,
            startedAt: finalPoints[0]
              ? new Date(finalPoints[0].timestamp).toISOString()
              : now,
            endedAt: now,
            stats: finalStats,
            points: finalPoints,
            feelBefore,
            commentBefore,
          })
          // Tenter de synchro immédiatement si réseau disponible
          syncPendingRides().catch(() => {})
          bleService.disconnect()
          navigation.replace('RideSummary', { stats: finalStats, points: finalPoints, rideId })
        },
      },
    ])
  }

  const coords = points.map(p => ({ latitude: p.lat, longitude: p.lng }))
  const lastPoint = points[points.length - 1]

  return (
    <View style={s.container}>
      {/* Carte */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={lastPoint ? {
          latitude: lastPoint.lat, longitude: lastPoint.lng,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        } : undefined}
      >
        {coords.length > 1 && (
          <Polyline coordinates={coords} strokeColor="#2563eb" strokeWidth={4} />
        )}
      </MapView>

      {/* Stats panel */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
        <Text style={s.timer}>{stats ? formatDuration(stats.durationSec) : '00:00:00'}</Text>

        <View style={s.statsGrid}>
          <StatBox label="Distance" value={stats ? stats.distanceKm.toFixed(2) : '0.00'} unit=" km" />
          <StatBox label="Vitesse" value={stats ? stats.avgSpeedKmh.toFixed(1) : '0.0'} unit=" km/h" />
          <StatBox label="Dénivelé +" value={stats ? stats.elevationGainM.toFixed(0) : '0'} unit=" m" />
          <StatBox label="Calories" value={stats ? String(stats.caloriesBurned) : '0'} unit=" kcal" />
        </View>

        {/* Données capteurs BLE */}
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

        {/* Contrôles */}
        <View style={s.controls}>
          {status === 'idle' && (
            <TouchableOpacity style={[s.ctrlBtn, s.startBtn]} onPress={handleStart}>
              <Text style={s.ctrlBtnText}>▶ Démarrer</Text>
            </TouchableOpacity>
          )}
          {status === 'running' && (<>
            <TouchableOpacity style={[s.ctrlBtn, s.pauseBtn]} onPress={handlePause}>
              <Text style={s.ctrlBtnText}>⏸ Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, s.stopBtn]} onPress={handleStop}>
              <Text style={s.ctrlBtnText}>⏹ Terminer</Text>
            </TouchableOpacity>
          </>)}
          {status === 'paused' && (<>
            <TouchableOpacity style={[s.ctrlBtn, s.startBtn]} onPress={handleResume}>
              <Text style={s.ctrlBtnText}>▶ Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, s.stopBtn]} onPress={handleStop}>
              <Text style={s.ctrlBtnText}>⏹ Terminer</Text>
            </TouchableOpacity>
          </>)}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  panel: { maxHeight: 320 },
  panelContent: { padding: 16 },
  timer: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2, color: '#111', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  statUnit: { fontSize: 13, fontWeight: '400', color: '#666' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  bleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  bleChip: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 20, padding: 8, alignItems: 'center' },
  bleChipOff: { backgroundColor: '#f3f4f6' },
  bleChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  controls: { flexDirection: 'row', gap: 12 },
  ctrlBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
  ctrlBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  startBtn: { backgroundColor: '#16a34a' },
  pauseBtn: { backgroundColor: '#d97706' },
  stopBtn: { backgroundColor: '#dc2626' },
})
