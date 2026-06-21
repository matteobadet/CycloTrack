import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert } from 'react-native'
import { bleService } from '../services/bleService'

const FEELS = [
  { value: 1, emoji: '😴', label: 'Épuisé' },
  { value: 2, emoji: '😕', label: 'Fatigué' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '😊', label: 'En forme' },
  { value: 5, emoji: '🔥', label: 'Au top' },
]

export default function PreRideScreen({ navigation }: any) {
  const [feel, setFeel] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [bleStatus, setBleStatus] = useState<string | null>(null)
  const [scanningBle, setScanningBle] = useState(false)

  async function startBleScan() {
    const ok = await bleService.requestPermissions()
    if (!ok) { Alert.alert('Permission BLE requise'); return }
    setScanningBle(true)
    setBleStatus('Recherche des capteurs...')
    bleService.startScan(
      () => {},
      (name) => setBleStatus(`Connecté : ${name}`),
    )
    setTimeout(() => setScanningBle(false), 10000)
  }

  function startRide() {
    navigation.navigate('Tracking', { feelBefore: feel, commentBefore: comment })
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>Avant la sortie</Text>

      {/* Ressenti */}
      <Text style={s.sectionLabel}>Comment tu te sens aujourd'hui ?</Text>
      <View style={s.feelRow}>
        {FEELS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[s.feelBtn, feel === f.value && s.feelBtnActive]}
            onPress={() => setFeel(f.value)}
          >
            <Text style={s.feelEmoji}>{f.emoji}</Text>
            <Text style={s.feelLabel}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Commentaire */}
      <Text style={s.sectionLabel}>Commentaire (optionnel)</Text>
      <TextInput
        style={s.textarea}
        placeholder="Ex: Jambes lourdes, dormi 6h..."
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
      />

      {/* Capteurs BLE */}
      <Text style={s.sectionLabel}>Capteurs BLE</Text>
      <View style={s.bleRow}>
        <View style={s.sensor}>
          <Text style={s.sensorIcon}>{bleService.isPowerConnected ? '🟢' : '⚫'}</Text>
          <Text style={s.sensorLabel}>CYCPLUS M1{'\n'}(Watts + Cadence)</Text>
        </View>
        <View style={s.sensor}>
          <Text style={s.sensorIcon}>{bleService.isHrConnected ? '🟢' : '⚫'}</Text>
          <Text style={s.sensorLabel}>CYCPLUS H2PRO{'\n'}(Fréquence cardiaque)</Text>
        </View>
      </View>
      <TouchableOpacity style={s.bleBtn} onPress={startBleScan} disabled={scanningBle}>
        <Text style={s.bleBtnText}>{scanningBle ? 'Recherche...' : 'Rechercher les capteurs'}</Text>
      </TouchableOpacity>
      {bleStatus && <Text style={s.bleStatus}>{bleStatus}</Text>}

      {/* Démarrer */}
      <TouchableOpacity style={s.startBtn} onPress={startRide}>
        <Text style={s.startBtnText}>🚴 Démarrer la sortie</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 12, marginTop: 20 },
  feelRow: { flexDirection: 'row', gap: 8 },
  feelBtn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb' },
  feelBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  feelEmoji: { fontSize: 22 },
  feelLabel: { fontSize: 10, color: '#666', marginTop: 4 },
  textarea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  bleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  sensor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  sensorIcon: { fontSize: 20 },
  sensorLabel: { fontSize: 12, color: '#555', flexShrink: 1 },
  bleBtn: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  bleBtnText: { fontWeight: '600', color: '#374151' },
  bleStatus: { textAlign: 'center', color: '#6b7280', fontSize: 13, marginBottom: 8 },
  startBtn: { backgroundColor: '#16a34a', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24 },
  startBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
})
