// BLE désactivé en mode Expo Go — react-native-ble-plx nécessite un dev build natif.
// Les données BLE (watts, cadence, BPM) seront disponibles après `npx expo run:android`.

export interface BleReadings {
  bpm: number | null
  watts: number | null
  cadenceRpm: number | null
}

type ReadingsCallback = (readings: Partial<BleReadings>) => void

class BleService {
  async requestPermissions(): Promise<boolean> { return false }

  startScan(_onReadings: ReadingsCallback, _onDeviceFound?: (name: string) => void) {
    // no-op en Expo Go
  }

  stopScan() {}

  async disconnect() {}

  get isHrConnected() { return false }
  get isPowerConnected() { return false }
}

export const bleService = new BleService()
