import { useEffect, useState } from 'react'
import { Cloud, Wind, Droplets, Thermometer } from 'lucide-react'

// Uses Open-Meteo — free, no API key needed
// https://open-meteo.com/en/docs

interface WeatherData {
  temp: number         // °C
  windKmh: number
  precipPct: number    // %
  precipMm: number     // mm
  weatherCode: number
  hour: number
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code <= 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

function getWeatherDesc(code: number): string {
  if (code === 0) return 'Ensoleillé'
  if (code <= 2) return 'Partiellement nuageux'
  if (code <= 3) return 'Couvert'
  if (code <= 48) return 'Brouillard'
  if (code <= 57) return 'Bruine'
  if (code <= 67) return 'Pluie'
  if (code <= 77) return 'Neige'
  if (code <= 82) return 'Averses'
  if (code <= 86) return 'Averses de neige'
  if (code <= 99) return 'Orage'
  return 'Inconnu'
}

function getRainRisk(precipPct: number, precipMm: number): { label: string; color: string } {
  if (precipPct < 20 && precipMm < 0.5) return { label: 'Pas de pluie', color: 'text-green-600 dark:text-green-400' }
  if (precipPct < 40 || precipMm < 1) return { label: 'Risque faible', color: 'text-yellow-600 dark:text-yellow-400' }
  if (precipPct < 70 || precipMm < 3) return { label: 'Risque modéré', color: 'text-orange-600 dark:text-orange-400' }
  return { label: 'Pluie probable', color: 'text-red-600 dark:text-red-400' }
}

interface Props {
  lat: number
  lng: number
  plannedAt: string   // ISO datetime string
}

export default function WeatherForecast({ lat, lng, plannedAt }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lat || !lng || !plannedAt) return

    const date = new Date(plannedAt)
    const now = new Date()
    const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    // Open-Meteo free forecast is available up to 16 days
    if (diffDays < 0 || diffDays > 16) {
      setError('Météo disponible jusqu\'à 16 jours à l\'avance.')
      return
    }

    const dateStr = date.toISOString().split('T')[0]
    const targetHour = date.getHours()

    setLoading(true)
    setError(null)

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,windspeed_10m,precipitation_probability,precipitation,weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`

    fetch(url)
      .then(r => r.json())
      .then(data => {
        const hours: number[] = data.hourly.time.map((t: string) => new Date(t).getHours())
        const hourIdx = hours.findIndex(h => h === targetHour)
        const idx = hourIdx >= 0 ? hourIdx : Math.floor(hours.length / 2)

        setWeather({
          temp: Math.round(data.hourly.temperature_2m[idx]),
          windKmh: Math.round(data.hourly.windspeed_10m[idx]),
          precipPct: data.hourly.precipitation_probability[idx],
          precipMm: parseFloat(data.hourly.precipitation[idx].toFixed(1)),
          weatherCode: data.hourly.weathercode[idx],
          hour: hours[idx],
        })
      })
      .catch(() => setError('Impossible de récupérer la météo.'))
      .finally(() => setLoading(false))
  }, [lat, lng, plannedAt])

  if (!plannedAt) return null

  const date = new Date(plannedAt)
  const diffDays = (date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0 || diffDays > 16) return null

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 flex items-center gap-2 text-sm text-gray-400">
        <Cloud size={14} className="animate-pulse" /> Chargement météo...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
        ⚠️ {error}
      </div>
    )
  }

  if (!weather) return null

  const rain = getRainRisk(weather.precipPct, weather.precipMm)

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-sky-200 dark:border-slate-700 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-2">
            <Cloud size={16} className="text-sky-500" />
            Météo prévue
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {weather.hour}h — source Open-Meteo
          </p>
        </div>
        <div className="text-4xl">{getWeatherIcon(weather.weatherCode)}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg p-3 flex items-center gap-2">
          <Thermometer size={14} className="text-red-400" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-white">{weather.temp}°C</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{getWeatherDesc(weather.weatherCode)}</p>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg p-3 flex items-center gap-2">
          <Wind size={14} className="text-blue-400" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-white">{weather.windKmh} km/h</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {weather.windKmh < 20 ? 'Vent faible' : weather.windKmh < 40 ? 'Vent modéré' : 'Vent fort'}
            </p>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg p-3 flex items-center gap-2">
          <Droplets size={14} className="text-sky-400" />
          <div>
            <p className={`text-sm font-bold ${rain.color}`}>{weather.precipPct}%</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{rain.label}</p>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-700/50 rounded-lg p-3 flex items-center gap-2">
          <Droplets size={14} className="text-indigo-400" />
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-white">{weather.precipMm} mm</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Précipitations</p>
          </div>
        </div>
      </div>

      {/* Alert if conditions are bad */}
      {(weather.windKmh >= 40 || weather.precipPct >= 70) && (
        <div className="mt-3 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2">
          ⚠️ {weather.windKmh >= 40 ? 'Vent fort prévu — prudence dans les descentes. ' : ''}
          {weather.precipPct >= 70 ? 'Pluie probable — prévoyez une veste imperméable.' : ''}
        </div>
      )}
    </div>
  )
}
