import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { bleService, FoundDevice, BleReadings } from '../services/bleService'
import { useTheme, Theme } from '../theme'

const TYPE_LABEL: Record<FoundDevice['type'], string> = {
  hr:      '❤️  Cardiofréquencemètre',
  power:   '⚡ Capteur de puissance',
  csc:     '🔄 Capteur vitesse/cadence',
  unknown: '📡 Appareil BLE',
}

const RSSI_BARS = (rssi: number) => {
  if (rssi >= -60) return '▂▄▆█'
  if (rssi >= -75) return '▂▄▆·'
  if (rssi >= -85) return '▂▄··'
  return '▂···'
}

export default function SensorScreen({ navigation }: any) {
  const t = useTheme()
  const s = styles(t)

  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<FoundDevice[]>([])
  const [readings, setReadings] = useState<BleReadings>({ bpm: null, watts: null, cadenceRpm: null })
  const [permGranted, setPermGranted] = useState<boolean | null>(null)

  useEffect(() => {
    bleService.requestPermissions().then(ok => {
      setPermGranted(ok)
      if (!ok) Alert.alert('Bluetooth requis', 'Autorise le Bluetooth et la localisation pour scanner les capteurs.')
    })
    return () => {
      bleService.stopScan()
    }
  }, [])

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

  async function startScan() {
    setDevices([])
    setScanning(true)
    await bleService.startScan(onReadings, onDeviceFound)
    setTimeout(() => setScanning(false), 30000)
  }

  async function handleConnect(device: FoundDevice) {
    const type = device.type === 'hr' ? 'hr' : 'power'
    await bleService.connectById(device.id, type, onReadings)
  }

  async function handleDisconnect() {
    await bleService.disconnect()
    setReadings({ bpm: null, watts: null, cadenceRpm: null })
  }

  const hrConnected    = bleService.isHrConnected
  const powerConnected = bleService.isPowerConnected

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Capteurs BLE</Text>
        <Text style={s.subtitle}>Compatible CYCPLUS H2PRO (cardio) et M1 (puissance/cadence)</Text>

        {/* Status badges */}
        <View style={s.statusRow}>
          <View style={[s.badge, hrConnected && s.badgeOn]}>
            <Text style={[s.badgeText, hrConnected && s.badgeTextOn]}>
              ❤️  {hrConnected ? 'FC connectée' : 'FC non connectée'}
            </Text>
          </View>
          <View style={[s.badge, powerConnected && s.badgeOn]}>
            <Text style={[s.badgeText, powerConnected && s.badgeTextOn]}>
              ⚡ {powerConnected ? 'Puissance connectée' : 'Puissance non connectée'}
            </Text>
          </View>
        </View>

        {/* Live readings */}
        {(hrConnected || powerConnected) && (
          <View style={s.liveBox}>
            <Text style={s.liveTitle}>Valeurs en direct</Text>
            <View style={s.liveRow}>
              {readings.bpm !== null && (
                <View style={s.liveItem}>
                  <Text style={s.liveValue}>{readings.bpm}</Text>
                  <Text style={s.liveLabel}>bpm</Text>
                </View>
              )}
              {readings.watts !== null && (
                <View style={s.liveItem}>
                  <Text style={s.liveValue}>{readings.watts}</Text>
                  <Text style={s.liveLabel}>Watts</Text>
                </View>
              )}
              {readings.cadenceRpm !== null && (
                <View style={s.liveItem}>
                  <Text style={s.liveValue}>{readings.cadenceRpm}</Text>
                  <Text style={s.liveLabel}>rpm</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Scan button */}
        <TouchableOpacity
          style={[s.btn, scanning && s.btnDisabled]}
          onPress={startScan}
          disabled={scanning || permGranted === false}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
          ) : null}
          <Text style={s.btnText}>{scanning ? 'Scan en cours…' : '🔍 Scanner les capteurs'}</Text>
        </TouchableOpacity>

        {(hrConnected || powerConnected) && (
          <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={handleDisconnect}>
            <Text style={s.btnText}>Déconnecter tout</Text>
          </TouchableOpacity>
        )}

        {/* Device list */}
        {devices.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Appareils détectés</Text>
            {devices.map(device => (
              <TouchableOpacity
                key={device.id}
                style={s.deviceRow}
                onPress={() => handleConnect(device)}
              >
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

        {/* Tips */}
        <View style={s.tipsBox}>
          <Text style={s.tipsTitle}>💡 Conseils</Text>
          <Text style={s.tip}>• CYCPLUS H2PRO : maintiens le bouton 3s pour allumer, la LED clignote en rouge</Text>
          <Text style={s.tip}>• CYCPLUS M1 : pédale légèrement pour l'activer, la LED clignote en bleu</Text>
          <Text style={s.tip}>• Les capteurs se reconnectent automatiquement à la prochaine sortie</Text>
          <Text style={s.tip}>• Si le scan ne trouve rien : désactive/réactive le Bluetooth du téléphone</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: t.background },
  container:   { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: 'bold', color: t.text, marginBottom: 4 },
  subtitle:    { fontSize: 13, color: t.textMuted, marginBottom: 20 },

  statusRow:   { flexDirection: 'row', gap: 10, marginBottom: 16 },
  badge:       { flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, alignItems: 'center' },
  badgeOn:     { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  badgeText:   { fontSize: 12, color: t.textMuted },
  badgeTextOn: { color: '#15803d', fontWeight: '600' },

  liveBox:     { backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  liveTitle:   { fontSize: 13, color: t.textMuted, marginBottom: 10 },
  liveRow:     { flexDirection: 'row', gap: 20 },
  liveItem:    { alignItems: 'center' },
  liveValue:   { fontSize: 28, fontWeight: 'bold', color: '#2563eb' },
  liveLabel:   { fontSize: 11, color: t.textMuted, marginTop: 2 },

  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 12, padding: 14, marginBottom: 10 },
  btnDisabled: { opacity: 0.6 },
  btnDanger:   { backgroundColor: '#dc2626' },
  btnText:     { color: '#fff', fontWeight: '600', fontSize: 15 },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: t.textSub, marginTop: 8, marginBottom: 8 },

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
