import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { getMonday, addDays, toKey, formatWeekRange } from './turni/turniData'

const DEPTS = ['SALA', 'CUCINA']

// ── Calcoli ore ───────────────────────────────────────────────────────────────

function calcPlanned(shiftData) {
  if (!shiftData || typeof shiftData === 'string') return 0
  return (shiftData.pairs || []).reduce((sum, p) => {
    const [ih, im] = p.in.split(':').map(Number)
    const [oh, om] = p.out.split(':').map(Number)
    let diff = (oh * 60 + om) - (ih * 60 + im)
    if (diff < 0) diff += 24 * 60
    return sum + (diff > 0 ? diff / 60 : 0)
  }, 0)
}

function buildPairs(sorted) {
  const pairs = []
  let pending = null
  for (const p of sorted) {
    if (p.action === 'ENTRATA') {
      if (pending) pairs.push({ entry: pending, exit: null })
      pending = p
    } else {
      pairs.push({ entry: pending, exit: p })
      pending = null
    }
  }
  if (pending) pairs.push({ entry: pending, exit: null })
  return pairs
}

function calcActual(punches) {
  if (!punches?.length) return null
  const sorted = [...punches].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
  const pairs  = buildPairs(sorted)
  let total = 0
  for (const { entry, exit } of pairs) {
    if (!entry || !exit) continue
    const diff = (new Date(exit.punched_at) - new Date(entry.punched_at)) / 3600000
    if (diff > 0) total += diff
  }
  return total > 0 ? total : null
}

function fmtH(h) {
  if (h === null || h === undefined || h === 0) return '0h'
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function StatistichePage() {
  const today = new Date()

  const [dept, setDept]           = useState('SALA')
  const [view, setView]           = useState('settimana')   // 'settimana' | 'mese'
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [month, setMonth]         = useState(today.getMonth())
  const [year, setYear]           = useState(today.getFullYear())
  const [stats, setStats]         = useState([])
  const [loading, setLoading]     = useState(true)

  // Giorni del periodo corrente
  const days = useMemo(() => {
    if (view === 'settimana') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i)
        return { date: d, dateKey: toKey(d) }
      })
    } else {
      return getDaysInMonth(year, month).map(d => ({ date: d, dateKey: toKey(d) }))
    }
  }, [view, weekStart, year, month])

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, nickname')
      .eq('department', dept)
      .order('name')

    const list = emps || []
    if (list.length === 0) { setStats([]); setLoading(false); return }

    const firstDay = days[0].dateKey
    const lastDay  = days[days.length - 1].dateKey
    const nextDay  = toKey(addDays(days[days.length - 1].date, 1))
    const empIds   = list.map(e => e.id)

    const [{ data: turniData }, { data: punchData }] = await Promise.all([
      supabase.from('turni').select('employee_id, date, shift_data')
        .in('employee_id', empIds)
        .in('date', days.map(d => d.dateKey)),
      supabase.from('punches').select('employee_id, action, punched_at')
        .in('employee_id', empIds)
        .gte('punched_at', `${firstDay}T00:00:00`)
        .lte('punched_at', `${nextDay}T05:59:59`)
        .order('punched_at'),
    ])

    const turniByEmp = {}
    turniData?.forEach(r => {
      if (!turniByEmp[r.employee_id]) turniByEmp[r.employee_id] = {}
      turniByEmp[r.employee_id][r.date] = r.shift_data
    })

    const punchesByEmp = {}
    punchData?.forEach(p => {
      if (!punchesByEmp[p.employee_id]) punchesByEmp[p.employee_id] = []
      punchesByEmp[p.employee_id].push(p)
    })

    const computed = list.map(emp => {
      let planned     = 0
      let giorniTurno = 0

      for (const { dateKey } of days) {
        const shift = turniByEmp[emp.id]?.[dateKey] ?? null
        if (shift && typeof shift !== 'string') {
          const h = calcPlanned(shift)
          planned += h
          if (h > 0) giorniTurno++
        }
      }

      const empPunches = punchesByEmp[emp.id] || []
      const actual     = calcActual(empPunches)

      const giorniLavorati = (() => {
        if (!empPunches.length) return null
        const sorted = [...empPunches].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
        const pairs  = buildPairs(sorted)
        const daySet = new Set()
        for (const { entry, exit } of pairs) {
          const ref = entry || exit
          if (ref) daySet.add(new Date(ref.punched_at).toLocaleDateString('sv'))
        }
        return daySet.size
      })()

      const delta = actual !== null && planned > 0 ? actual - planned : null
      return { emp, planned, actual, giorniTurno, giorniLavorati, delta }
    })

    setStats(computed)
    setLoading(false)
  }, [dept, days])

  useEffect(() => { loadData() }, [loadData])

  // ── Navigazione ───────────────────────────────────────────────────────────

  function prevPeriod() {
    if (view === 'settimana') setWeekStart(d => addDays(d, -7))
    else if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextPeriod() {
    if (view === 'settimana') setWeekStart(d => addDays(d, 7))
    else if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }
  function goToday() {
    if (view === 'settimana') setWeekStart(getMonday(today))
    else { setMonth(today.getMonth()); setYear(today.getFullYear()) }
  }

  const periodLabel = view === 'settimana'
    ? formatWeekRange(weekStart)
    : monthLabel(year, month).replace(/^./, c => c.toUpperCase())

  // ── Dati derivati ─────────────────────────────────────────────────────────

  const sortedStats = [...stats].sort((a, b) => (b.actual ?? b.planned) - (a.actual ?? a.planned))
  const maxH        = Math.max(...stats.map(s => Math.max(s.planned || 0, s.actual || 0, 1)), 1)
  const totPlanned  = stats.reduce((s, r) => s + r.planned, 0)
  const totActual   = stats.some(r => r.actual !== null)
    ? stats.reduce((s, r) => s + (r.actual || 0), 0)
    : null

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Statistiche</h1>
          <p className="text-petrol-300 mt-1 text-sm">Ore lavorate per reparto nel periodo selezionato</p>
        </div>
        <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10">
          {DEPTS.map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                dept === d ? 'bg-petrol-600 text-white shadow' : 'text-petrol-300 hover:text-white'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Controlli periodo */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {/* Toggle vista */}
        <div className="flex bg-white/8 rounded-xl p-1 gap-1 border border-white/10">
          {['settimana', 'mese'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                view === v ? 'bg-white/20 text-white' : 'text-petrol-400 hover:text-white'
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Navigazione */}
        <button onClick={prevPeriod}
          className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
        <span className="font-semibold text-white min-w-[220px] text-center text-sm">{periodLabel}</span>
        <button onClick={nextPeriod}
          className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
        <button onClick={goToday}
          className="text-xs text-petrol-400 hover:text-white transition font-medium">Oggi</button>
      </div>

      {loading ? (
        <div className="text-petrol-400 text-sm py-12 text-center">Caricamento…</div>
      ) : stats.length === 0 ? (
        <div className="text-petrol-500 text-sm py-12 text-center">Nessun dipendente nel reparto</div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Grafico ── */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-petrol-800 font-bold text-base">
                Ore {view} — {dept}
              </h2>
              <div className="flex items-center gap-3 text-xs text-petrol-500 flex-wrap justify-end">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm bg-petrol-200 inline-block"></span>
                  Pianificate
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm bg-petrol-600 inline-block"></span>
                  Effettive (nella norma)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
                  Effettive (ore mancanti)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
                  Effettive (straordinario)
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {sortedStats.map(({ emp, planned, actual, delta }) => {
                const planPct = (planned / maxH) * 100
                const actPct  = actual !== null ? Math.min((actual / maxH) * 100, 100) : null
                const isShort = delta !== null && delta < -0.5
                const isOver  = delta !== null && delta > 0.5

                return (
                  <div key={emp.id} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-sm font-semibold text-petrol-700 block truncate">
                        {emp.nickname || emp.name}
                      </span>
                    </div>

                    <div className="flex-1 relative h-7 bg-petrol-50 rounded-lg overflow-hidden">
                      {planPct > 0 && (
                        <div className="absolute inset-y-0 left-0 bg-petrol-200 rounded-lg"
                          style={{ width: `${planPct}%` }} />
                      )}
                      {actPct !== null && actPct > 0 && (
                        <div className={`absolute inset-y-0 left-0 rounded-lg ${
                            isShort ? 'bg-amber-400' : isOver ? 'bg-emerald-500' : 'bg-petrol-600'
                          }`}
                          style={{ width: `${actPct}%` }} />
                      )}
                    </div>

                    <div className="w-36 shrink-0 flex items-center gap-1.5 flex-wrap">
                      {actual !== null ? (
                        <>
                          <span className="text-sm font-black text-petrol-900 tabular-nums">{fmtH(actual)}</span>
                          {planned > 0 && (
                            <span className="text-xs text-petrol-400 tabular-nums">/ {fmtH(planned)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-petrol-400 tabular-nums">{fmtH(planned)}</span>
                      )}
                      {delta !== null && Math.abs(delta) >= 0.25 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isOver ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isOver ? '+' : ''}{fmtH(delta)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Asse ore */}
            <div className="mt-5 flex ml-[calc(6rem+0.75rem)] mr-[calc(9rem+0.75rem)]">
              {[0, 0.25, 0.5, 0.75, 1].map(v => (
                <div key={v} className="flex-1 text-[9px] text-petrol-300 tabular-nums">
                  {v > 0 ? `${Math.round(maxH * v)}h` : ''}
                </div>
              ))}
            </div>
          </div>

          {/* ── Tabella riepilogo ── */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-petrol-100 bg-petrol-50">
                    <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Dipendente</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Giorni turno</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Pianificate</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Effettive</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Delta</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Giorni lavorati</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(({ emp, planned, actual, delta, giorniTurno, giorniLavorati }) => (
                    <tr key={emp.id} className="border-t border-petrol-100 hover:bg-petrol-50/40 transition">
                      <td className="px-5 py-3 font-semibold text-petrol-800">{emp.nickname || emp.name}</td>
                      <td className="px-4 py-3 text-center text-petrol-600 tabular-nums">{giorniTurno}</td>
                      <td className="px-4 py-3 text-center font-mono text-petrol-600 tabular-nums">{fmtH(planned)}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">
                        {actual !== null
                          ? <span className="font-bold text-petrol-900">{fmtH(actual)}</span>
                          : <span className="text-petrol-300 text-xs italic">nessuna timbratura</span>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {delta !== null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            Math.abs(delta) < 0.25
                              ? 'text-petrol-400'
                              : delta > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}>
                            {Math.abs(delta) < 0.25 ? '=' : delta > 0 ? '+' : ''}{fmtH(delta)}
                          </span>
                        ) : <span className="text-petrol-200">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-petrol-600 tabular-nums">
                        {giorniLavorati !== null ? giorniLavorati : <span className="text-petrol-200">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-petrol-200 bg-petrol-50">
                    <td className="px-5 py-4 font-bold text-petrol-700 text-sm">Totale {dept}</td>
                    <td className="px-4 py-4 text-center font-bold text-petrol-700 tabular-nums">
                      {stats.reduce((s, r) => s + r.giorniTurno, 0)}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-petrol-700 tabular-nums">{fmtH(totPlanned)}</td>
                    <td className="px-4 py-4 text-center font-black text-petrol-900 tabular-nums">
                      {totActual !== null
                        ? fmtH(totActual)
                        : <span className="text-petrol-300 text-xs font-normal italic">nessuna timbratura</span>}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}
    </>
  )
}
