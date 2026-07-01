import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS_IT   = ['dom','lun','mar','mer','gio','ven','sab']

const DEPT_STYLE = {
  SALA:   'bg-petrol-100 text-petrol-700',
  CUCINA: 'bg-amber-100 text-amber-700',
}

const SPECIAL_CSV = { OFF: 'R', FERIE: 'F', MALATTIA: 'M', PERMESSO: 'PE' }

// ── Utility calcolo ore ───────────────────────────────────────────────────────

function roundToHalfHours(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  return Math.round((h * 60 + m) / 30) * 30 / 60
}

function punchToTime(isoStr) {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function calcDayValue(shiftData, punches) {
  if (!shiftData && punches.length === 0) return ''
  if (typeof shiftData === 'string') return SPECIAL_CSV[shiftData] || 'R'

  const planned = shiftData?.pairs || []
  const entries = punches.filter(p => p.action === 'ENTRATA').map(p => punchToTime(p.punched_at)).sort()
  const exits   = punches.filter(p => p.action === 'USCITA').map(p => punchToTime(p.punched_at)).sort()

  if (planned.length === 0 && entries.length === 0 && exits.length === 0) return ''

  const numPairs = Math.max(planned.length, entries.length, exits.length, 1)
  let total = 0

  for (let i = 0; i < numPairs; i++) {
    const plan = planned[i] || null
    const inH  = entries[i] ? roundToHalfHours(entries[i]) : (plan?.in  ? roundToHalfHours(plan.in)  : null)
    const outH = exits[i]   ? roundToHalfHours(exits[i])   : (plan?.out ? roundToHalfHours(plan.out) : null)
    if (inH !== null && outH !== null && outH > inH) total += outH - inH
  }

  if (total === 0) return ''
  const whole = Math.floor(total)
  const frac  = Math.round((total - whole) * 10)
  return `${whole},${frac === 0 ? '0' : frac}`
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function csvRow(cells) {
  return cells.map(c => {
    const s = String(c ?? '')
    return s.includes(';') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s
  }).join(';')
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function RiepilogoPage() {
  const today = new Date()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [exporting, setExporting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .order('department').order('name')
      .then(({ data }) => { setEmployees(data || []); setLoading(false) })
  }, [])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  async function handleExportCSV() {
    if (employees.length === 0) return
    setExporting(true)
    try {
      const days     = getDaysInMonth(year, month)
      const firstDay = toDateKey(days[0])
      const lastDay  = toDateKey(days[days.length - 1])

      const [{ data: turniData }, { data: punchData }] = await Promise.all([
        supabase.from('turni').select('employee_id, date, shift_data')
          .in('employee_id', employees.map(e => e.id))
          .gte('date', firstDay).lte('date', lastDay),
        supabase.from('punches').select('employee_id, action, punched_at')
          .in('employee_id', employees.map(e => e.id))
          .gte('punched_at', `${firstDay}T00:00:00`)
          .lte('punched_at', `${lastDay}T23:59:59`)
          .order('punched_at'),
      ])

      // Indicizza turni per employee+date
      const turniMap = {}
      turniData?.forEach(r => {
        if (!turniMap[r.employee_id]) turniMap[r.employee_id] = {}
        turniMap[r.employee_id][r.date] = r.shift_data
      })

      // Indicizza timbrature per employee+date
      const punchMap = {}
      punchData?.forEach(p => {
        const dk = new Date(p.punched_at).toLocaleDateString('sv')
        const k  = `${p.employee_id}|${dk}`
        if (!punchMap[k]) punchMap[k] = []
        punchMap[k].push(p)
      })

      const monthName = MONTHS_IT[month].toUpperCase()

      // Riga 1: mese + giorni della settimana
      const row1 = ['', '', '', `MESE DI ${monthName} ${year}`,
        ...days.map(d => DAYS_IT[d.getDay()]), 'TOT', '']

      // Riga 2: intestazioni colonne
      const row2 = ['Ragione sociale', 'Sede lavoro', 'Matricola', 'Cognome e Nome',
        ...days.map((_, i) => i + 1), '', 'Note']

      const rows = [csvRow(row1), csvRow(row2)]

      for (const emp of employees) {
        let totalHours = 0

        const dayCells = days.map(d => {
          const dk      = toDateKey(d)
          const shift   = turniMap[emp.id]?.[dk] ?? null
          const punches = punchMap[`${emp.id}|${dk}`] || []
          const val     = calcDayValue(shift, punches)

          if (val && !isNaN(parseFloat(val.replace(',', '.')))) {
            totalHours += parseFloat(val.replace(',', '.'))
          }
          return val
        })

        const totWhole = Math.floor(totalHours)
        const totFrac  = Math.round((totalHours - totWhole) * 10)
        const totStr   = totalHours > 0 ? `${totWhole},${totFrac === 0 ? '0' : totFrac}` : '0,0'

        rows.push(csvRow(['HEY', emp.department, '', emp.name, ...dayCells, totStr, '']))
      }

      // BOM UTF-8 per apertura corretta in Excel italiano
      const csv  = '﻿' + rows.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `Presenze_${MONTHS_IT[month]}_${year}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">Riepilogo</h1>
      <p className="text-petrol-400 text-sm">Caricamento…</p>
    </>
  )

  return (
    <>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Riepilogo</h1>
          <p className="text-petrol-300 mt-1 text-sm">Seleziona un dipendente per il dettaglio mensile</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={prevMonth}
            className="border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
          <span className="font-semibold text-white min-w-[150px] text-center capitalize">
            {MONTHS_IT[month]} {year}
          </span>
          <button onClick={nextMonth}
            className="border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>

          <button onClick={handleExportCSV} disabled={exporting || employees.length === 0}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40">
            {exporting
              ? <><span className="animate-spin inline-block">⟳</span>Esporto…</>
              : <><span>↓</span>Scarica CSV</>}
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <p className="text-petrol-400 text-sm">Nessun dipendente in directory.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => navigate(`/admin/riepilogo/${emp.id}`)}
              className="bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 rounded-2xl p-6 text-left transition group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_STYLE[emp.department] || 'bg-gray-100 text-gray-600'}`}>
                  {emp.department}
                </span>
                <span className="text-petrol-500 group-hover:text-white text-lg transition">→</span>
              </div>
              <p className="font-bold text-white text-lg leading-tight">
                {emp.nickname || emp.name}
              </p>
              {emp.nickname && (
                <p className="text-petrol-400 text-xs mt-0.5">{emp.name}</p>
              )}
              <p className="text-petrol-400 text-xs mt-3">{emp.weekly_hours}h / settimana</p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
