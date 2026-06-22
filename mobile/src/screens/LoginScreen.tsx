import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { useTheme, Theme } from '../theme'

export default function LoginScreen({ navigation }: any) {
  const t = useTheme()
  const s = styles(t)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore(st => st.setAuth)

  async function handleLogin() {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuth(data.user, data.accessToken)
    } catch {
      Alert.alert('Erreur', 'Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.logo}>🚴</Text>
      <Text style={s.title}>CycloTrack</Text>
      <Text style={s.subtitle}>Connexion</Text>
      <TextInput
        style={s.input}
        placeholder="Email"
        placeholderTextColor={t.textMuted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Mot de passe"
        placeholderTextColor={t.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={s.link}>Pas de compte ? S'inscrire</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: t.bg },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: t.text },
  subtitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 32, color: t.textSub },
  input: { borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: t.card, color: t.text },
  btn: { backgroundColor: t.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: t.blue, fontSize: 14 },
})
