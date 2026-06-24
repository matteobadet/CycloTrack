import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { bleService, FoundDevice, BleReadings, ConnectionStatus } from '../services/bleService'
import { useTheme, Theme } from '../theme'

const TYPE_LABEL: Record<FoundDevice['type'], string> = {
  hr:      '❤️ Cardio',
  power:   '⚡ Puissance',
  csc:     '🔄 Vitesse / Cadence',
  unknown: '📡 BLE',
}

const RSSI_BARS = (rssi: number) => {
  if (rssi >= -60) return '▂▄▆█'
  if (rssi >= -75) return '▂▄▆·'
  if (rssi >= -85) return '▂▄··'
  return '▂···'
}

type SlotType = ConnectionStatus['hr']

const SLOT_LABEL: Record<SlotType, string>      = { disconnected: 'Non connecté', connecting: 'Connexion…', connected: 'Connecté', reconnecting: 'Reconnexion…' }
const SLOT_BG: Record<SlotType, string>         = { disconnected: 'transparent', connecting: '#fef9c3', connected: '#f0fdf4', reconnecting: '#fff7ed' }
const SLOT_BORDER: Record<SlotType, string>     = { disconnected: '#374151', connecting: '#ca8a04', connected: '#22c55e', reconnecting: '#f97316' }
const SLOT_COLOR: Record<SlotType, string>      = { disconnected: '#9ca3af', connecting: '#92400e', connected: '#15803d', reconnecting: '#c2410c' }
const SLOT_DOT: Record<SlotType, string>        = { disconnected: '⚫', connecting: '🟡', connected: '🟢', reconnecting: '🟡' }

function StatusBadge({ label, slot, deviceName, onDisconnect }: {
  label: string; slot: SlotType; deviceName: string | null; onDisconnect: () => void
}) {
  const active = slot === 'connected' || slot === 'reconnecting'
  return (
    <View style={[badge.wrap, { borderColor: SLOT_BORDER[slot], backgroundColor: SLOT_BG[slot] }]}>
      <Text style={badge.dot}>{SLOT_DOT[slot]}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[badge.label, { color: SLOT_COLOR[slot] }]}>{label}</Text>
        <Text style={[badge.status, { color: SLOT_COLOR[slot] }]}>{SLOT_LABEL[slot]}</Text>
        {deviceName ? <Text style={badge.device}>{deviceName}</Text> : null}
      </View>
      {active && (
        <TouchableOpacity style={badge.disconnBtn} onPress={onDisconnect}>
          <Text style={badge.disconnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const badge = StyleSheet.create({
  wrap:       { borderWidth: 1.5, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:        { fontSize: 16 },
  label:      { fontSize: 12, fontWeight: '700' },
  status:     { fontSize: 11, marginTop: 1 },
  device:     { fontSize: 10, color: '#6b7280', marginTop: 2 },
  disconnBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.1)', marginLeft: 4 },
  disconnText:{ fontSize: 12, color: '#dc2626', fontWeight: '700' },
})

export default function SensorScreen() {
  const t = useTheme()
  const s = styles(t)

  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<FoundDevice[]>([])
  const [readings, setReadings] = useState<BleReadings>({ bpm: null, watts: null, cadenceRpm: null, speedKmh: null })
  const [permGranted, setPermGranted] = useState<boolean | null>(null)
  const [conn, setConn] = useState<ConnectionStatus>(bleService.connectionStatus)

  const onReadings = useCallback((r: Partial<BleReadings>) => {
    setReadings(prev => ({ ...prev, ...r }))
  }, [])

  const onDeviceFound = useCallback((device: FoundDevice) => {
    setDevices(prev => {
      const exists = prev.find(d => d.id === device.id)
      if (exists) return prev.map(d => d.id === device.id ? device : d)
      return [...prev, device].sort((a, b) => b.rssi - a.rssi)
    })
  }, [])

  useEffect(() => {
    bleService.requestPermissions().then(ok => {
      setPermGranted(ok)
      if (!ok) Alert.alert('Bluetooth requis', 'Autorise le Bluetooth et la localisation pour scanner les capteurs.')
    })
    bleService.addReadingsListener(onReadings)
    bleService.addStatusListener(setConn)
    return () => {
      bleService.removeReadingsListener(onReadings)
      bleService.removeStatusListener(setConn)
      bleService.stopScan()
    }
  }, [onReadings])

  async function startScan() {
    setDevices([])
    setScanning(true)
    await bleService.startScan(undefined, onDeviceFound)
    setTimeout(() => setScanning(false), 30000)
  }

  async function handleConnect(device: FoundDevice) {
    const type = device.type === 'hr' ? 'hr' : device.type === 'power' ? 'power' : 'csc'
    await bleService.connectById(device.id, type)
  }

  const anyConnected = conn.hr !== 'disconnected' || conn.power !== 'disconnected'
    || conn.cadence !== 'disconnected' || conn.speed !== 'disconnected'

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Capteurs</Text>
        <Text style={s.subtitle}>Scanne et connecte tes capteurs Bluetooth</Text>

        {/* 4 status slots */}
        <View style={s.statusCol}>
          <StatusBadge label="❤️ Cardio" slot={conn.hr} deviceName={conn.hrDeviceName}
            onDisconnect={() => bleService.disconnectHr()} />
          <StatusBadge label="⚡ Puissance" slot={conn.power} deviceName={conn.powerDeviceName}
            onDisconnect={() => bleService.disconnectPower()} />
          <StatusBadge label="🔄 Cadence" slot={conn.cadence} deviceName={conn.cadenceDeviceName}
            onDisconnect={() => bleService.disconnectCsc()} />
          <StatusBadge label="💨 Vitesse" slot={conn.speed} deviceName={conn.speedDeviceName}
            onDisconnect={() => bleService.disconnectCsc()} />
        </View>

        {/* Live readings */}
        {anyConnected && (readings.bpm !== null || readings.watts !== null || readings.cadenceRpm !== null || readings.speedKmh !== null) && (
          <View style={s.liveBox}>
            <Text style={s.liveTitle}>Valeurs en direct</Text>
            <View style={s.liveRow}>
              {readings.bpm !== null && <LiveVal value={readings.bpm} unit="bpm" />}
              {readings.watts !== null && <LiveVal value={readings.watts} unit="W" />}
              {readings.cadenceRpm !== null && <LiveVal value={readings.cadenceRpm} unit="rpm" />}
              {readings.speedKmh !== null && <LiveVal value={readings.speedKmh} unit="km/h" />}
            </View>
          </View>
        )}

        {/* Scan */}
        <TouchableOpacity
          style={[s.btn, scanning && s.btnDisabled]}
          onPress={startScan}
          disabled={scanning || permGranted === false}
        >
          {scanning ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
          <Text style={s.btnText}>{scanning ? 'Scan en cours…' : '🔍 Scanner les capteurs'}</Text>
        </TouchableOpacity>

        {/* Device list */}
        {devices.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Appareils détectés</Text>
            {devices.map(device => (
              <TouchableOpacity key={device.id} style={s.deviceRow} onPress={() => handleConnect(device)}>
                <View style={s.deviceInfo}>
                  <Text style={s.deviceName}>{device.name}</Text>
                  <Text style={s.deviceType}>{TYPE_LABEL[device.type]}</Text>
                </View>
                <View style={s.deviceRight}>
                  <Text style={s.rssi}>{RSSI_BARS(device.rssi)}</Text>
                  <Text style={s.rssiVal}>{device.rssi} dBm</Text>
                  <Text style={s.connectBtn}>Connecter</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {devices.length === 0 && !scanning && (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>Appuie sur "Scanner" pour détecter tes capteurs.</Text>
            <Text style={s.emptyHint}>Assure-toi que le Bluetooth est activé et que tes capteurs sont allumés.</Text>
          </View>
        )}

        <View style={s.tipsBox}>
          <Text style={s.tipsTitle}>💡 Conseils</Text>
          <Text style={s.tip}>• CYCPLUS H2PRO : maintiens le bouton 3s, LED rouge clignotante</Text>
          <Text style={s.tip}>• CYCPLUS S3 : pédale légèrement pour activer, LED bleue</Text>
          <Text style={s.tip}>• Le capteur S3 fournit à la fois vitesse et cadence</Text>
          <Text style={s.tip}>• Si rien ne s'affiche : désactive/réactive le Bluetooth</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function LiveVal({ value, unit }: { value: number; unit: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#2563eb' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{unit}</Text>
    </View>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: t.bg ?? t.background },
  container:   { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: 'bold', color: t.text, marginBottom: 4 },
  subtitle:    { fontSize: 13, color: t.textMuted, marginBottom: 20 },
  statusCol:   { gap: 10, marginBottom: 16 },
  liveBox:     { backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  liveTitle:   { fontSize: 13, color: t.textMuted, marginBottom: 10 },
  liveRow:     { flexDirection: 'row', gap: 20 },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 12, padding: 14, marginBottom: 10 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
  sectionTitle:{ fontSize: 14, fontWeight: '600', color: t.textSub, marginTop: 8, marginBottom: 8 },
  deviceRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  deviceInfo:  { flex: 1 },
  deviceName:  { fontSize: 15, fontWeight: '600', color: t.text },
  deviceType:  { fontSize: 12, color: t.textMuted, marginTop: 2 },
  deviceRight: { alignItems: 'flex-end', gap: 2 },
  rssi:        { fontSize: 13, color: '#2563eb', letterSpacing: 1 },
  rssiVal:     { fontSize: 10, color: t.textMuted },
  connectBtn:  { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 4 },
  emptyBox:    { alignItems: 'center', paddingVertical: 32 },
  emptyText:   { color: t.textMuted, textAlign: 'center', marginBottom: 6 },
  emptyHint:   { color: t.textMuted, fontSize: 12, textAlign: 'center' },
  tipsBox:     { backgroundColor: t.card, borderRadius: 14, padding: 16, marginTop: 12 },
  tipsTitle:   { fontWeight: '600', color: t.text, marginBottom: 10 },
  tip:         { fontSize: 12, color: t.textMuted, lineHeight: 20, marginBottom: 2 },
})
