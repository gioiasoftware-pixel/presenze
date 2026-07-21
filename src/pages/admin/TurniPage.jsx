import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import TurniGrid from './turni/TurniGrid'
import ShiftTemplates from './turni/ShiftTemplates'
import { exportTurniPng } from './turni/exportTurniPng'
import {
  DEFAULT_TEMPLATES,
  getMonday,
  addDays,
  toKey,
  formatDay,
  formatWeekRange,
} from './turni/turniData'

const DEPTS = ['SALA', 'CUCINA']

export default function TurniPage() {
  const [dept, setDept]           = useState('SALA')
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts]       = useState({})
  const [templates, setTemplates] = useState([])
  const [exporting, setExporting]         = useState(false)
  const [copying, setCopying]             = useState(false)
  const [autofilling, setAutofilling]     = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showMenu, setShowMenu]           = useState(false)

  const days = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, dateKey: toKey(date), label: formatDay(date) }
    })
  ), [weekStart])

  const emptyCount = useMemo(() => {
    let n = 0
    for (const emp of employees)
      for (const day of days)
        if (shifts[emp.id]?.[day.dateKey] === undefined) n++
    return n
  }, [employees, days, shifts])

  // Carica dipendenti + turni quando cambia reparto o settimana
  const load = useCallback(async () => {
    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, nickname')
      .eq('department', dept)
      .order('name')

    const list = emps || []
    setEmployees(list)

    if (list.length === 0) { setShifts({}); return }

    const { data: rows } = await supabase
      .from('turni')
      .select('employee_id, date, shift_data')
      .in('employee_id', list.map(e => e.id))
      .in('date', days.map(d => d.dateKey))

    const s = {}
    rows?.forEach(r => {
      if (!s[r.employee_id]) s[r.employee_id] = {}
      s[r.employee_id][r.date] = r.shift_data
    })
    setShifts(s)
  }, [dept, weekStart])

  useEffect(() => { load() }, [load])

  // Carica templates per reparto corrente (o semina i default se vuoto per quel reparto)
  useEffect(() => {
    async function loadTemplates() {
      setTemplates([])
      const { data } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('department', dept)
        .order('sort_order', { ascending: true })

      if (data && data.length > 0) {
        setTemplates(data.map(t => ({ id: t.id, name: t.name, pairs: t.pairs, color: t.color })))
      } else {
        // Prima volta per questo reparto: semina i default
        const toInsert = DEFAULT_TEMPLATES.map((t, i) => ({
          name: t.name, pairs: t.pairs, color: t.color, sort_order: i, department: dept,
        }))
        const { data: seeded } = await supabase.from('shift_templates').insert(toInsert).select()
        if (seeded) setTemplates(seeded.map(t => ({ id: t.id, name: t.name, pairs: t.pairs, color: t.color })))
      }
    }
    loadTemplates()
  }, [dept])

  function prevWeek() { setWeekStart(d => addDays(d, -7)) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)) }
  function goToday()  { setWeekStart(getMonday(new Date())) }

  async function handleCellChange(empId, dateKey, value) {
    setShifts(prev => {
      const emp = { ...(prev[empId] || {}) }
      if (value === null) delete emp[dateKey]
      else emp[dateKey] = value
      return { ...prev, [empId]: emp }
    })
    if (value === null) {
      await supabase.from('turni').delete()
        .eq('employee_id', empId).eq('date', dateKey)
    } else {
      await supabase.from('turni').upsert(
        { employee_id: empId, date: dateKey, shift_data: value },
        { onConflict: 'employee_id,date' }
      )
    }
  }

  async function handleTemplateSave(t) {
    if (!t.id) {
      // Nuovo template
      const { data, error } = await supabase.from('shift_templates').insert({
        name: t.name, pairs: t.pairs, color: t.color, sort_order: templates.length, department: dept,
      }).select().single()
      if (error) { alert('Errore: ' + error.message); return }
      setTemplates(prev => [...prev, { id: data.id, name: data.name, pairs: data.pairs, color: data.color }])
    } else {
      // Aggiorna
      const { error } = await supabase.from('shift_templates').update({
        name: t.name, pairs: t.pairs, color: t.color,
      }).eq('id', t.id)
      if (error) { alert('Errore: ' + error.message); return }
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, name: t.name, pairs: t.pairs, color: t.color } : x))
    }
  }

  async function handleTemplateDelete(id) {
    await supabase.from('shift_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function handleCopyPrevWeek() {
    if (employees.length === 0) return
    if (!window.confirm('Copia i turni della settimana precedente in quella corrente? I turni già presenti verranno sovrascritti.')) return

    setCopying(true)
    try {
      // Mappa ogni giorno corrente al corrispondente giorno della settimana precedente
      const dayMap = {}
      days.forEach(d => {
        const prevKey = toKey(addDays(weekStart, days.indexOf(d) - 7))
        dayMap[prevKey] = d.dateKey
      })

      const prevDateKeys = Object.keys(dayMap)

      const { data: prevRows } = await supabase
        .from('turni')
        .select('employee_id, date, shift_data')
        .in('employee_id', employees.map(e => e.id))
        .in('date', prevDateKeys)

      if (!prevRows || prevRows.length === 0) {
        alert('Nessun turno trovato nella settimana precedente.')
        return
      }

      const toUpsert = prevRows.map(r => ({
        employee_id: r.employee_id,
        date:        dayMap[r.date],
        shift_data:  r.shift_data,
      }))

      await supabase.from('turni').upsert(toUpsert, { onConflict: 'employee_id,date' })

      // Aggiorna stato locale
      setShifts(prev => {
        const next = { ...prev }
        toUpsert.forEach(r => {
          if (!next[r.employee_id]) next[r.employee_id] = {}
          next[r.employee_id] = { ...next[r.employee_id], [r.date]: r.shift_data }
        })
        return next
      })
    } finally {
      setCopying(false)
    }
  }

  function serializeShift(sd) {
    if (typeof sd === 'string') return sd
    if (!sd?.pairs?.length) return null
    return sd.pairs.map(p => `${p.in}-${p.out}`).join('|')
  }

  async function handleAutofill() {
    if (employees.length === 0) return
    setAutofilling(true)
    try {
      // Slot vuoti della settimana corrente
      const emptySlots = []
      for (const emp of employees)
        for (const day of days)
          if (shifts[emp.id]?.[day.dateKey] === undefined)
            emptySlots.push({ empId: emp.id, dateKey: day.dateKey, dow: day.date.getDay() })
      if (emptySlots.length === 0) return

      // Fetch ultime 12 settimane (esclusa settimana corrente)
      const histStart = toKey(addDays(weekStart, -84))
      const histEnd   = toKey(addDays(weekStart, -1))
      const { data: histRows } = await supabase
        .from('turni').select('employee_id, date, shift_data')
        .in('employee_id', employees.map(e => e.id))
        .gte('date', histStart).lte('date', histEnd)

      // Voti pesati: { empId: { dow: { shiftKey: { weight, recency, shiftData } } } }
      const votes   = {}
      const weekMs  = weekStart.getTime()

      for (const row of histRows || []) {
        const sd = row.shift_data
        if (sd === 'FERIE' || sd === 'MALATTIA') continue

        const rowMs    = new Date(row.date + 'T00:00:00').getTime()
        const daysAgo  = Math.round((weekMs - rowMs) / 86400000)
        const weeksAgo = Math.ceil(daysAgo / 7)
        if (weeksAgo < 1 || weeksAgo > 12) continue

        const weight = 13 - weeksAgo // settimana 1 = peso 12, settimana 12 = peso 1
        const dow    = new Date(row.date + 'T00:00:00').getDay()
        const key    = serializeShift(sd)
        if (!key) continue

        const { employee_id: empId } = row
        if (!votes[empId])        votes[empId] = {}
        if (!votes[empId][dow])   votes[empId][dow] = {}
        if (!votes[empId][dow][key]) votes[empId][dow][key] = { weight: 0, recency: 0, shiftData: sd }
        votes[empId][dow][key].weight  += weight
        votes[empId][dow][key].recency  = Math.max(votes[empId][dow][key].recency, weight)
      }

      // Per ogni slot vuoto: vince il turno col peso più alto (parità → più recente)
      const toUpsert  = []
      const newShifts = {}

      for (const { empId, dateKey, dow } of emptySlots) {
        const opts = votes[empId]?.[dow]
        if (!opts) continue
        let best = null
        for (const v of Object.values(opts)) {
          if (!best || v.weight > best.weight || (v.weight === best.weight && v.recency > best.recency))
            best = v
        }
        if (!best) continue
        toUpsert.push({ employee_id: empId, date: dateKey, shift_data: best.shiftData })
        if (!newShifts[empId]) newShifts[empId] = {}
        newShifts[empId][dateKey] = best.shiftData
      }

      if (toUpsert.length > 0) {
        await supabase.from('turni').upsert(toUpsert, { onConflict: 'employee_id,date' })
        setShifts(prev => {
          const next = { ...prev }
          for (const [empId, ds] of Object.entries(newShifts))
            next[empId] = { ...(next[empId] || {}), ...ds }
          return next
        })
      }
    } finally {
      setAutofilling(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportTurniPng({ employees, days, shifts, dept, weekRange: formatWeekRange(weekStart) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Turni</h1>
          <p className="text-petrol-300 mt-1 text-sm">Pianifica la settimana per reparto</p>
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

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={prevWeek} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
            <span className="font-semibold text-white min-w-[160px] text-center text-sm">{formatWeekRange(weekStart)}</span>
            <button onClick={nextWeek} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
            <button onClick={goToday} className="text-xs text-petrol-400 hover:text-white transition font-medium">Oggi</button>
            <div className="ml-auto flex items-center gap-2">
              {/* Prefab toggle — tutti gli schermi */}
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-semibold transition"
              >
                <span>★</span>
                <span className="text-petrol-400 text-xs">{showTemplates ? '▲' : '▼'}</span>
              </button>

              {/* Menu ⋮ — solo mobile */}
              <div className="md:hidden relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl w-9 h-9 text-lg font-bold transition"
                >
                  ⋮
                </button>
                {showMenu && (
                  <>
                    {/* Overlay per chiudere */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-11 z-50 bg-petrol-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden min-w-[180px]">
                      {emptyCount > 0 && (
                        <>
                          <button
                            onClick={() => { setShowMenu(false); handleAutofill() }}
                            disabled={autofilling || employees.length === 0}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-petrol-300 hover:bg-white/10 transition disabled:opacity-40 text-left"
                          >
                            <span>✦</span> Autofill settimana
                          </button>
                          <div className="border-t border-white/10" />
                        </>
                      )}
                      <button
                        onClick={() => { setShowMenu(false); handleCopyPrevWeek() }}
                        disabled={copying || employees.length === 0}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-40 text-left"
                      >
                        <span>⎘</span> Copia sett. prec.
                      </button>
                      <div className="border-t border-white/10" />
                      <button
                        onClick={() => { setShowMenu(false); handleExport() }}
                        disabled={exporting}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-40 text-left"
                      >
                        <span>↓</span> Scarica PNG
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Bottoni normali — solo desktop */}
              {emptyCount > 0 && (
                <button onClick={handleAutofill} disabled={autofilling || employees.length === 0}
                  className="hidden md:flex items-center gap-2 bg-petrol-600/80 hover:bg-petrol-500 border border-petrol-500/50 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40">
                  {autofilling ? <><span className="animate-spin">⟳</span>Calcolo…</> : <><span>✦</span>Autofill</>}
                </button>
              )}
              <button onClick={handleCopyPrevWeek} disabled={copying || employees.length === 0}
                className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40">
                {copying ? <><span className="animate-spin">⟳</span>Copio…</> : <><span>⎘</span>Copia sett. prec.</>}
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50">
                {exporting ? <><span className="animate-spin">⟳</span>Esporto…</> : <><span>↓</span>Scarica PNG</>}
              </button>
            </div>
          </div>

          {/* Pannello prefab a scomparsa — solo mobile */}
          {showTemplates && (
            <div className="md:hidden">
              <ShiftTemplates
                templates={templates}
                onSave={handleTemplateSave}
                onDelete={handleTemplateDelete}
              />
            </div>
          )}

          <TurniGrid
            employees={employees}
            days={days}
            shifts={shifts}
            templates={templates}
            onCellChange={handleCellChange}
            onSaveAsTemplate={handleTemplateSave}
          />

          <div className="flex gap-4 text-xs text-petrol-400 flex-wrap">
            <span>• ☰ apre il menu per applicare turni e stati speciali</span>
            <span>• + 2° turno per gli spezzati manuali</span>
          </div>
        </div>

        {/* Pannello prefab — desktop (sidebar a scomparsa) */}
        {showTemplates && (
          <div className="hidden md:block w-60 shrink-0">
            <ShiftTemplates
              templates={templates}
              onSave={handleTemplateSave}
              onDelete={handleTemplateDelete}
            />
          </div>
        )}
      </div>
    </>
  )
}
