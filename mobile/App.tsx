import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from './src/stores/authStore'
import { initDb } from './src/services/offlineStore'

import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import HomeScreen from './src/screens/HomeScreen'
import PreRideScreen from './src/screens/PreRideScreen'
import TrackingScreen from './src/screens/TrackingScreen'
import RideSummaryScreen from './src/screens/RideSummaryScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const user = useAuthStore(s => s.user)
  const loadFromStorage = useAuthStore(s => s.loadFromStorage)

  useEffect(() => {
    initDb()
    loadFromStorage()
  }, [])

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PreRide" component={PreRideScreen} options={{ headerShown: true, title: 'Avant la sortie' }} />
            <Stack.Screen name="Tracking" component={TrackingScreen} options={{ headerShown: true, title: 'En sortie', headerBackVisible: false }} />
            <Stack.Screen name="RideSummary" component={RideSummaryScreen} options={{ headerShown: true, title: 'Résumé', headerBackVisible: false }} />
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
