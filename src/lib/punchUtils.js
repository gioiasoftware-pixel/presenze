import { supabase } from './supabase'

// ── Funzioni identiche a EmployeeRiepilogoPage (fonte ufficiale) ──────────────

export function roundToHalf(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const rounded = Math.round((h * 60 + m) / 30) * 30
  const rh = Math.floor(rounded / 60) % 24
  const rm = rounded % 60
  return `${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}`
}

export function punchToTime(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export function calcHours(inT, outT) {
  if (!inT || !outT) return null
  const [ih, im] = inT.split(':').map(Number)
  const [oh, om] = outT.split(':').map(Number)
  let diff = (oh * 60 + om) - (ih * 60 + im)
  if (diff < 0) diff += 24 * 60
  return diff > 0 ? diff / 60 : null
}

export function buildPairs(sorted) {
  const pairs = []; let pending = null
  for (const p of sorted) {
    if (p.action === 'ENTRATA') {
      if (pending) pairs.push({ entry: pending, exit: null })
      pending = p
    } else { pairs.push({ entry: pending, exit: p }); pending = null }
  }
  if (pending) pairs.push({ entry: pending, exit: null })
  return pairs
}

// Identica a EmployeeRiepilogoPage.mergeDay — fonte ufficiale degli orari
export function mergeDay(shiftData, actualPairs) {
  if (typeof shiftData === 'string') return { type: 'special', value: shiftData }
  const planned = shiftData?.pairs || []
  if (planned.length === 0 && actualPairs.length === 0) return { type: 'empty' }
  const numPairs = Math.max(planned.length, actualPairs.length, 1)
  const pairs = []
  for (let i = 0; i < numPairs; i++) {
    const plan   = planned[i] || null
    const actual = actualPairs[i] || { entry: null, exit: null }
    const rawIn  = actual.entry ? punchToTime(actual.entry.punched_at) : null
    const rawOut = actual.exit  ? punchToTime(actual.exit.punched_at)  : null
    const effectiveIn  = (rawIn  ? roundToHalf(rawIn)  : null) ?? plan?.in  ?? null
    const effectiveOut = (rawOut ? roundToHalf(rawOut) : null) ?? plan?.out ?? null
    pairs.push({ effectiveIn, effectiveOut, hours: calcHours(effectiveIn, effectiveOut) })
  }
  return { type: 'shift', pairs }
}

// ── Fetch batch anno — stessa logica di EmployeeRiepilogoPage.loadMonth ───────
// Restituisce { [empId]: { [dateKey]: mergedDay } } con gli orari ufficiali del riepilogo
export async function fetchYearMerged(empIds, year) {
  const firstDay = `${year}-01-01`
  const lastDay  = `${year}-12-31`
  const nextYear = `${year + 1}-01-01`

  const [{ data: turniData }, { data: punchData }] = await Promise.all([
    supabase.from('turni').select('employee_id, date, shift_data')
      .in('employee_id', empIds)
      .gte('date', firstDay).lte('date', lastDay),
    supabase.from('punches').select('employee_id, action, punched_at')
      .in('employee_id', empIds)
      .gte('punched_at', `${firstDay}T00:00:00`)
      .lte('punched_at', `${nextYear}T05:59:59`)
      .order('punched_at'),
  ])

  const turniMap = {}
  turniData?.forEach(r => {
    if (!turniMap[r.employee_id]) turniMap[r.employee_id] = {}
    turniMap[r.employee_id][r.date] = r.shift_data
  })

  const result = {}
  for (const empId of empIds) {
    result[empId] = {}

    // Build pairs cross-midnight, group by entry date
    const empPunches = (punchData || []).filter(p => p.employee_id === empId)
    const pairsByDate = {}
    for (const pair of buildPairs(empPunches)) {
      const ref = pair.entry || pair.exit
      if (!ref) continue
      const dk = new Date(ref.punched_at).toLocaleDateString('sv')
      if (dk < firstDay || dk > lastDay) continue
      if (!pairsByDate[dk]) pairsByDate[dk] = []
      pairsByDate[dk].push(pair)
    }

    // Per ogni giorno con turno o timbrature → mergeDay (identico al riepilogo)
    const empTurni = turniMap[empId] || {}
    const allDates = new Set([...Object.keys(pairsByDate), ...Object.keys(empTurni)])
    for (const dk of allDates) {
      if (dk < firstDay || dk > lastDay) continue
      const merged = mergeDay(empTurni[dk] ?? null, pairsByDate[dk] || [])
      if (merged.type === 'shift') result[empId][dk] = merged
    }
  }

  return result
}
