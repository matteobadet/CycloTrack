import React, { useEffect } from 'react'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from './src/stores/authStore'
import { initDb, syncPendingRides, getPendingCount } from './src/services/offlineStore'
import { useThemeStore, useIsDark } from './src/theme'

import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import HomeScreen from './src/screens/HomeScreen'
import PreRideScreen from './src/screens/PreRideScreen'
import TrackingScreen from './src/screens/TrackingScreen'
import RideSummaryScreen from './src/screens/RideSummaryScreen'
import RideDetailScreen from './src/screens/RideDetailScreen'
import PlannedRidesScreen from './src/screens/PlannedRidesScreen'
import PlanDetailScreen from './src/screens/PlanDetailScreen'
import SensorScreen from './src/screens/SensorScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const user = useAuthStore(s => s.user)
  const loadFromStorage = useAuthStore(s => s.loadFromStorage)
  const loadOverride = useThemeStore(s => s.loadOverride)
  const isDark = useIsDark()

  useEffect(() => {
    initDb()
    loadFromStorage()
    loadOverride()
  }, [])

  // Sync offline rides as soon as the user is logged in
  useEffect(() => {
    if (!user) return
    const pending = getPendingCount()
    if (pending > 0) syncPendingRides().catch(() => {})
  }, [user])

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PreRide" component={PreRideScreen} options={{ headerShown: true, title: 'Avant la sortie' }} />
            <Stack.Screen name="Tracking" component={TrackingScreen} options={{ headerShown: true, title: 'En sortie', headerBackVisible: false }} />
            <Stack.Screen name="RideSummary" component={RideSummaryScreen} options={{ headerShown: true, title: 'Résumé', headerBackVisible: false }} />
            <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ headerShown: true, title: 'Détail de la sortie' }} />
            <Stack.Screen name="PlannedRides" component={PlannedRidesScreen} options={{ headerShown: true, title: 'Sorties planifiées' }} />
            <Stack.Screen name="PlanDetail" component={PlanDetailScreen} options={{ headerShown: true, title: 'Ma planification' }} />
            <Stack.Screen name="Sensors" component={SensorScreen} options={{ headerShown: true, title: 'Capteurs BLE' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'Créer un compte' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
