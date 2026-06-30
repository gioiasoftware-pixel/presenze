import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── Utility ──────────────────────────────────────────────────────────────────

function roundToHalf(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const rounded = Math.round((h * 60 + m) / 30) * 30
  const rh = Math.floor(rounded / 60) % 24
  const rm = rounded % 60
  return `${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}`
}

function punchToTime(isoStr) {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function calcHours(inT, outT) {
  if (!inT || !outT) return null
  const [ih, im] = inT.split(':').map(Number)
  const [oh, om] = outT.split(':').map(Number)
  const diff = (oh * 60 + om) - (ih * 60 + im)
  return diff > 0 ? diff / 60 : null
}

function fmtHours(h) {
  if (h === null || h === undefined) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

// ── Merge turno + timbrature ──────────────────────────────────────────────────

const SPECIAL_STYLE = {
  OFF:      'bg-gray-100 text-gray-500',
  FERIE:    'bg-green-100 text-green-700',
  MALATTIA: 'bg-red-100 text-red-700',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}

function mergeDay(shiftData, punches) {
  if (typeof shiftData === 'string') return { type: 'special', value: shiftData }

  const planned = shiftData?.pairs || []
  const entries = punches.filter(p => p.action === 'ENTRATA').map(p => punchToTime(p.punched_at)).sort()
  const exits   = punches.filter(p => p.action === 'USCITA').map(p => punchToTime(p.punched_at)).sort()

  if (planned.length === 0 && entries.length === 0 && exits.length === 0) return { type: 'empty' }

  const numPairs = Math.max(planned.length, 1)
  const pairs = []

  for (let i = 0; i < numPairs; i++) {
    const plan   = planned[i] || null
    const rawIn  = entries[i] || null
    const rawOut = exits[i]   || null

    const roundedIn  = rawIn  ? roundToHalf(rawIn)  : null
    const roundedOut = rawOut ? roundToHalf(rawOut) : null

    const effectiveIn  = roundedIn  ?? plan?.in  ?? null
    const effectiveOut = roundedOut ?? plan?.out ?? null

    pairs.push({
      plannedIn:   plan?.in  || null,
      plannedOut:  plan?.out || null,
      effectiveIn,
      effectiveOut,
      fromPunchIn:  roundedIn  !== null,
      fromPunchOut: roundedOut !== null,
      hours: calcHours(effectiveIn, effectiveOut),
    })
  }

  return { type: 'shift', pairs }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function EmployeeRiepilogoPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const today        = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [employee, setEmployee] = useState(null)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  useEffect(() => {
    async function loadMonth() {
      setLoading(true)
      const days       = getDaysInMonth(year, month)
      const firstDay   = toDateKey(days[0])
      const lastDay    = toDateKey(days[days.length - 1])

      const [{ data: turniData }, { data: punchData }] = await Promise.all([
        supabase.from('turni').select('date, shift_data')
          .eq('employee_id', id).gte('date', firstDay).lte('date', lastDay),
        supabase.from('punches').select('action, punched_at')
          .eq('employee_id', id)
          .gte('punched_at', `${firstDay}T00:00:00`)
          .lte('punched_at', `${lastDay}T23:59:59`)
          .order('punched_at'),
      ])

      const turniByDate = {}
      turniData?.forEach(r => { turniByDate[r.date] = r.shift_data })

      const punchesByDate = {}
      punchData?.forEach(p => {
        const dateKey = new Date(p.punched_at).toLocaleDateString('sv')
        if (!punchesByDate[dateKey]) punchesByDate[dateKey] = []
        punchesByDate[dateKey].push(p)
      })

      const built = days.map(d => {
        const key     = toDateKey(d)
        const shift   = turniByDate[key] ?? null
        const punches = punchesByDate[key] || []
        const merged  = mergeDay(shift, punches)
        return { date: d, dateKey: key, merged }
      }).filter(r => r.merged.type !== 'empty')

      setRows(built)
      setLoading(false)
    }
    if (id) loadMonth()
  }, [id, year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const totalHours = rows.reduce((sum, r) => {
    if (r.merged.type !== 'shift') return sum
    return sum + r.merged.pairs.reduce((s, p) => s + (p.hours || 0), 0)
  }, 0)

  const dayLabel = (date) =>
    date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace(/^./, c => c.toUpperCase())

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/admin/riepilogo')}
          className="text-petrol-400 hover:text-white transition text-sm font-semibold flex items-center gap-1">
          ← Indietro
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {employee?.nickname || employee?.name || '…'}
          </h1>
          {employee?.nickname && (
            <p className="text-petrol-400 text-sm">{employee.name}</p>
          )}
        </div>
        <span className="ml-2 text-xs font-bold px-2.5 py-1 rounded-full bg-petrol-100 text-petrol-700">
          {employee?.department}
        </span>
      </div>

      {/* Navigatore mese */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth}
          className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
        <span className="font-bold text-white text-lg min-w-[200px] text-center capitalize">
          {monthLabel(year, month)}
        </span>
        <button onClick={nextMonth}
          className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-petrol-300 text-sm">Caricamento…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-petrol-300 text-sm">Nessun dato per questo mese</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-petrol-100 bg-petrol-50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider w-32">Giorno</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Turno pianif.</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Entrata eff.</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Uscita eff.</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider w-20">Ore</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ date, dateKey, merged }, rowIdx) => {
                  const isFirst = rowIdx === 0
                  const borderClass = !isFirst ? 'border-t-2 border-petrol-100' : ''

                  // Stato speciale: OFF, FERIE, ecc.
                  if (merged.type === 'special') return (
                    <tr key={dateKey} className={`hover:bg-petrol-50/50 transition ${borderClass}`}>
                      <td className="px-5 py-3 font-semibold text-petrol-700 text-sm">{dayLabel(date)}</td>
                      <td colSpan={3} className="px-5 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${SPECIAL_STYLE[merged.value] || 'bg-gray-100 text-gray-500'}`}>
                          {merged.value}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-petrol-200 text-xs">—</td>
                    </tr>
                  )

                  const dayHours = merged.pairs.reduce((s, p) => s + (p.hours || 0), 0)
                  const nPairs   = merged.pairs.length

                  return merged.pairs.map((pair, pi) => (
                    <tr key={`${dateKey}-${pi}`}
                      className={`hover:bg-petrol-50/50 transition ${
                        pi === 0 && !isFirst ? 'border-t-2 border-petrol-100' : ''
                      } ${pi > 0 ? 'border-t border-dashed border-petrol-50' : ''}`}
                    >
                      {/* Giorno: solo prima riga, rowSpan sul numero di pair */}
                      {pi === 0 && (
                        <td rowSpan={nPairs}
                          className="px-5 py-3 font-semibold text-petrol-700 text-sm align-middle border-r border-petrol-100">
                          {dayLabel(date)}
                        </td>
                      )}

                      {/* Turno pianificato */}
                      <td className="px-5 py-3 font-mono text-xs text-petrol-300">
                        {pair.plannedIn && pair.plannedOut
                          ? `${pair.plannedIn}–${pair.plannedOut}`
                          : <span className="italic">—</span>}
                      </td>

                      {/* Entrata effettiva */}
                      <td className="px-5 py-3">
                        <TimeCell time={pair.effectiveIn} fromPunch={pair.fromPunchIn} planned={pair.plannedIn} />
                      </td>

                      {/* Uscita effettiva */}
                      <td className="px-5 py-3">
                        <TimeCell time={pair.effectiveOut} fromPunch={pair.fromPunchOut} planned={pair.plannedOut} />
                      </td>

                      {/* Ore: solo nell'ultima riga del giorno, senza rowSpan */}
                      {pi === nPairs - 1 ? (
                        <td className="px-5 py-3 text-right font-bold text-petrol-800 align-middle">
                          {fmtHours(dayHours)}
                        </td>
                      ) : (
                        <td />
                      )}
                    </tr>
                  ))
                })}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-petrol-200 bg-petrol-50">
                  <td colSpan={4} className="px-5 py-4 font-bold text-petrol-700 text-sm capitalize">
                    Totale {monthLabel(year, month)}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-petrol-900 text-base">
                    {fmtHours(totalHours)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex gap-5 mt-4 text-xs text-petrol-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-petrol-600 inline-block"></span>
          Orario da timbratura (arrotondato)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-petrol-200 inline-block"></span>
          Orario dal turno pianificato (timbratura mancante)
        </span>
      </div>
    </>
  )
}

function TimeCell({ time, fromPunch, planned }) {
  if (!time) return <span className="text-petrol-200 text-xs">—</span>
  return (
    <span className={`font-mono font-semibold text-sm flex items-center gap-1.5 ${fromPunch ? 'text-petrol-800' : 'text-petrol-300'}`}>
      {time}
      {!fromPunch && planned && (
        <span className="text-[10px] bg-amber-50 text-amber-500 border border-amber-200 px-1 rounded font-bold">
          turno
        </span>
      )}
    </span>
  )
}
