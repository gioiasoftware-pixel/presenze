import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { getMonday, addDays, toKey, formatWeekRange } from './turni/turniData'

const DEPTS      = ['SALA', 'CUCINA']
const MONTHS_IT  = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

const DEFAULT_FASCE = [
  { id:'1', name:'Colazione', start:'07:00', end:'11:00', color:'#60a5fa' },
  { id:'2', name:'Pranzo',    start:'11:00', end:'15:30', color:'#fb923c' },
  { id:'3', name:'Pomeriggio',start:'15:30', end:'19:00', color:'#fbbf24' },
  { id:'4', name:'Cena',      start:'19:00', end:'01:00', color:'#a78bfa' },
]

// ── Utility presenze ──────────────────────────────────────────────────────────

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
  if (!h) return '0h'
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function getDaysInMonth(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

// ── Utility servizi ───────────────────────────────────────────────────────────

function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

function punchTime(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// Ritorna le ore di sovrapposizione tra la coppia [entryTime, exitTime] e la fascia [fS, fE]
function calcOverlapHours(entryTime, exitTime, fS, fE) {
  let sIn = toMin(entryTime), sOut = toMin(exitTime)
  if (sOut <= sIn) sOut += 1440
  let fIn = toMin(fS), fOut = toMin(fE)
  if (fOut <= fIn) fOut += 1440
  let tot = 0
  for (const off of [-1440, 0, 1440])
    tot += Math.max(0, Math.min(sOut, fOut + off) - Math.max(sIn, fIn + off))
  return tot / 60
}

function loadFasce() {
  try { const s = localStorage.getItem('presenze_fasce'); return s ? JSON.parse(s) : DEFAULT_FASCE }
  catch { return DEFAULT_FASCE }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

// ── Componente ────────────────────────────────────────────────────────────────

export default function StatistichePage() {
  const today = new Date()

  // — tab —
  const [activeTab, setActiveTab] = useState('presenze')

  // — presenze —
  const [dept, setDept]           = useState('SALA')
  const [view, setView]           = useState('settimana')
  const [weekStart, setWeekStart] = useState(() => getMonday(today))
  const [month, setMonth]         = useState(today.getMonth())
  const [year, setYear]           = useState(today.getFullYear())
  const [stats, setStats]         = useState([])
  const [loading, setLoading]     = useState(true)

  // — servizi —
  const [fasce, setFasce]               = useState(loadFasce)
  const [fascePanelOpen, setFascePanelOpen] = useState(false)
  const [servDept, setServDept]         = useState('TUTTI')
  const [servYear, setServYear]         = useState(today.getFullYear())
  const [servEmps, setServEmps]         = useState([])
  const [servData, setServData]         = useState({})
  const [servLoading, setServLoading]   = useState(false)

  function saveFasce(next) { setFasce(next); localStorage.setItem('presenze_fasce', JSON.stringify(next)) }
  function updateFascia(id, field, val) { saveFasce(fasce.map(f => f.id === id ? { ...f, [field]: val } : f)) }
  function deleteFascia(id) { saveFasce(fasce.filter(f => f.id !== id)) }
  function addFascia() { saveFasce([...fasce, { id: genId(), name: 'Nuovo', start: '09:00', end: '13:00', color: '#94a3b8' }]) }
  function resetFasce() { saveFasce(DEFAULT_FASCE) }

  // ── Presenze: giorni periodo ───────────────────────────────────────────────

  const days = useMemo(() => {
    if (view === 'settimana') {
      return Array.from({ length: 7 }, (_, i) => { const d = addDays(weekStart, i); return { date: d, dateKey: toKey(d) } })
    }
    return getDaysInMonth(year, month).map(d => ({ date: d, dateKey: toKey(d) }))
  }, [view, weekStart, year, month])

  // ── Presenze: caricamento ─────────────────────────────────────────────────

  const loadPresenze = useCallback(async () => {
    setLoading(true)
    const { data: emps } = await supabase.from('employees').select('id, name, nickname').eq('department', dept).order('name')
    const list = emps || []
    if (!list.length) { setStats([]); setLoading(false); return }

    const firstDay = days[0].dateKey, lastDay = days[days.length - 1].dateKey
    const nextDay  = toKey(addDays(days[days.length - 1].date, 1))
    const empIds   = list.map(e => e.id)

    const [{ data: turniData }, { data: punchData }] = await Promise.all([
      supabase.from('turni').select('employee_id, date, shift_data').in('employee_id', empIds).in('date', days.map(d => d.dateKey)),
      supabase.from('punches').select('employee_id, action, punched_at').in('employee_id', empIds)
        .gte('punched_at', `${firstDay}T00:00:00`).lte('punched_at', `${nextDay}T05:59:59`).order('punched_at'),
    ])

    const turniByEmp = {}
    turniData?.forEach(r => { if (!turniByEmp[r.employee_id]) turniByEmp[r.employee_id] = {}; turniByEmp[r.employee_id][r.date] = r.shift_data })
    const punchesByEmp = {}
    punchData?.forEach(p => { if (!punchesByEmp[p.employee_id]) punchesByEmp[p.employee_id] = []; punchesByEmp[p.employee_id].push(p) })

    const computed = list.map(emp => {
      let planned = 0, giorniTurno = 0
      for (const { dateKey } of days) {
        const shift = turniByEmp[emp.id]?.[dateKey] ?? null
        if (shift && typeof shift !== 'string') { const h = calcPlanned(shift); planned += h; if (h > 0) giorniTurno++ }
      }
      const empPunches = punchesByEmp[emp.id] || []
      const actual = calcActual(empPunches)
      const giorniLavorati = (() => {
        if (!empPunches.length) return null
        const sorted = [...empPunches].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at))
        const daySet = new Set()
        for (const { entry, exit } of buildPairs(sorted)) {
          const ref = entry || exit
          if (ref) daySet.add(new Date(ref.punched_at).toLocaleDateString('sv'))
        }
        return daySet.size
      })()
      return { emp, planned, actual, giorniTurno, giorniLavorati, delta: actual !== null && planned > 0 ? actual - planned : null }
    })

    setStats(computed)
    setLoading(false)
  }, [dept, days])

  useEffect(() => { if (activeTab === 'presenze') loadPresenze() }, [loadPresenze, activeTab])

  // ── Servizi: caricamento ──────────────────────────────────────────────────

  const loadServizi = useCallback(async () => {
    setServLoading(true)

    const deptFilter = servDept === 'TUTTI'
      ? supabase.from('employees').select('id, name, nickname, department').order('department').order('name')
      : supabase.from('employees').select('id, name, nickname, department').eq('department', servDept).order('name')

    const { data: emps } = await deptFilter
    const list = emps || []
    setServEmps(list)

    if (!list.length) { setServData({}); setServLoading(false); return }

    const firstDay = `${servYear}-01-01`
    const lastDay  = `${servYear}-12-31`
    const nextYear = `${servYear + 1}-01-01`
    const empIds   = list.map(e => e.id)

    const [{ data: punchData }, { data: turniData }] = await Promise.all([
      supabase.from('punches').select('employee_id, action, punched_at')
        .in('employee_id', empIds)
        .gte('punched_at', `${firstDay}T00:00:00`)
        .lte('punched_at', `${nextYear}T05:59:59`)
        .order('punched_at'),
      supabase.from('turni').select('employee_id, date, shift_data')
        .in('employee_id', empIds)
        .gte('date', firstDay).lte('date', lastDay),
    ])

    // Turni per employee+date
    const turniMap = {}
    turniData?.forEach(r => {
      if (!turniMap[r.employee_id]) turniMap[r.employee_id] = {}
      turniMap[r.employee_id][r.date] = r.shift_data
    })

    const result = {}
    for (const emp of list) {
      result[emp.id] = {}
      for (let m = 0; m < 12; m++) result[emp.id][m] = {}

      const empPunches = (punchData || []).filter(p => p.employee_id === emp.id)
      const actualPairs = buildPairs(empPunches)

      // Raggruppa coppie effettive per data entrata
      const pairsByDate = {}
      for (const pair of actualPairs) {
        const ref = pair.entry || pair.exit
        if (!ref) continue
        const dk = new Date(ref.punched_at).toLocaleDateString('sv')
        if (!pairsByDate[dk]) pairsByDate[dk] = []
        pairsByDate[dk].push(pair)
      }

      // Registra ore effettive per fascia
      for (const [dk, pairs] of Object.entries(pairsByDate)) {
        const m = new Date(dk).getMonth()
        for (const { entry, exit } of pairs) {
          if (!entry || !exit) continue
          const eT = punchTime(entry.punched_at), xT = punchTime(exit.punched_at)
          for (const f of fasce) {
            const h = calcOverlapHours(eT, xT, f.start, f.end)
            if (h > 0.01) result[emp.id][m][f.id] = (result[emp.id][m][f.id] || 0) + h
          }
        }
      }

      // Fallback ai turni pianificati per i giorni senza timbrature (stessa logica riepilogo)
      const empTurni = turniMap[emp.id] || {}
      for (const [dk, shift] of Object.entries(empTurni)) {
        if (pairsByDate[dk]) continue                            // già coperto da timbrature
        if (!shift || typeof shift === 'string') continue        // OFF/FERIE/ecc.
        const planned = shift.pairs || []
        const m = new Date(dk).getMonth()
        for (const plan of planned) {
          if (!plan.in || !plan.out) continue
          for (const f of fasce) {
            const h = calcOverlapHours(plan.in, plan.out, f.start, f.end)
            if (h > 0.01) result[emp.id][m][f.id] = (result[emp.id][m][f.id] || 0) + h
          }
        }
      }
    }

    setServData(result)
    setServLoading(false)
  }, [servDept, servYear, fasce])

  useEffect(() => { if (activeTab === 'servizi') loadServizi() }, [loadServizi, activeTab])

  // ── Presenze: navigazione ─────────────────────────────────────────────────

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

  // ── Presenze: dati derivati ───────────────────────────────────────────────

  const sortedStats = [...stats].sort((a, b) => (b.actual ?? b.planned) - (a.actual ?? a.planned))
  const maxH       = Math.max(...stats.map(s => Math.max(s.planned || 0, s.actual || 0, 1)), 1)
  const totPlanned = stats.reduce((s, r) => s + r.planned, 0)
  const totActual  = stats.some(r => r.actual !== null) ? stats.reduce((s, r) => s + (r.actual || 0), 0) : null

  // — vista tabella servizi —
  const [tableView, setTableView] = useState('fascia') // 'fascia' | 'mese'

  // ── Servizi: dati derivati ────────────────────────────────────────────────

  // maxH per mese (per scala grafico)
  const maxMonthH = useMemo(() => {
    let max = 1
    for (const emp of servEmps) {
      for (let m = 0; m < 12; m++) {
        const tot = fasce.reduce((s, f) => s + (servData[emp.id]?.[m]?.[f.id] || 0), 0)
        if (tot > max) max = tot
      }
    }
    return max
  }, [servEmps, servData, fasce])

  // totali annuali per dipendente×fascia
  const annualByEmpFascia = useMemo(() => {
    const out = {}
    for (const emp of servEmps) {
      out[emp.id] = {}
      for (const f of fasce) {
        out[emp.id][f.id] = 0
        for (let m = 0; m < 12; m++) out[emp.id][f.id] += servData[emp.id]?.[m]?.[f.id] || 0
      }
    }
    return out
  }, [servEmps, servData, fasce])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header + tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Statistiche</h1>
          <p className="text-petrol-300 mt-1 text-sm">Analisi ore e distribuzione servizi</p>
        </div>
        <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10">
          {[['presenze','Presenze'],['servizi','Distribuzione Servizi']].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === id ? 'bg-petrol-600 text-white shadow' : 'text-petrol-300 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════ TAB PRESENZE ═══════════════════ */}
      {activeTab === 'presenze' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10">
              {DEPTS.map(d => (
                <button key={d} onClick={() => setDept(d)}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                    dept === d ? 'bg-petrol-600 text-white shadow' : 'text-petrol-300 hover:text-white'
                  }`}>{d}</button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-white/8 rounded-xl p-1 gap-1 border border-white/10">
                {['settimana','mese'].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      view === v ? 'bg-white/20 text-white' : 'text-petrol-400 hover:text-white'
                    }`}>{v}</button>
                ))}
              </div>
              <button onClick={prevPeriod} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
              <span className="font-semibold text-white min-w-[220px] text-center text-sm">{periodLabel}</span>
              <button onClick={nextPeriod} className="border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
              <button onClick={goToday} className="text-xs text-petrol-400 hover:text-white transition font-medium">Oggi</button>
            </div>
          </div>

          {loading ? (
            <div className="text-petrol-400 text-sm py-12 text-center">Caricamento…</div>
          ) : stats.length === 0 ? (
            <div className="text-petrol-500 text-sm py-12 text-center">Nessun dipendente nel reparto</div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-petrol-800 font-bold text-base">Ore {view} — {dept}</h2>
                  <div className="flex items-center gap-3 text-xs text-petrol-500 flex-wrap justify-end">
                    {[['bg-petrol-200','Pianificate'],['bg-petrol-600','Effettive (nella norma)'],['bg-amber-400','Effettive (ore mancanti)'],['bg-emerald-500','Effettive (straordinario)']].map(([cls,lbl]) => (
                      <span key={lbl} className="flex items-center gap-1.5">
                        <span className={`w-3 h-2.5 rounded-sm ${cls} inline-block`}></span>{lbl}
                      </span>
                    ))}
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
                          <span className="text-sm font-semibold text-petrol-700 block truncate">{emp.nickname || emp.name}</span>
                        </div>
                        <div className="flex-1 relative h-7 bg-petrol-50 rounded-lg overflow-hidden">
                          {planPct > 0 && <div className="absolute inset-y-0 left-0 bg-petrol-200 rounded-lg" style={{ width: `${planPct}%` }} />}
                          {actPct !== null && actPct > 0 && (
                            <div className={`absolute inset-y-0 left-0 rounded-lg ${isShort ? 'bg-amber-400' : isOver ? 'bg-emerald-500' : 'bg-petrol-600'}`}
                              style={{ width: `${actPct}%` }} />
                          )}
                        </div>
                        <div className="w-36 shrink-0 flex items-center gap-1.5 flex-wrap">
                          {actual !== null ? (
                            <>
                              <span className="text-sm font-black text-petrol-900 tabular-nums">{fmtH(actual)}</span>
                              {planned > 0 && <span className="text-xs text-petrol-400 tabular-nums">/ {fmtH(planned)}</span>}
                            </>
                          ) : <span className="text-sm text-petrol-400 tabular-nums">{fmtH(planned)}</span>}
                          {delta !== null && Math.abs(delta) >= 0.25 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOver ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isOver ? '+' : ''}{fmtH(delta)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-5 flex ml-[calc(6rem+0.75rem)] mr-[calc(9rem+0.75rem)]">
                  {[0,0.25,0.5,0.75,1].map(v => (
                    <div key={v} className="flex-1 text-[9px] text-petrol-300 tabular-nums">{v > 0 ? `${Math.round(maxH * v)}h` : ''}</div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-petrol-100 bg-petrol-50">
                        {['Dipendente','Giorni turno','Pianificate','Effettive','Delta','Giorni lavorati'].map(h => (
                          <th key={h} className={`${h === 'Dipendente' ? 'text-left px-5' : 'text-center px-4'} py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(({ emp, planned, actual, delta, giorniTurno, giorniLavorati }) => (
                        <tr key={emp.id} className="border-t border-petrol-100 hover:bg-petrol-50/40 transition">
                          <td className="px-5 py-3 font-semibold text-petrol-800">{emp.nickname || emp.name}</td>
                          <td className="px-4 py-3 text-center text-petrol-600 tabular-nums">{giorniTurno}</td>
                          <td className="px-4 py-3 text-center font-mono text-petrol-600 tabular-nums">{fmtH(planned)}</td>
                          <td className="px-4 py-3 text-center font-mono tabular-nums">
                            {actual !== null ? <span className="font-bold text-petrol-900">{fmtH(actual)}</span> : <span className="text-petrol-300 text-xs italic">nessuna timbratura</span>}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums">
                            {delta !== null ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Math.abs(delta) < 0.25 ? 'text-petrol-400' : delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {Math.abs(delta) < 0.25 ? '=' : delta > 0 ? '+' : ''}{fmtH(delta)}
                              </span>
                            ) : <span className="text-petrol-200">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-petrol-600 tabular-nums">{giorniLavorati ?? <span className="text-petrol-200">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-petrol-200 bg-petrol-50">
                        <td className="px-5 py-4 font-bold text-petrol-700 text-sm">Totale {dept}</td>
                        <td className="px-4 py-4 text-center font-bold text-petrol-700 tabular-nums">{stats.reduce((s,r)=>s+r.giorniTurno,0)}</td>
                        <td className="px-4 py-4 text-center font-bold text-petrol-700 tabular-nums">{fmtH(totPlanned)}</td>
                        <td className="px-4 py-4 text-center font-black text-petrol-900 tabular-nums">
                          {totActual !== null ? fmtH(totActual) : <span className="text-petrol-300 text-xs font-normal italic">nessuna timbratura</span>}
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
      )}

      {/* ═══════════════════ TAB SERVIZI ═══════════════════ */}
      {activeTab === 'servizi' && (
        <>
          {/* Controlli */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10">
              {['TUTTI','SALA','CUCINA'].map(d => (
                <button key={d} onClick={() => setServDept(d)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                    servDept === d ? 'bg-petrol-600 text-white shadow' : 'text-petrol-300 hover:text-white'
                  }`}>{d}</button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setServYear(y => y - 1)} className="border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
              <span className="font-bold text-white text-sm w-14 text-center">{servYear}</span>
              <button onClick={() => setServYear(y => y + 1)} className="border border-white/20 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
            </div>

            <button onClick={() => setFascePanelOpen(o => !o)}
              className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-sm font-semibold transition ${
                fascePanelOpen ? 'bg-white/15 border-white/40 text-white' : 'border-white/20 text-petrol-300 hover:text-white hover:bg-white/10'
              }`}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
              </svg>
              Configura fasce
            </button>
          </div>

          {/* Pannello fasce */}
          {fascePanelOpen && (
            <div className="bg-white rounded-2xl shadow-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-petrol-800">Fasce orarie di servizio</h3>
                <button onClick={resetFasce} className="text-xs text-petrol-400 hover:text-petrol-700 transition">Reset predefinite</button>
              </div>
              <div className="flex flex-col gap-3">
                {fasce.map(f => (
                  <div key={f.id} className="flex items-center gap-3 flex-wrap">
                    <input type="color" value={f.color} onChange={e => updateFascia(f.id,'color',e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0.5" />
                    <input type="text" value={f.name} onChange={e => updateFascia(f.id,'name',e.target.value)}
                      className="border border-petrol-200 rounded-lg px-3 py-1.5 text-sm text-petrol-800 w-32 focus:outline-none focus:border-petrol-500" />
                    <span className="text-petrol-400 text-sm font-medium">dalle</span>
                    <input type="time" value={f.start} onChange={e => updateFascia(f.id,'start',e.target.value)}
                      className="border border-petrol-200 rounded-lg px-3 py-1.5 text-sm text-petrol-800 focus:outline-none focus:border-petrol-500" />
                    <span className="text-petrol-400 text-sm font-medium">alle</span>
                    <input type="time" value={f.end} onChange={e => updateFascia(f.id,'end',e.target.value)}
                      className="border border-petrol-200 rounded-lg px-3 py-1.5 text-sm text-petrol-800 focus:outline-none focus:border-petrol-500" />
                    <button onClick={() => deleteFascia(f.id)} className="text-petrol-300 hover:text-red-500 transition text-lg leading-none ml-auto">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addFascia}
                className="mt-4 flex items-center gap-2 text-petrol-500 hover:text-petrol-800 text-sm font-semibold transition border border-dashed border-petrol-200 hover:border-petrol-400 rounded-xl px-4 py-2">
                + Aggiungi fascia
              </button>
            </div>
          )}

          {servLoading ? (
            <div className="text-petrol-400 text-sm py-12 text-center">Caricamento…</div>
          ) : servEmps.length === 0 ? (
            <div className="text-petrol-500 text-sm py-12 text-center">Nessun dipendente</div>
          ) : (
            <div className="flex flex-col gap-6">

              {/* ── Grafico mese×dipendente ── */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <h2 className="text-petrol-800 font-bold text-base">Distribuzione mensile per servizio — {servYear}</h2>
                  <div className="flex flex-wrap gap-3">
                    {fasce.map(f => (
                      <span key={f.id} className="flex items-center gap-1.5 text-xs text-petrol-600">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: f.color }}></span>
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div style={{ minWidth: '700px' }}>
                    {/* Header mesi */}
                    <div className="flex mb-2 pl-28">
                      {MONTHS_IT.map(m => (
                        <div key={m} className="flex-1 text-center text-[10px] font-semibold text-petrol-400 uppercase">{m}</div>
                      ))}
                    </div>

                    {/* Righe dipendenti */}
                    <div className="flex flex-col gap-3">
                      {servEmps.map(emp => (
                        <div key={emp.id} className="flex items-end gap-1">
                          <div className="w-28 shrink-0 text-right pr-3 pb-1">
                            <span className="text-xs font-semibold text-petrol-700 block truncate">{emp.nickname || emp.name}</span>
                            {servDept === 'TUTTI' && (
                              <span className="text-[9px] text-petrol-400 font-medium">{emp.department}</span>
                            )}
                          </div>
                          {Array.from({ length: 12 }, (_, m) => {
                            const monthTot = fasce.reduce((s, f) => s + (servData[emp.id]?.[m]?.[f.id] || 0), 0)
                            const barH = monthTot > 0 ? Math.max(4, Math.round((monthTot / maxMonthH) * 64)) : 0
                            return (
                              <div key={m} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: '64px' }}>
                                  {monthTot === 0 ? (
                                    <div className="w-full bg-petrol-50 rounded-sm" style={{ height: '64px' }} />
                                  ) : (
                                    <>
                                      <div className="w-full bg-petrol-50 flex-1" />
                                      <div className="w-full flex flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${barH}px` }}>
                                        {fasce.map(f => {
                                          const h = servData[emp.id]?.[m]?.[f.id] || 0
                                          if (!h) return null
                                          const pct = (h / monthTot) * 100
                                          return <div key={f.id} style={{ height: `${pct}%`, background: f.color }} />
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>
                                {/* Tooltip */}
                                {monthTot > 0 && (
                                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-petrol-900 text-white text-[10px] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap shadow-xl">
                                    <div className="font-bold mb-0.5">{MONTHS_IT[m]} — {fmtH(monthTot)}</div>
                                    {fasce.map(f => {
                                      const h = servData[emp.id]?.[m]?.[f.id] || 0
                                      if (!h) return null
                                      return <div key={f.id} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: f.color }}/>{f.name}: {fmtH(h)}</div>
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tabella ── */}
              {(() => {
                const monthsElapsed = servYear < today.getFullYear() ? 12 : today.getMonth() + 1
                const deptCols = servDept === 'TUTTI' ? 1 : 0

                return (
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* toggle vista */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-petrol-100">
                      <h3 className="font-bold text-petrol-700 text-sm">Dettaglio</h3>
                      <div className="flex bg-petrol-50 rounded-xl p-1 gap-1 border border-petrol-100">
                        {[['fascia','Per fascia'],['mese','Per mese']].map(([id,lbl]) => (
                          <button key={id} onClick={() => setTableView(id)}
                            className={`px-4 py-1 rounded-lg text-xs font-semibold transition ${
                              tableView === id ? 'bg-petrol-600 text-white shadow' : 'text-petrol-400 hover:text-petrol-700'
                            }`}>{lbl}</button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      {tableView === 'fascia' ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-petrol-100 bg-petrol-50">
                              <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Dipendente</th>
                              {servDept === 'TUTTI' && <th className="text-center px-3 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Reparto</th>}
                              {fasce.map(f => (
                                <th key={f.id} className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: f.color }}>{f.name}</th>
                              ))}
                              <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Totale reale</th>
                              <th className="text-center px-4 py-3 text-xs font-bold text-petrol-400 uppercase tracking-wider">Stima anno</th>
                            </tr>
                          </thead>
                          <tbody>
                            {servEmps.map(emp => {
                              const yearTot = fasce.reduce((s, f) => s + (annualByEmpFascia[emp.id]?.[f.id] || 0), 0)
                              const stima   = monthsElapsed < 12 && yearTot > 0 ? (yearTot / monthsElapsed) * 12 : null
                              return (
                                <tr key={emp.id} className="border-t border-petrol-100 hover:bg-petrol-50/40 transition">
                                  <td className="px-5 py-3 font-semibold text-petrol-800">{emp.nickname || emp.name}</td>
                                  {servDept === 'TUTTI' && (
                                    <td className="px-3 py-3 text-center">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${emp.department === 'SALA' ? 'bg-petrol-100 text-petrol-700' : 'bg-amber-100 text-amber-700'}`}>{emp.department}</span>
                                    </td>
                                  )}
                                  {fasce.map(f => {
                                    const h = annualByEmpFascia[emp.id]?.[f.id] || 0
                                    const pct = yearTot > 0 ? Math.round((h / yearTot) * 100) : 0
                                    return (
                                      <td key={f.id} className="px-4 py-3 text-center tabular-nums">
                                        {h > 0.1 ? <div><span className="font-bold text-petrol-900 block">{fmtH(h)}</span><span className="text-[10px] text-petrol-400">{pct}%</span></div> : <span className="text-petrol-200 text-xs">—</span>}
                                      </td>
                                    )
                                  })}
                                  <td className="px-4 py-3 text-center font-black text-petrol-900 tabular-nums">{fmtH(yearTot)}</td>
                                  <td className="px-4 py-3 text-center tabular-nums">
                                    {stima ? <span className="text-petrol-400 font-semibold">~{fmtH(stima)}</span> : <span className="text-petrol-200 text-xs">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-petrol-200 bg-petrol-50">
                              <td className="px-5 py-4 font-bold text-petrol-700 text-sm" colSpan={1 + deptCols}>Totale</td>
                              {fasce.map(f => {
                                const tot = servEmps.reduce((s, emp) => s + (annualByEmpFascia[emp.id]?.[f.id] || 0), 0)
                                return <td key={f.id} className="px-4 py-4 text-center font-bold text-petrol-700 tabular-nums">{fmtH(tot)}</td>
                              })}
                              <td className="px-4 py-4 text-center font-black text-petrol-900 tabular-nums">
                                {fmtH(servEmps.reduce((s, emp) => s + fasce.reduce((ss, f) => ss + (annualByEmpFascia[emp.id]?.[f.id] || 0), 0), 0))}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        /* ── Vista per mese ── */
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-petrol-100 bg-petrol-50">
                              <th className="text-left px-5 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider sticky left-0 bg-petrol-50 z-10">Dipendente</th>
                              {servDept === 'TUTTI' && <th className="text-center px-3 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Rep.</th>}
                              {MONTHS_IT.map((m, i) => (
                                <th key={m} className={`text-center px-2 py-3 text-xs font-bold uppercase tracking-wider ${i === today.getMonth() && servYear === today.getFullYear() ? 'text-petrol-800 bg-petrol-100' : 'text-petrol-500'}`}>{m}</th>
                              ))}
                              <th className="text-center px-4 py-3 text-xs font-bold text-petrol-600 uppercase tracking-wider">Totale reale</th>
                              <th className="text-center px-4 py-3 text-xs font-bold text-petrol-400 uppercase tracking-wider">Stima anno</th>
                            </tr>
                          </thead>
                          <tbody>
                            {servEmps.map(emp => {
                              const yearTot = Array.from({length:12}, (_,m) => fasce.reduce((s,f) => s + (servData[emp.id]?.[m]?.[f.id]||0), 0)).reduce((a,b)=>a+b,0)
                              const stima   = monthsElapsed < 12 && yearTot > 0 ? (yearTot / monthsElapsed) * 12 : null
                              return (
                                <tr key={emp.id} className="border-t border-petrol-100 hover:bg-petrol-50/40 transition">
                                  <td className="px-5 py-3 font-semibold text-petrol-800 sticky left-0 bg-white z-10">{emp.nickname || emp.name}</td>
                                  {servDept === 'TUTTI' && (
                                    <td className="px-3 py-3 text-center">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${emp.department === 'SALA' ? 'bg-petrol-100 text-petrol-700' : 'bg-amber-100 text-amber-700'}`}>{emp.department}</span>
                                    </td>
                                  )}
                                  {Array.from({length:12}, (_, m) => {
                                    const tot = fasce.reduce((s,f) => s + (servData[emp.id]?.[m]?.[f.id]||0), 0)
                                    const isCurrent = m === today.getMonth() && servYear === today.getFullYear()
                                    // mini barra fasce
                                    return (
                                      <td key={m} className={`px-2 py-2 text-center tabular-nums ${isCurrent ? 'bg-petrol-50' : ''}`}>
                                        {tot > 0.1 ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="font-semibold text-petrol-900 text-xs">{fmtH(tot)}</span>
                                            {/* mini stacked bar */}
                                            <div className="flex w-10 h-1.5 rounded-full overflow-hidden">
                                              {fasce.map(f => {
                                                const h = servData[emp.id]?.[m]?.[f.id] || 0
                                                if (!h) return null
                                                return <div key={f.id} style={{ width: `${(h/tot)*100}%`, background: f.color }} />
                                              })}
                                            </div>
                                          </div>
                                        ) : <span className="text-petrol-200 text-xs">—</span>}
                                      </td>
                                    )
                                  })}
                                  <td className="px-4 py-3 text-center font-black text-petrol-900 tabular-nums">{fmtH(yearTot)}</td>
                                  <td className="px-4 py-3 text-center tabular-nums">
                                    {stima ? <span className="text-petrol-400 font-semibold">~{fmtH(stima)}</span> : <span className="text-petrol-200 text-xs">—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-petrol-200 bg-petrol-50">
                              <td className="px-5 py-4 font-bold text-petrol-700 text-sm sticky left-0 bg-petrol-50 z-10" colSpan={1 + deptCols}>Totale</td>
                              {Array.from({length:12}, (_, m) => {
                                const tot = servEmps.reduce((s, emp) => s + fasce.reduce((ss,f) => ss+(servData[emp.id]?.[m]?.[f.id]||0), 0), 0)
                                return <td key={m} className="px-2 py-4 text-center font-bold text-petrol-700 tabular-nums text-xs">{tot > 0.1 ? fmtH(tot) : <span className="text-petrol-200">—</span>}</td>
                              })}
                              <td className="px-4 py-4 text-center font-black text-petrol-900 tabular-nums text-xs">
                                {fmtH(servEmps.reduce((s, emp) => s + fasce.reduce((ss,f) => ss+(annualByEmpFascia[emp.id]?.[f.id]||0), 0), 0))}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                )
              })()}

            </div>
          )}
        </>
      )}
    </>
  )
}
