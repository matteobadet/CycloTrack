import { BleManager, Device, Characteristic, BleError, State } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'

// ── GATT UUIDs (standard Bluetooth SIG) ──────────────────────────────────────
const HR_SERVICE        = '0000180d-0000-1000-8000-00805f9b34fb'
const HR_MEASUREMENT    = '00002a37-0000-1000-8000-00805f9b34fb'

const POWER_SERVICE     = '00001818-0000-1000-8000-00805f9b34fb'
const POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb'

const CSC_SERVICE       = '00001816-0000-1000-8000-00805f9b34fb'
const CSC_MEASUREMENT   = '00002a5b-0000-1000-8000-00805f9b34fb'

// ── Types ────────────────────────────────────────────────────────────────────
export interface BleReadings {
  bpm: number | null
  watts: number | null
  cadenceRpm: number | null
}

export interface FoundDevice {
  id: string
  name: string
  type: 'hr' | 'power' | 'csc' | 'unknown'
  rssi: number
}

type ReadingsCallback = (readings: Partial<BleReadings>) => void
type DeviceFoundCallback = (device: FoundDevice) => void

// ── CSC cadence state (needs inter-notification delta) ────────────────────────
interface CscState {
  lastCrankRevs: number
  lastCrankTime: number  // 1/1024 s units
}

// ── Main BLE service ──────────────────────────────────────────────────────────
class BleService {
  private manager: BleManager | null = null
  private hrDevice: Device | null = null
  private powerDevice: Device | null = null
  private hrSubscription: { remove(): void } | null = null
  private powerSubscription: { remove(): void } | null = null
  private cscSubscription: { remove(): void } | null = null
  private scanActive = false
  private cscState: CscState = { lastCrankRevs: 0, lastCrankTime: 0 }

  private _isHrConnected = false
  private _isPowerConnected = false

  get isHrConnected()    { return this._isHrConnected }
  get isPowerConnected() { return this._isPowerConnected }

  // ── Init ──────────────────────────────────────────────────────────────────
  private getManager(): BleManager {
    if (!this.manager) this.manager = new BleManager()
    return this.manager
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return true

    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED)
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    )
    return result === PermissionsAndroid.RESULTS.GRANTED
  }

  // ── Wait for BT powered on ────────────────────────────────────────────────
  private waitForPoweredOn(): Promise<void> {
    return new Promise((resolve, reject) => {
      const mgr = this.getManager()
      mgr.state().then(state => {
        if (state === State.PoweredOn) { resolve(); return }
        const sub = mgr.onStateChange(s => {
          if (s === State.PoweredOn) { sub.remove(); resolve() }
          if (s === State.PoweredOff || s === State.Unauthorized) {
            sub.remove(); reject(new Error('Bluetooth non disponible'))
          }
        }, true)
        setTimeout(() => { sub.remove(); reject(new Error('Timeout Bluetooth')) }, 10000)
      })
    })
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  async startScan(onReadings: ReadingsCallback, onDeviceFound?: DeviceFoundCallback) {
    if (this.scanActive) return
    try {
      await this.waitForPoweredOn()
    } catch {
      return
    }

    const mgr = this.getManager()
    this.scanActive = true

    const serviceUuids = [HR_SERVICE, POWER_SERVICE, CSC_SERVICE]

    mgr.startDeviceScan(serviceUuids, { allowDuplicates: false }, (error, device) => {
      if (error) {
        this.scanActive = false
        return
      }
      if (!device || !device.name) return

      const type = this.detectType(device)
      onDeviceFound?.({
        id: device.id,
        name: device.name,
        type,
        rssi: device.rssi ?? -100,
      })

      // Auto-connect: first HR device → hrDevice, first power device → powerDevice
      if (type === 'hr' && !this.hrDevice) {
        this.connectHr(device, onReadings)
      }
      if ((type === 'power' || type === 'csc') && !this.powerDevice) {
        this.connectPower(device, onReadings)
      }
    })

    // Stop scan after 30s
    setTimeout(() => this.stopScan(), 30000)
  }

  stopScan() {
    if (!this.scanActive) return
    this.manager?.stopDeviceScan()
    this.scanActive = false
  }

  // ── Device type detection ─────────────────────────────────────────────────
  private detectType(device: Device): FoundDevice['type'] {
    const uuids = device.serviceUUIDs ?? []
    if (uuids.some(u => u.toLowerCase().includes('180d'))) return 'hr'
    if (uuids.some(u => u.toLowerCase().includes('1818'))) return 'power'
    if (uuids.some(u => u.toLowerCase().includes('1816'))) return 'csc'
    // CYCPLUS M1 name patterns
    const name = (device.name ?? '').toLowerCase()
    if (name.includes('h2') || name.includes('heart') || name.includes('hr')) return 'hr'
    if (name.includes('m1') || name.includes('power') || name.includes('pm'))  return 'power'
    return 'unknown'
  }

  // ── HR connection ─────────────────────────────────────────────────────────
  private async connectHr(device: Device, onReadings: ReadingsCallback) {
    try {
      const mgr = this.getManager()
      const connected = await mgr.connectToDevice(device.id, { autoConnect: true })
      await connected.discoverAllServicesAndCharacteristics()
      this.hrDevice = connected
      this._isHrConnected = true

      this.hrSubscription = connected.monitorCharacteristicForService(
        HR_SERVICE,
        HR_MEASUREMENT,
        (err: BleError | null, char: Characteristic | null) => {
          if (err || !char?.value) return
          const bpm = parseHrMeasurement(char.value)
          if (bpm !== null) onReadings({ bpm })
        }
      )

      // Reconnect on disconnect
      mgr.onDeviceDisconnected(device.id, () => {
        this._isHrConnected = false
        this.hrDevice = null
        this.hrSubscription?.remove()
        this.hrSubscription = null
        // Retry after 3s
        setTimeout(() => this.connectHr(device, onReadings), 3000)
      })
    } catch {
      this._isHrConnected = false
      this.hrDevice = null
      setTimeout(() => this.connectHr(device, onReadings), 5000)
    }
  }

  // ── Power/CSC connection ──────────────────────────────────────────────────
  private async connectPower(device: Device, onReadings: ReadingsCallback) {
    try {
      const mgr = this.getManager()
      const connected = await mgr.connectToDevice(device.id, { autoConnect: true })
      await connected.discoverAllServicesAndCharacteristics()
      this.powerDevice = connected
      this._isPowerConnected = true

      // Try Cycling Power first
      const services = await connected.services()
      const hasPower = services.some(s => s.uuid.toLowerCase().includes('1818'))
      const hasCsc   = services.some(s => s.uuid.toLowerCase().includes('1816'))

      if (hasPower) {
        this.powerSubscription = connected.monitorCharacteristicForService(
          POWER_SERVICE,
          POWER_MEASUREMENT,
          (err: BleError | null, char: Characteristic | null) => {
            if (err || !char?.value) return
            const { watts, cadenceRpm } = parsePowerMeasurement(char.value)
            onReadings({ watts, cadenceRpm: cadenceRpm ?? undefined })
          }
        )
      } else if (hasCsc) {
        this.cscState = { lastCrankRevs: 0, lastCrankTime: 0 }
        this.cscSubscription = connected.monitorCharacteristicForService(
          CSC_SERVICE,
          CSC_MEASUREMENT,
          (err: BleError | null, char: Characteristic | null) => {
            if (err || !char?.value) return
            const cadenceRpm = parseCscMeasurement(char.value, this.cscState)
            if (cadenceRpm !== null) onReadings({ cadenceRpm })
          }
        )
      }

      mgr.onDeviceDisconnected(device.id, () => {
        this._isPowerConnected = false
        this.powerDevice = null
        this.powerSubscription?.remove()
        this.cscSubscription?.remove()
        this.powerSubscription = null
        this.cscSubscription = null
        setTimeout(() => this.connectPower(device, onReadings), 3000)
      })
    } catch {
      this._isPowerConnected = false
      this.powerDevice = null
      setTimeout(() => this.connectPower(device, onReadings), 5000)
    }
  }

  // ── Manual connect by ID ──────────────────────────────────────────────────
  async connectById(deviceId: string, type: 'hr' | 'power', onReadings: ReadingsCallback) {
    const mgr = this.getManager()
    let device: Device
    try {
      device = await mgr.connectToDevice(deviceId, { autoConnect: true })
    } catch {
      return
    }
    if (type === 'hr') this.connectHr(device, onReadings)
    else this.connectPower(device, onReadings)
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  async disconnect() {
    this.stopScan()
    this.hrSubscription?.remove()
    this.powerSubscription?.remove()
    this.cscSubscription?.remove()
    this.hrSubscription = null
    this.powerSubscription = null
    this.cscSubscription = null

    if (this.hrDevice) {
      await this.hrDevice.cancelConnection().catch(() => {})
      this.hrDevice = null
    }
    if (this.powerDevice) {
      await this.powerDevice.cancelConnection().catch(() => {})
      this.powerDevice = null
    }

    this._isHrConnected = false
    this._isPowerConnected = false
  }

  // ── Destroy ───────────────────────────────────────────────────────────────
  destroy() {
    this.disconnect()
    this.manager?.destroy()
    this.manager = null
  }
}

// ── GATT frame parsers ────────────────────────────────────────────────────────

/**
 * Heart Rate Measurement (0x2A37)
 * Byte 0: flags — bit0=0 → uint8 BPM, bit0=1 → uint16 BPM
 */
function parseHrMeasurement(base64: string): number | null {
  const bytes = base64ToUint8Array(base64)
  if (bytes.length < 2) return null
  const flags = bytes[0]
  const bpm = (flags & 0x01) === 0 ? bytes[1] : (bytes[1] | (bytes[2] << 8))
  return bpm > 0 && bpm < 250 ? bpm : null
}

/**
 * Cycling Power Measurement (0x2A63)
 * Bytes 0-1: flags
 * Bytes 2-3: Instantaneous Power (int16, Watts)
 * If bit5 set → Crank Revolution Data present at offset after optional fields
 *   flags bit1 = Pedal Power Balance Present (1 byte)
 *   flags bit2 = Pedal Power Balance Reference (0 bytes)
 *   flags bit3 = Accumulated Torque Present (2 bytes)
 *   flags bit4 = Accumulated Torque Source (0 bytes)
 *   flags bit5 = Wheel Revolution Data Present (6 bytes: uint32 revs + uint16 time)
 *   flags bit6 = Crank Revolution Data Present (4 bytes: uint16 revs + uint16 time)
 */
function parsePowerMeasurement(base64: string): { watts: number; cadenceRpm: number | null } {
  const bytes = base64ToUint8Array(base64)
  if (bytes.length < 4) return { watts: 0, cadenceRpm: null }

  const flags = bytes[0] | (bytes[1] << 8)
  const watts = signedInt16(bytes[2], bytes[3])

  let offset = 4

  // Skip optional fields before Wheel Revolution Data
  if (flags & 0x02) offset += 1  // Pedal Power Balance
  if (flags & 0x08) offset += 2  // Accumulated Torque
  if (flags & 0x20) offset += 6  // Wheel Revolution Data

  // Crank Revolution Data (flags bit6)
  if ((flags & 0x40) && bytes.length >= offset + 4) {
    // uint16 cumulative crank revolutions + uint16 last crank event time (1/1024 s)
    // We can't compute RPM without previous values here — would need state like CSC.
    // The M1 also sends cadence directly in some firmware versions via a custom byte.
    // Return null and let the CSC service handle it if available.
    void offset
  }

  return { watts: Math.max(0, watts), cadenceRpm: null }
}

/**
 * CSC Measurement (0x2A5B) — Cycling Speed & Cadence
 * Byte 0: flags — bit0=Wheel, bit1=Crank
 * If bit1 (Crank): uint16 cumulative crank revs + uint16 last crank event time (1/1024 s)
 * RPM = (ΔRevs / ΔTime) × 1024 × 60
 */
function parseCscMeasurement(base64: string, state: CscState): number | null {
  const bytes = base64ToUint8Array(base64)
  if (bytes.length < 1) return null

  const flags = bytes[0]
  let offset = 1

  // Skip Wheel Revolution Data (6 bytes) if present
  if (flags & 0x01) offset += 6

  // Crank Revolution Data (4 bytes)
  if ((flags & 0x02) && bytes.length >= offset + 4) {
    const crankRevs = bytes[offset] | (bytes[offset + 1] << 8)
    const crankTime = bytes[offset + 2] | (bytes[offset + 3] << 8)  // 1/1024 s units

    if (state.lastCrankRevs === 0 && state.lastCrankTime === 0) {
      state.lastCrankRevs = crankRevs
      state.lastCrankTime = crankTime
      return null
    }

    const deltaRevs = (crankRevs - state.lastCrankRevs + 65536) % 65536
    const deltaTime = (crankTime - state.lastCrankTime + 65536) % 65536  // handle uint16 rollover

    state.lastCrankRevs = crankRevs
    state.lastCrankTime = crankTime

    if (deltaTime === 0) return null
    const rpm = (deltaRevs / deltaTime) * 1024 * 60
    return rpm > 0 && rpm < 200 ? Math.round(rpm) : null
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function signedInt16(lo: number, hi: number): number {
  const val = lo | (hi << 8)
  return val >= 32768 ? val - 65536 : val
}

export const bleService = new BleService()
