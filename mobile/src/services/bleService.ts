import { BleManager, Device, Characteristic, BleError, State } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'

// ── GATT UUIDs ────────────────────────────────────────────────────────────────
const HR_SERVICE        = '0000180d-0000-1000-8000-00805f9b34fb'
const HR_MEASUREMENT    = '00002a37-0000-1000-8000-00805f9b34fb'
const POWER_SERVICE     = '00001818-0000-1000-8000-00805f9b34fb'
const POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb'
const CSC_SERVICE       = '00001816-0000-1000-8000-00805f9b34fb'
const CSC_MEASUREMENT   = '00002a5b-0000-1000-8000-00805f9b34fb'

// Wheel circumference in meters (700x23c default)
const WHEEL_CIRC_M = 2.096

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BleReadings {
  bpm: number | null
  watts: number | null
  cadenceRpm: number | null
  speedKmh: number | null
}

export interface FoundDevice {
  id: string
  name: string
  type: 'hr' | 'power' | 'csc' | 'unknown'
  rssi: number
}

type SlotType = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface ConnectionStatus {
  hr: SlotType;      hrDeviceName: string | null
  power: SlotType;   powerDeviceName: string | null
  cadence: SlotType; cadenceDeviceName: string | null
  speed: SlotType;   speedDeviceName: string | null
}

export type StatusCallback   = (status: ConnectionStatus) => void
export type ReadingsCallback = (readings: Partial<BleReadings>) => void
type DeviceFoundCallback     = (device: FoundDevice) => void

interface CscState {
  lastCrankRevs: number; lastCrankTime: number
  lastWheelRevs: number; lastWheelTime: number
}

// ── BLE Service ───────────────────────────────────────────────────────────────
class BleService {
  private manager: BleManager | null = null
  private scanActive = false

  // Per-slot device + subscription
  private hrDevice:      Device | null = null
  private powerDevice:   Device | null = null
  private cscDevice:     Device | null = null  // feeds both cadence & speed

  private hrSub:     { remove(): void } | null = null
  private powerSub:  { remove(): void } | null = null
  private cscSub:    { remove(): void } | null = null

  private cscState: CscState = { lastCrankRevs: 0, lastCrankTime: 0, lastWheelRevs: 0, lastWheelTime: 0 }

  private hrStop    = false
  private powerStop = false
  private cscStop   = false

  private listeners       = new Set<ReadingsCallback>()
  private statusListeners = new Set<StatusCallback>()
  private status: ConnectionStatus = {
    hr: 'disconnected',      hrDeviceName: null,
    power: 'disconnected',   powerDeviceName: null,
    cadence: 'disconnected', cadenceDeviceName: null,
    speed: 'disconnected',   speedDeviceName: null,
  }

  get isHrConnected()    { return this.status.hr === 'connected' }
  get isPowerConnected() { return this.status.power === 'connected' }
  get connectionStatus() { return { ...this.status } }

  addReadingsListener(cb: ReadingsCallback)    { this.listeners.add(cb) }
  removeReadingsListener(cb: ReadingsCallback) { this.listeners.delete(cb) }
  private emit(r: Partial<BleReadings>)        { this.listeners.forEach(cb => cb(r)) }

  addStatusListener(cb: StatusCallback)    { this.statusListeners.add(cb); cb({ ...this.status }) }
  removeStatusListener(cb: StatusCallback) { this.statusListeners.delete(cb) }
  private emitStatus(patch: Partial<ConnectionStatus>) {
    this.status = { ...this.status, ...patch }
    this.statusListeners.forEach(cb => cb({ ...this.status }))
  }

  private getManager(): BleManager {
    if (!this.manager) this.manager = new BleManager()
    return this.manager
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') return true
    if (Platform.Version >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED)
    }
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
    return r === PermissionsAndroid.RESULTS.GRANTED
  }

  private waitForPoweredOn(): Promise<void> {
    return new Promise((resolve, reject) => {
      const mgr = this.getManager()
      mgr.state().then(state => {
        if (state === State.PoweredOn) { resolve(); return }
        const sub = mgr.onStateChange(s => {
          if (s === State.PoweredOn) { sub.remove(); resolve() }
          if (s === State.PoweredOff || s === State.Unauthorized) { sub.remove(); reject(new Error('BT off')) }
        }, true)
        setTimeout(() => { sub.remove(); reject(new Error('BT timeout')) }, 10000)
      })
    })
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  async startScan(onReadings?: ReadingsCallback, onDeviceFound?: DeviceFoundCallback) {
    if (onReadings) this.addReadingsListener(onReadings)
    if (this.scanActive) return
    try { await this.waitForPoweredOn() } catch { return }

    const mgr = this.getManager()
    this.scanActive = true

    mgr.startDeviceScan([HR_SERVICE, POWER_SERVICE, CSC_SERVICE], { allowDuplicates: false }, (err, device) => {
      if (err) { this.scanActive = false; return }
      if (!device?.name) return

      const type = this.detectType(device)
      onDeviceFound?.({ id: device.id, name: device.name, type, rssi: device.rssi ?? -100 })

      if (type === 'hr' && !this.hrDevice)    this.connectHr(device)
      if (type === 'power' && !this.powerDevice) this.connectPower(device)
      if (type === 'csc' && !this.cscDevice)  this.connectCsc(device)
    })

    setTimeout(() => this.stopScan(), 30000)
  }

  stopScan() {
    if (!this.scanActive) return
    this.manager?.stopDeviceScan()
    this.scanActive = false
  }

  private detectType(device: Device): FoundDevice['type'] {
    const uuids = device.serviceUUIDs ?? []
    if (uuids.some(u => u.toLowerCase().includes('180d'))) return 'hr'
    if (uuids.some(u => u.toLowerCase().includes('1818'))) return 'power'
    if (uuids.some(u => u.toLowerCase().includes('1816'))) return 'csc'
    const name = (device.name ?? '').toLowerCase()
    if (name.includes('h2') || name.includes('heart') || name.includes('hr')) return 'hr'
    if (name.includes('m1') || name.includes('power') || name.includes('pm')) return 'power'
    if (name.includes('s3') || name.includes('speed') || name.includes('cad')) return 'csc'
    return 'unknown'
  }

  // ── HR ────────────────────────────────────────────────────────────────────
  private async connectHr(device: Device) {
    if (this.hrStop) return
    this.emitStatus({ hr: 'connecting', hrDeviceName: device.name ?? null })
    try {
      const connected = await this.getManager().connectToDevice(device.id, { autoConnect: false })
      await this.setupHr(connected)
    } catch {
      if (this.hrStop) return
      this.emitStatus({ hr: 'reconnecting' })
      setTimeout(() => this.connectHr(device), 5000)
    }
  }

  private async setupHr(connected: Device) {
    await connected.discoverAllServicesAndCharacteristics()
    this.hrDevice = connected
    this.emitStatus({ hr: 'connected', hrDeviceName: connected.name ?? null })
    this.hrSub?.remove()
    this.hrSub = connected.monitorCharacteristicForService(
      HR_SERVICE, HR_MEASUREMENT,
      (err: BleError | null, char: Characteristic | null) => {
        if (err || !char?.value) return
        const bpm = parseHrMeasurement(char.value)
        if (bpm !== null) this.emit({ bpm })
      }
    )
    this.getManager().onDeviceDisconnected(connected.id, () => {
      this.hrDevice = null; this.hrSub?.remove(); this.hrSub = null
      if (this.hrStop) { this.emitStatus({ hr: 'disconnected', hrDeviceName: null }); return }
      this.emitStatus({ hr: 'reconnecting' })
      setTimeout(() => this.connectHr(connected), 3000)
    })
  }

  // ── Power ─────────────────────────────────────────────────────────────────
  private async connectPower(device: Device) {
    if (this.powerStop) return
    this.emitStatus({ power: 'connecting', powerDeviceName: device.name ?? null })
    try {
      const connected = await this.getManager().connectToDevice(device.id, { autoConnect: false })
      await this.setupPower(connected)
    } catch {
      if (this.powerStop) return
      this.emitStatus({ power: 'reconnecting' })
      setTimeout(() => this.connectPower(device), 5000)
    }
  }

  private async setupPower(connected: Device) {
    await connected.discoverAllServicesAndCharacteristics()
    this.powerDevice = connected
    this.emitStatus({ power: 'connected', powerDeviceName: connected.name ?? null })
    this.powerSub?.remove()
    this.powerSub = connected.monitorCharacteristicForService(
      POWER_SERVICE, POWER_MEASUREMENT,
      (err: BleError | null, char: Characteristic | null) => {
        if (err || !char?.value) return
        const { watts, cadenceRpm } = parsePowerMeasurement(char.value)
        this.emit({ watts, ...(cadenceRpm !== null ? { cadenceRpm } : {}) })
        // If power meter provides cadence, reflect it in cadence slot
        if (cadenceRpm !== null) this.emitStatus({ cadence: 'connected', cadenceDeviceName: connected.name ?? null })
      }
    )
    this.getManager().onDeviceDisconnected(connected.id, () => {
      this.powerDevice = null; this.powerSub?.remove(); this.powerSub = null
      if (this.powerStop) {
        this.emitStatus({ power: 'disconnected', powerDeviceName: null, cadence: 'disconnected', cadenceDeviceName: null })
        return
      }
      this.emitStatus({ power: 'reconnecting' })
      setTimeout(() => this.connectPower(connected), 3000)
    })
  }

  // ── CSC (speed + cadence) ─────────────────────────────────────────────────
  private async connectCsc(device: Device) {
    if (this.cscStop) return
    this.emitStatus({
      cadence: 'connecting', cadenceDeviceName: device.name ?? null,
      speed: 'connecting',   speedDeviceName: device.name ?? null,
    })
    try {
      const connected = await this.getManager().connectToDevice(device.id, { autoConnect: false })
      await this.setupCsc(connected)
    } catch {
      if (this.cscStop) return
      this.emitStatus({ cadence: 'reconnecting', speed: 'reconnecting' })
      setTimeout(() => this.connectCsc(device), 5000)
    }
  }

  private async setupCsc(connected: Device) {
    await connected.discoverAllServicesAndCharacteristics()
    this.cscDevice = connected
    this.cscState = { lastCrankRevs: 0, lastCrankTime: 0, lastWheelRevs: 0, lastWheelTime: 0 }
    this.emitStatus({
      cadence: 'connected', cadenceDeviceName: connected.name ?? null,
      speed: 'connected',   speedDeviceName: connected.name ?? null,
    })
    this.cscSub?.remove()
    this.cscSub = connected.monitorCharacteristicForService(
      CSC_SERVICE, CSC_MEASUREMENT,
      (err: BleError | null, char: Characteristic | null) => {
        if (err || !char?.value) return
        const { cadenceRpm, speedKmh } = parseCscMeasurement(char.value, this.cscState)
        const update: Partial<BleReadings> = {}
        if (cadenceRpm !== null) update.cadenceRpm = cadenceRpm
        if (speedKmh !== null)   update.speedKmh   = speedKmh
        if (Object.keys(update).length > 0) this.emit(update)
      }
    )
    this.getManager().onDeviceDisconnected(connected.id, () => {
      this.cscDevice = null; this.cscSub?.remove(); this.cscSub = null
      if (this.cscStop) {
        this.emitStatus({ cadence: 'disconnected', cadenceDeviceName: null, speed: 'disconnected', speedDeviceName: null })
        return
      }
      this.emitStatus({ cadence: 'reconnecting', speed: 'reconnecting' })
      setTimeout(() => this.connectCsc(connected), 3000)
    })
  }

  // ── Manual connect ────────────────────────────────────────────────────────
  async connectById(deviceId: string, type: 'hr' | 'power' | 'csc') {
    const mgr = this.getManager()
    try {
      if (type === 'hr') {
        this.hrStop = false
        this.emitStatus({ hr: 'connecting' })
        const d = await mgr.connectToDevice(deviceId, { autoConnect: false })
        await this.setupHr(d)
      } else if (type === 'power') {
        this.powerStop = false
        this.emitStatus({ power: 'connecting' })
        const d = await mgr.connectToDevice(deviceId, { autoConnect: false })
        await this.setupPower(d)
      } else {
        this.cscStop = false
        this.emitStatus({ cadence: 'connecting', speed: 'connecting' })
        const d = await mgr.connectToDevice(deviceId, { autoConnect: false })
        await this.setupCsc(d)
      }
    } catch {
      if (type === 'hr')    this.emitStatus({ hr: 'disconnected' })
      else if (type === 'power') this.emitStatus({ power: 'disconnected' })
      else this.emitStatus({ cadence: 'disconnected', speed: 'disconnected' })
    }
  }

  // ── Per-slot disconnect ───────────────────────────────────────────────────
  async disconnectHr() {
    this.hrStop = true
    this.hrSub?.remove(); this.hrSub = null
    await this.hrDevice?.cancelConnection().catch(() => {}); this.hrDevice = null
    this.emitStatus({ hr: 'disconnected', hrDeviceName: null })
  }

  async disconnectPower() {
    this.powerStop = true
    this.powerSub?.remove(); this.powerSub = null
    await this.powerDevice?.cancelConnection().catch(() => {}); this.powerDevice = null
    this.emitStatus({ power: 'disconnected', powerDeviceName: null, cadence: 'disconnected', cadenceDeviceName: null })
  }

  async disconnectCsc() {
    this.cscStop = true
    this.cscSub?.remove(); this.cscSub = null
    await this.cscDevice?.cancelConnection().catch(() => {}); this.cscDevice = null
    this.emitStatus({ cadence: 'disconnected', cadenceDeviceName: null, speed: 'disconnected', speedDeviceName: null })
    this.emit({ cadenceRpm: null, speedKmh: null })
  }

  // ── Disconnect all ────────────────────────────────────────────────────────
  async disconnect() {
    this.hrStop = true; this.powerStop = true; this.cscStop = true
    this.stopScan()
    this.hrSub?.remove(); this.powerSub?.remove(); this.cscSub?.remove()
    this.hrSub = null; this.powerSub = null; this.cscSub = null
    await this.hrDevice?.cancelConnection().catch(() => {}); this.hrDevice = null
    await this.powerDevice?.cancelConnection().catch(() => {}); this.powerDevice = null
    await this.cscDevice?.cancelConnection().catch(() => {}); this.cscDevice = null
    this.emitStatus({
      hr: 'disconnected', hrDeviceName: null,
      power: 'disconnected', powerDeviceName: null,
      cadence: 'disconnected', cadenceDeviceName: null,
      speed: 'disconnected', speedDeviceName: null,
    })
  }

  destroy() { this.disconnect(); this.manager?.destroy(); this.manager = null }
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseHrMeasurement(base64: string): number | null {
  const b = base64ToBytes(base64)
  if (b.length < 2) return null
  const bpm = (b[0] & 0x01) === 0 ? b[1] : (b[1] | (b[2] << 8))
  return bpm > 0 && bpm < 250 ? bpm : null
}

function parsePowerMeasurement(base64: string): { watts: number; cadenceRpm: number | null } {
  const b = base64ToBytes(base64)
  if (b.length < 4) return { watts: 0, cadenceRpm: null }
  const flags = b[0] | (b[1] << 8)
  const watts = signedInt16(b[2], b[3])
  let offset = 4
  if (flags & 0x02) offset += 1
  if (flags & 0x08) offset += 2
  if (flags & 0x20) offset += 6
  // Crank Revolution Data — needs state for delta, skip for now
  void offset
  return { watts: Math.max(0, watts), cadenceRpm: null }
}

function parseCscMeasurement(base64: string, state: CscState): { cadenceRpm: number | null; speedKmh: number | null } {
  const b = base64ToBytes(base64)
  if (b.length < 1) return { cadenceRpm: null, speedKmh: null }

  const flags = b[0]
  let offset = 1
  let speedKmh: number | null = null
  let cadenceRpm: number | null = null

  // Wheel Revolution Data (bit0): uint32 revs + uint16 time (1/1024 s)
  if ((flags & 0x01) && b.length >= offset + 6) {
    const wheelRevs = b[offset] | (b[offset+1] << 8) | (b[offset+2] << 16) | (b[offset+3] << 24)
    const wheelTime = b[offset+4] | (b[offset+5] << 8)
    offset += 6

    if (state.lastWheelRevs !== 0 || state.lastWheelTime !== 0) {
      const deltaRevs = (wheelRevs - state.lastWheelRevs + 0x100000000) % 0x100000000
      const deltaTime = (wheelTime - state.lastWheelTime + 65536) % 65536
      if (deltaTime > 0) {
        const speedMs = (deltaRevs * WHEEL_CIRC_M) / (deltaTime / 1024)
        const v = speedMs * 3.6
        if (v >= 0 && v < 120) speedKmh = Math.round(v * 10) / 10
      }
    }
    state.lastWheelRevs = wheelRevs
    state.lastWheelTime = wheelTime
  }

  // Crank Revolution Data (bit1): uint16 revs + uint16 time (1/1024 s)
  if ((flags & 0x02) && b.length >= offset + 4) {
    const crankRevs = b[offset] | (b[offset+1] << 8)
    const crankTime = b[offset+2] | (b[offset+3] << 8)

    if (state.lastCrankRevs !== 0 || state.lastCrankTime !== 0) {
      const deltaRevs = (crankRevs - state.lastCrankRevs + 65536) % 65536
      const deltaTime = (crankTime - state.lastCrankTime + 65536) % 65536
      if (deltaTime > 0) {
        const rpm = (deltaRevs / deltaTime) * 1024 * 60
        if (rpm >= 0 && rpm < 200) cadenceRpm = Math.round(rpm)
      }
    }
    state.lastCrankRevs = crankRevs
    state.lastCrankTime = crankTime
  }

  return { cadenceRpm, speedKmh }
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

function signedInt16(lo: number, hi: number): number {
  const v = lo | (hi << 8)
  return v >= 32768 ? v - 65536 : v
}

export const bleService = new BleService()
