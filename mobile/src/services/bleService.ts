import { BleManager, Device, Characteristic } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'

// Profils BLE standard Bluetooth SIG
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb'
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb'
const CYCLING_POWER_SERVICE = '00001818-0000-1000-8000-00805f9b34fb'
const CYCLING_POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb'

export interface BleReadings {
  bpm: number | null
  watts: number | null
  cadenceRpm: number | null
}

type ReadingsCallback = (readings: Partial<BleReadings>) => void

class BleService {
  private manager = new BleManager()
  private hrDevice: Device | null = null
  private powerDevice: Device | null = null
  private scanActive = false

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(grants).every(g => g === PermissionsAndroid.RESULTS.GRANTED)
    }
    return true
  }

  startScan(onReadings: ReadingsCallback, onDeviceFound?: (name: string) => void) {
    if (this.scanActive) return
    this.scanActive = true

    this.manager.startDeviceScan(
      [HEART_RATE_SERVICE, CYCLING_POWER_SERVICE],
      { allowDuplicates: false },
      async (error, device) => {
        if (error || !device) return

        const name = device.name ?? device.localName ?? ''
        if (onDeviceFound) onDeviceFound(name)

        try {
          const connected = await device.connect()
          const discovered = await connected.discoverAllServicesAndCharacteristics()

          const services = await discovered.services()
          const serviceUuids = services.map(s => s.uuid.toLowerCase())

          if (serviceUuids.includes(HEART_RATE_SERVICE) && !this.hrDevice) {
            this.hrDevice = discovered
            discovered.monitorCharacteristicForService(
              HEART_RATE_SERVICE,
              HEART_RATE_MEASUREMENT,
              (err, char) => {
                if (!err && char) onReadings({ bpm: parseHeartRate(char) })
              },
            )
          }

          if (serviceUuids.includes(CYCLING_POWER_SERVICE) && !this.powerDevice) {
            this.powerDevice = discovered
            discovered.monitorCharacteristicForService(
              CYCLING_POWER_SERVICE,
              CYCLING_POWER_MEASUREMENT,
              (err, char) => {
                if (!err && char) onReadings(parsePowerMeasurement(char))
              },
            )
          }

          // Stop scan once both devices are connected
          if (this.hrDevice && this.powerDevice) this.stopScan()
        } catch {
          // Device connection failed — continue scanning
        }
      },
    )
  }

  stopScan() {
    this.manager.stopDeviceScan()
    this.scanActive = false
  }

  async disconnect() {
    this.stopScan()
    await this.hrDevice?.cancelConnection().catch(() => {})
    await this.powerDevice?.cancelConnection().catch(() => {})
    this.hrDevice = null
    this.powerDevice = null
  }

  get isHrConnected() { return this.hrDevice !== null }
  get isPowerConnected() { return this.powerDevice !== null }
}

// --- Parsers BLE (profils standard Bluetooth SIG) ---

function parseHeartRate(char: Characteristic): number | null {
  if (!char.value) return null
  const bytes = Buffer.from(char.value, 'base64')
  const flags = bytes[0]
  // Bit 0 : 0 = uint8, 1 = uint16
  return flags & 0x01 ? bytes.readUInt16LE(1) : bytes[1]
}

function parsePowerMeasurement(char: Characteristic): Pick<BleReadings, 'watts' | 'cadenceRpm'> {
  if (!char.value) return { watts: null, cadenceRpm: null }
  const bytes = Buffer.from(char.value, 'base64')
  const flags = bytes.readUInt16LE(0)
  const watts = bytes.readInt16LE(2)

  // Bit 4 : Wheel Revolution Data présent
  // Bit 5 : Crank Revolution Data présent
  let cadenceRpm: number | null = null
  if (flags & (1 << 5)) {
    // Crank data : offset dépend des données wheel
    let offset = 4
    if (flags & (1 << 4)) offset += 6 // wheel rev (4) + last wheel event time (2)
    const crankRevs = bytes.readUInt16LE(offset)
    const crankTime = bytes.readUInt16LE(offset + 2) // 1/1024 sec units
    if (crankTime > 0) cadenceRpm = Math.round((crankRevs / crankTime) * 1024 * 60)
  }

  return { watts, cadenceRpm }
}

export const bleService = new BleService()
