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
  const [exporting, setExporting] = useState(false)
  const [copying, setCopying]     = useState(false)

  const days = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      return { date, dateKey: toKey(date), label: formatDay(date) }
    })
  ), [weekStart])

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
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
            <span className="font-semibold text-white min-w-[200px] text-center">{formatWeekRange(weekStart)}</span>
            <button onClick={nextWeek} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
            <button onClick={goToday} className="text-xs text-petrol-400 hover:text-white transition ml-1 font-medium">Oggi</button>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleCopyPrevWeek} disabled={copying || employees.length === 0}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
                title="Copia i turni dalla settimana precedente">
                {copying ? <><span className="animate-spin">⟳</span>Copio…</> : <><span>⎘</span>Copia sett. prec.</>}
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50">
                {exporting ? <><span className="animate-spin">⟳</span>Esporto…</> : <><span>↓</span>Scarica PNG</>}
              </button>
            </div>
          </div>

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

        <div className="w-60 shrink-0">
          <ShiftTemplates
            templates={templates}
            onSave={handleTemplateSave}
            onDelete={handleTemplateDelete}
          />
        </div>
      </div>
    </>
  )
}
