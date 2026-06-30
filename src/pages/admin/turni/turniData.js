// Dipendenti mock divisi per reparto
// TODO: sostituire con fetch Supabase
export const MOCK_EMPLOYEES = {
  SALA: [
    { id: 1, name: 'Aldo' },
    { id: 3, name: 'Giovanni' },
    { id: 4, name: 'Mary' },
    { id: 6, name: 'Yuri' },
  ],
  CUCINA: [
    { id: 2, name: 'Gabriele' },
    { id: 5, name: 'Nicolo' },
  ],
}

// Turni prefabbricati mock — pairs[] supporta turni spezzati (1 o 2 pair)
// TODO: salvare su Supabase
export const DEFAULT_TEMPLATES = [
  { id: 1, name: 'Mattina',    color: 'bg-amber-100 text-amber-700',   pairs: [{ in: '08:00', out: '14:00' }] },
  { id: 2, name: 'Pomeriggio', color: 'bg-blue-100 text-blue-700',     pairs: [{ in: '14:00', out: '20:00' }] },
  { id: 3, name: 'Sera',       color: 'bg-purple-100 text-purple-700', pairs: [{ in: '18:00', out: '23:30' }] },
  { id: 4, name: 'Spezzato',   color: 'bg-green-100 text-green-700',   pairs: [{ in: '10:00', out: '15:00' }, { in: '17:00', out: '22:00' }] },
  { id: 5, name: 'Full day',   color: 'bg-gray-100 text-gray-700',     pairs: [{ in: '09:00', out: '17:00' }] },
]

export const SPECIALS = ['OFF', 'FERIE', 'MALATTIA', 'PERMESSO']

// Helpers date
export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDay(date) {
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6)
  const opts = { day: 'numeric', month: 'short' }
  return (
    monday.toLocaleDateString('it-IT', opts) +
    ' – ' +
    sunday.toLocaleDateString('it-IT', opts)
  )
}
