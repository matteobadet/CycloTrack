import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { api } from '../lib/api'

export default function RegisterScreen({ navigation }: any) {
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', heightCm: '', weightKg: '' })
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleRegister() {
    setLoading(true)
    try {
      await api.post('/auth/register', {
        email: form.email,
        pseudo: form.pseudo,
        password: form.password,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
      })
      Alert.alert('Succès', 'Compte créé ! Connectez-vous.', [{ text: 'OK', onPress: () => navigation.navigate('Login') }])
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le compte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>🚴 CycloTrack</Text>
      <Text style={s.subtitle}>Créer un compte</Text>
      {([
        { label: 'Email', field: 'email', keyboard: 'email-address' as const },
        { label: 'Pseudo', field: 'pseudo', keyboard: 'default' as const },
        { label: 'Mot de passe', field: 'password', keyboard: 'default' as const },
        { label: 'Taille (cm)', field: 'heightCm', keyboard: 'numeric' as const },
        { label: 'Poids (kg)', field: 'weightKg', keyboard: 'numeric' as const },
      ]).map(({ label, field, keyboard }) => (
        <TextInput
          key={field}
          style={s.input}
          placeholder={label}
          value={form[field as keyof typeof form]}
          onChangeText={v => set(field, v)}
          keyboardType={keyboard}
          autoCapitalize="none"
          secureTextEntry={field === 'password'}
        />
      ))}
      <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Création...' : "S'inscrire"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 32, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#2563eb', fontSize: 14 },
})
