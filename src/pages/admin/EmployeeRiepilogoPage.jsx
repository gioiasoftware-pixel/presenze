import { useState, useEffect, useCallback } from 'react'
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
  let diff = (oh * 60 + om) - (ih * 60 + im)
  if (diff < 0) diff += 24 * 60
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

// Costruisce coppie entrata→uscita in ordine cronologico (gestisce mezzanotte)
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

// ── Merge turno + timbrature ──────────────────────────────────────────────────

const SPECIAL_STYLE = {
  OFF:      'bg-gray-100 text-gray-500',
  FERIE:    'bg-green-100 text-green-700',
  MALATTIA: 'bg-red-100 text-red-700',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}

function mergeDay(shiftData, actualPairs) {
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

    const roundedIn  = rawIn  ? roundToHalf(rawIn)  : null
    const roundedOut = rawOut ? roundToHalf(rawOut) : null

    const effectiveIn  = roundedIn  ?? plan?.in  ?? null
    const effectiveOut = roundedOut ?? plan?.out ?? null

    pairs.push({
      plannedIn:    plan?.in  || null,
      plannedOut:   plan?.out || null,
      effectiveIn,
      effectiveOut,
      fromPunchIn:  roundedIn  !== null,
      fromPunchOut: roundedOut !== null,
      entryPunch:   actual.entry || null,
      exitPunch:    actual.exit  || null,
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
  const [allPunches, setAllPunches] = useState([])

  // editing = { type:'edit'|'add', punchId?:string, dateKey:string, action:'ENTRATA'|'USCITA', pairIdx:number, nextDay:bool }
  const [editing, setEditing]   = useState(null)
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  const loadMonth = useCallback(async () => {
    setLoading(true)
    const days     = getDaysInMonth(year, month)
    const firstDay = toDateKey(days[0])
    const lastDay  = toDateKey(days[days.length - 1])
    // Estendi di 6 ore per catturare uscite dopo mezzanotte dell'ultimo giorno
    const nextDay  = new Date(days[days.length - 1])
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayKey = toDateKey(nextDay)

    const [{ data: turniData }, { data: punchData }] = await Promise.all([
      supabase.from('turni').select('date, shift_data')
        .eq('employee_id', id).gte('date', firstDay).lte('date', lastDay),
      supabase.from('punches').select('id, action, punched_at')
        .eq('employee_id', id)
        .gte('punched_at', `${firstDay}T00:00:00`)
        .lte('punched_at', `${nextDayKey}T05:59:59`)
        .order('punched_at'),
    ])

    setAllPunches(punchData || [])

    const turniByDate = {}
    turniData?.forEach(r => { turniByDate[r.date] = r.shift_data })

    // Costruisce coppie cross-midnight e raggruppa per giorno dell'entrata
    const allPairs = buildPairs(punchData || [])
    const pairsByDate = {}
    for (const pair of allPairs) {
      const ref = pair.entry || pair.exit
      const dk  = new Date(ref.punched_at).toLocaleDateString('sv')
      if (dk >= firstDay && dk <= lastDay) {
        if (!pairsByDate[dk]) pairsByDate[dk] = []
        pairsByDate[dk].push(pair)
      }
    }

    const built = days.map(d => {
      const key         = toDateKey(d)
      const shift       = turniByDate[key] ?? null
      const actualPairs = pairsByDate[key] || []
      const merged      = mergeDay(shift, actualPairs)
      return { date: d, dateKey: key, merged }
    }).filter(r => r.merged.type !== 'empty')

    setRows(built)
    setLoading(false)
  }, [id, year, month])

  useEffect(() => { if (id) loadMonth() }, [loadMonth])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function startEdit(punch) {
    setEditing({ type: 'edit', punchId: punch.id, action: punch.action })
    setEditTime(punchToTime(punch.punched_at))
  }

  function startAdd(dateKey, action, pairIdx) {
    setEditing({ type: 'add', dateKey, action, pairIdx, nextDay: false })
    setEditTime('')
  }

  function cancelEdit() { setEditing(null); setEditTime('') }

  async function saveEdit() {
    if (!editTime) return
    setSaving(true)
    try {
      if (editing.type === 'edit') {
        const punch = allPunches.find(p => p.id === editing.punchId)
        if (!punch) return
        const orig = new Date(punch.punched_at)
        const [h, m] = editTime.split(':').map(Number)
        orig.setHours(h, m, 0, 0)
        await supabase.from('punches').update({ punched_at: orig.toISOString() }).eq('id', editing.punchId)
      } else {
        const [h, m] = editTime.split(':').map(Number)
        const base = new Date(editing.dateKey + 'T12:00:00')
        if (editing.nextDay) base.setDate(base.getDate() + 1)
        base.setHours(h, m, 0, 0)
        await supabase.from('punches').insert({
          employee_id: id,
          action: editing.action,
          punched_at: base.toISOString(),
        })
      }
      setEditing(null)
      setEditTime('')
      await loadMonth()
    } finally {
      setSaving(false)
    }
  }

  async function deletePunch(punchId) {
    if (!window.confirm('Eliminare questa timbratura?')) return
    await supabase.from('punches').delete().eq('id', punchId)
    await loadMonth()
  }

  const totalHours = rows.reduce((sum, r) => {
    if (r.merged.type !== 'shift') return sum
    return sum + r.merged.pairs.reduce((s, p) => s + (p.hours || 0), 0)
  }, 0)

  const dayLabel = (date) =>
    date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
      .replace(/^./, c => c.toUpperCase())

  const isEditing = (punch) => punch && editing?.type === 'edit' && editing.punchId === punch.id
  const isAdding  = (dateKey, action, pairIdx) =>
    editing?.type === 'add' && editing.dateKey === dateKey &&
    editing.action === action && editing.pairIdx === pairIdx

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
                      {pi === 0 && (
                        <td rowSpan={nPairs}
                          className="px-5 py-3 font-semibold text-petrol-700 text-sm align-middle border-r border-petrol-100">
                          {dayLabel(date)}
                        </td>
                      )}

                      <td className="px-5 py-3 font-mono text-xs text-petrol-300">
                        {pair.plannedIn && pair.plannedOut
                          ? `${pair.plannedIn}–${pair.plannedOut}`
                          : <span className="italic">—</span>}
                      </td>

                      {/* Entrata */}
                      <td className="px-5 py-2">
                        {isEditing(pair.entryPunch) ? (
                          <EditInput value={editTime} onChange={setEditTime} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                        ) : isAdding(dateKey, 'ENTRATA', pi) ? (
                          <EditInput value={editTime} onChange={setEditTime} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                        ) : pair.entryPunch ? (
                          <EditableTimeCell
                            time={pair.effectiveIn}
                            fromPunch={pair.fromPunchIn}
                            planned={pair.plannedIn}
                            onEdit={() => startEdit(pair.entryPunch)}
                            onDelete={() => deletePunch(pair.entryPunch.id)}
                          />
                        ) : (
                          <AddPunchButton onClick={() => startAdd(dateKey, 'ENTRATA', pi)} />
                        )}
                      </td>

                      {/* Uscita */}
                      <td className="px-5 py-2">
                        {isEditing(pair.exitPunch) ? (
                          <EditInput value={editTime} onChange={setEditTime} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                        ) : isAdding(dateKey, 'USCITA', pi) ? (
                          <EditInput
                            value={editTime}
                            onChange={setEditTime}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                            saving={saving}
                            showNextDay
                            nextDay={editing?.nextDay || false}
                            onNextDayChange={v => setEditing(prev => ({ ...prev, nextDay: v }))}
                          />
                        ) : pair.exitPunch ? (
                          <EditableTimeCell
                            time={pair.effectiveOut}
                            fromPunch={pair.fromPunchOut}
                            planned={pair.plannedOut}
                            onEdit={() => startEdit(pair.exitPunch)}
                            onDelete={() => deletePunch(pair.exitPunch.id)}
                          />
                        ) : (
                          <AddPunchButton onClick={() => startAdd(dateKey, 'USCITA', pi)} />
                        )}
                      </td>

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
          Orario da timbratura (arrotondato) — clicca per modificare
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-petrol-200 inline-block"></span>
          Orario dal turno pianificato (timbratura mancante)
        </span>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EditInput({ value, onChange, onSave, onCancel, saving, showNextDay, nextDay, onNextDayChange }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus
          className="border border-petrol-300 rounded px-1.5 py-0.5 text-sm font-mono text-petrol-800 w-24 focus:outline-none focus:border-petrol-500"
        />
        <button onClick={onSave} disabled={saving || !value}
          className="text-green-600 hover:text-green-700 font-bold text-base px-1 disabled:opacity-40 transition">
          ✓
        </button>
        <button onClick={onCancel}
          className="text-red-400 hover:text-red-600 font-bold text-base px-1 transition">
          ×
        </button>
      </div>
      {showNextDay && (
        <label className="flex items-center gap-1.5 text-xs text-petrol-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={nextDay}
            onChange={e => onNextDayChange(e.target.checked)}
            className="accent-petrol-600"
          />
          giorno successivo (dopo mezzanotte)
        </label>
      )}
    </div>
  )
}

function EditableTimeCell({ time, fromPunch, planned, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 group">
      <span
        onClick={onEdit}
        className={`font-mono font-semibold text-sm flex items-center gap-1.5 cursor-pointer hover:underline ${fromPunch ? 'text-petrol-800' : 'text-petrol-300'}`}
      >
        {time}
        {!fromPunch && planned && (
          <span className="text-[10px] bg-amber-50 text-amber-500 border border-amber-200 px-1 rounded font-bold">
            turno
          </span>
        )}
      </span>
      {fromPunch && (
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 text-xs font-bold opacity-0 group-hover:opacity-60 hover:!opacity-100 transition"
          title="Elimina timbratura"
        >
          ×
        </button>
      )}
    </div>
  )
}

function AddPunchButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-petrol-300 hover:text-petrol-600 text-xs font-semibold border border-dashed border-petrol-200 hover:border-petrol-400 rounded px-2 py-0.5 transition"
    >
      + Aggiungi
    </button>
  )
}
