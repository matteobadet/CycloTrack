import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Bike, ChevronRight, Search, Download, ChevronUp, ChevronDown, Zap, MapPin, X } from 'lucide-react'

interface Ride {
  id: string
  startedAt: string
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  elevationGainM: number
  avgWatts?: number
  avgBpm?: number
  routePolyline?: string
}

type SortKey = 'date' | 'distance' | 'elevation' | 'speed' | 'duration'
type SortDir = 'asc' | 'desc'

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function SortBtn({ col, current, dir, onClick }: { col: SortKey; current: SortKey; dir: SortDir; onClick: () => void }) {
  const active = col === current
  return (
    <button onClick={onClick} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
      {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />}
    </button>
  )
}

const PAGE_SIZE = 15

function exportCSV(rides: Ride[]) {
  const headers = ['Date', 'Distance (km)', 'Durée', 'Vitesse moy (km/h)', 'Dénivelé (m)', 'Puissance moy (W)', 'FC moy (bpm)']
  const rows = rides.map(r => [
    new Date(r.startedAt).toLocaleDateString('fr-FR'),
    r.distanceKm.toFixed(2),
    formatDuration(r.durationSec),
    r.avgSpeedKmh.toFixed(1),
    r.elevationGainM.toFixed(0),
    r.avgWatts?.toFixed(0) ?? '',
    r.avgBpm?.toFixed(0) ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'sorties_cyclotrack.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function RidesPage() {
  const { data: rides = [], isLoading } = useQuery<Ride[]>({
    queryKey: ['rides'],
    queryFn: () => api.get('/rides?pageSize=500').then(r => r.data),
  })

  const [search, setSearch] = useState('')
  const [filterPower, setFilterPower] = useState(false)
  const [filterGps, setFilterGps] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = [...rides]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => new Date(r.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toLowerCase().includes(q))
    }
    if (filterPower) list = list.filter(r => r.avgWatts && r.avgWatts > 0)
    if (filterGps) list = list.filter(r => r.routePolyline)
    return list
  }, [rides, search, filterPower, filterGps])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number, vb: number
      switch (sortKey) {
        case 'date':      va = new Date(a.startedAt).getTime(); vb = new Date(b.startedAt).getTime(); break
        case 'distance':  va = a.distanceKm;      vb = b.distanceKm;      break
        case 'elevation': va = a.elevationGainM;  vb = b.elevationGainM;  break
        case 'speed':     va = a.avgSpeedKmh;     vb = b.avgSpeedKmh;     break
        case 'duration':  va = a.durationSec;     vb = b.durationSec;     break
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (isLoading) return <div className="p-8 text-gray-400 dark:text-slate-500">Chargement...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mes sorties</h1>
        <button
          onClick={() => exportCSV(sorted)}
          disabled={sorted.length === 0}
          className="flex items-center gap-2 text-sm border dark:border-slate-600 px-3 py-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par date…"
            className="w-full pl-9 pr-8 py-2 text-sm border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => { setFilterPower(v => !v); setPage(1) }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${filterPower ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
        >
          <Zap size={14} /> Avec puissance
        </button>
        <button
          onClick={() => { setFilterGps(v => !v); setPage(1) }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${filterGps ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
        >
          <MapPin size={14} /> Avec GPS
        </button>
      </div>

      {/* Compteur */}
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
        {sorted.length} sortie{sorted.length !== 1 ? 's' : ''}{rides.length !== sorted.length ? ` sur ${rides.length}` : ''}
      </p>

      {rides.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-12 text-center text-gray-400 dark:text-slate-500">
          <Bike size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucune sortie pour l'instant.</p>
          <p className="text-sm mt-1">Lancez l'app mobile pour enregistrer votre première sortie.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
          Aucune sortie ne correspond aux filtres.
        </div>
      ) : (
        <>
          {/* En-têtes de tri */}
          <div className="hidden md:grid grid-cols-[1fr_100px_80px_90px_90px_80px_32px] gap-2 px-4 mb-1 text-xs text-gray-400 dark:text-slate-500 font-medium">
            <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-left">
              Date <SortBtn col="date" current={sortKey} dir={sortDir} onClick={() => toggleSort('date')} />
            </button>
            <button onClick={() => toggleSort('distance')} className="flex items-center gap-1">
              Distance <SortBtn col="distance" current={sortKey} dir={sortDir} onClick={() => toggleSort('distance')} />
            </button>
            <button onClick={() => toggleSort('duration')} className="flex items-center gap-1">
              Durée <SortBtn col="duration" current={sortKey} dir={sortDir} onClick={() => toggleSort('duration')} />
            </button>
            <button onClick={() => toggleSort('speed')} className="flex items-center gap-1">
              Vitesse <SortBtn col="speed" current={sortKey} dir={sortDir} onClick={() => toggleSort('speed')} />
            </button>
            <button onClick={() => toggleSort('elevation')} className="flex items-center gap-1">
              Dénivelé <SortBtn col="elevation" current={sortKey} dir={sortDir} onClick={() => toggleSort('elevation')} />
            </button>
            <span>Puissance</span>
            <span></span>
          </div>

          <div className="space-y-2">
            {paginated.map(r => (
              <Link
                key={r.id}
                to={`/rides/${r.id}`}
                className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <Bike size={18} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {new Date(r.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDuration(r.durationSec)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-8 text-sm text-gray-600 dark:text-slate-300 shrink-0">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">{r.distanceKm.toFixed(1)} km</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Distance</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold text-gray-900 dark:text-white">{r.avgSpeedKmh.toFixed(1)} km/h</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Vitesse</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold text-gray-900 dark:text-white">{r.elevationGainM.toFixed(0)} m</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Dénivelé</p>
                  </div>
                  {r.avgWatts ? (
                    <div className="text-right hidden md:block">
                      <p className="font-semibold text-gray-900 dark:text-white">{r.avgWatts.toFixed(0)} W</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">Puissance</p>
                    </div>
                  ) : <div className="w-14 hidden md:block" />}
                </div>
                <ChevronRight size={18} className="text-gray-300 dark:text-slate-600 ml-2 shrink-0" />
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border dark:border-slate-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
              >
                ← Précédent
              </button>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border dark:border-slate-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
