export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)    return `il y a ${d}j`
  if (d < 30)   return `il y a ${Math.floor(d / 7)} sem.`
  if (d < 365)  return `il y a ${Math.floor(d / 30)} mois`
  return `il y a ${Math.floor(d / 365)} an${Math.floor(d / 365) > 1 ? 's' : ''}`
}
