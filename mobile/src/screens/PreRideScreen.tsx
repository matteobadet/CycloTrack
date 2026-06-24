import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { bleService, ConnectionStatus } from '../services/bleService'
import { useTheme, Theme } from '../theme'

const FEELS = [
  { value: 1, emoji: '😴', label: 'Épuisé' },
  { value: 2, emoji: '😕', label: 'Fatigué' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '😊', label: 'En forme' },
  { value: 5, emoji: '🔥', label: 'Au top' },
]

export default function PreRideScreen({ navigation, route: navRoute }: any) {
  const t = useTheme()
  const s = styles(t)
  const [feel, setFeel] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [conn, setConn] = useState<ConnectionStatus>(bleService.connectionStatus)
  const plannedRideId: string | undefined = navRoute?.params?.plannedRideId
  const plannedTitle: string | undefined  = navRoute?.params?.plannedTitle

  useFocusEffect(useCallback(() => {
    setConn(bleService.connectionStatus)
    bleService.addStatusListener(setConn)
    return () => bleService.removeStatusListener(setConn)
  }, []))

  function startRide() {
    navigation.navigate('Tracking', { feelBefore: feel, commentBefore: comment, plannedRideId })
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      {plannedTitle ? (
        <View style={s.planBanner}>
          <Text style={s.planBannerText}>🗓️ Sortie planifiée : {plannedTitle}</Text>
        </View>
      ) : null}
      <Text style={s.title}>Avant la sortie</Text>

      <Text style={s.sectionLabel}>Comment tu te sens aujourd'hui ?</Text>
      <View style={s.feelRow}>
        {FEELS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[s.feelBtn, feel === f.value && s.feelBtnActive]}
            onPress={() => setFeel(f.value)}
          >
            <Text style={s.feelEmoji}>{f.emoji}</Text>
            <Text style={[s.feelLabel, feel === f.value && s.feelLabelActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLabel}>Commentaire (optionnel)</Text>
      <TextInput
        style={s.textarea}
        placeholder="Ex: Jambes lourdes, dormi 6h..."
        placeholderTextColor={t.textMuted}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
      />

      <Text style={s.sectionLabel}>Capteurs</Text>
      {(() => {
        const connected = [
          conn.hr === 'connected'      && conn.hrDeviceName,
          conn.power === 'connected'   && conn.powerDeviceName,
          conn.cadence === 'connected' && conn.cadenceDeviceName,
          conn.speed === 'connected'   && conn.speedDeviceName,
        ].filter(Boolean) as string[]
        // dedupe device names
        const unique = [...new Set(connected)]
        return unique.length > 0 ? (
          <View style={s.connectedList}>
            {unique.map(name => (
              <View key={name} style={s.connectedChip}>
                <Text style={s.connectedDot}>🟢</Text>
                <Text style={s.connectedName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.noSensorText}>Aucun capteur connecté</Text>
        )
      })()}
      <TouchableOpacity style={s.bleBtn} onPress={() => navigation.navigate('Sensors')}>
        <Text style={s.bleBtnText}>
          {conn.hr === 'connected' || conn.power === 'connected' || conn.cadence === 'connected'
            ? '⚙️ Gérer les capteurs' : '🔍 Connecter les capteurs'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.startBtn} onPress={startRide}>
        <Text style={s.startBtnText}>🚴 Démarrer la sortie</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: t.bg },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 24, color: t.text },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: t.textSub, marginBottom: 12, marginTop: 20 },
  feelRow: { flexDirection: 'row', gap: 6 },
  feelBtn: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: t.border, backgroundColor: t.card },
  feelBtnActive: { borderColor: t.blue, backgroundColor: t.bg },
  feelEmoji: { fontSize: 22 },
  feelLabel: { fontSize: 10, color: t.textMuted, marginTop: 4 },
  feelLabelActive: { color: t.blue, fontWeight: '600' },
  textarea: { borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top', backgroundColor: t.card, color: t.text },
  connectedList: { gap: 8, marginBottom: 12 },
  connectedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: t.card, borderWidth: 1, borderColor: '#22c55e' },
  connectedDot:  { fontSize: 14 },
  connectedName: { fontSize: 13, color: t.text, fontWeight: '500' },
  noSensorText:  { fontSize: 13, color: t.textMuted, marginBottom: 12 },
  bleBtn: { backgroundColor: t.inputBg, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  bleBtnText: { fontWeight: '600', color: t.text },
  bleStatus: { textAlign: 'center', color: t.textSub, fontSize: 13, marginBottom: 8 },
  startBtn: { backgroundColor: t.green, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24 },
  startBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  planBanner: { backgroundColor: '#1d4ed8', borderRadius: 12, padding: 12, marginBottom: 16 },
  planBannerText: { color: '#fff', fontWeight: '600', fontSize: 13 },
})
