import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAYS_IT   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function getDaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function punchToTime(isoStr) {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function calcHours(entrata, uscita) {
  if (!entrata || !uscita) return null
  const [h1, m1] = entrata.split(':').map(Number)
  const [h2, m2] = uscita.split(':').map(Number)
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (diff <= 0) return null
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const SPECIAL_LABEL = { OFF: 'Riposo', FERIE: 'Ferie', MALATTIA: 'Malattia', PERMESSO: 'Permesso' }
const SPECIAL_STYLE = {
  OFF:      'bg-gray-100 text-gray-500',
  FERIE:    'bg-green-100 text-green-700',
  MALATTIA: 'bg-red-100 text-red-700',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}

const REQ_STATUS_STYLE = {
  IN_ATTESA: 'bg-petrol-100 text-petrol-700',
  APPROVATA: 'bg-green-100 text-green-700',
  RIFIUTATA: 'bg-red-100 text-red-700',
}
const REQ_STATUS_LABEL = {
  IN_ATTESA: 'In attesa',
  APPROVATA: 'Approvata',
  RIFIUTATA: 'Rifiutata',
}

function formatDateLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// ── Componente tab Presenze ───────────────────────────────────────────────────

function TabPresenze({ id, employee }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [turni, setTurni]   = useState({})
  const [punches, setPunches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days     = getDaysInMonth(year, month)
      const firstDay = toDateKey(days[0])
      const lastDay  = toDateKey(days[days.length - 1])
      const [{ data: turniData }, { data: punchData }] = await Promise.all([
        supabase.from('turni').select('date, shift_data')
          .eq('employee_id', id).gte('date', firstDay).lte('date', lastDay),
        supabase.from('punches').select('action, punched_at, note')
          .eq('employee_id', id)
          .gte('punched_at', `${firstDay}T00:00:00`)
          .lte('punched_at', `${lastDay}T23:59:59`)
          .order('punched_at'),
      ])
      const tm = {}
      turniData?.forEach(r => { tm[r.date] = r.shift_data })
      setTurni(tm)
      setPunches(punchData || [])
      setLoading(false)
    }
    load()
  }, [id, year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const totalMinutes = (() => {
    let tot = 0
    punches.forEach((p, i) => {
      if (p.action === 'ENTRATA') {
        const next = punches[i + 1]
        if (next?.action === 'USCITA') {
          const [h1, m1] = punchToTime(p.punched_at).split(':').map(Number)
          const [h2, m2] = punchToTime(next.punched_at).split(':').map(Number)
          const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
          if (diff > 0) tot += diff
        }
      }
    })
    return tot
  })()

  const totH = Math.floor(totalMinutes / 60)
  const totM = totalMinutes % 60
  const days = getDaysInMonth(year, month)

  const punchByDay = {}
  punches.forEach(p => {
    const dk = new Date(p.punched_at).toLocaleDateString('sv')
    if (!punchByDay[dk]) punchByDay[dk] = []
    punchByDay[dk].push(p)
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Nav mese */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth}
          className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
        <span className="text-white font-bold capitalize">{MONTHS_IT[month]} {year}</span>
        <button onClick={nextMonth}
          className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
      </div>

      {/* Totale ore */}
      <div className="bg-white/10 border border-white/15 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-petrol-400 text-xs font-bold uppercase tracking-widest">Ore lavorate</p>
          <p className="text-white text-4xl font-black mt-1 tabular-nums">
            {totH}<span className="text-xl font-bold text-petrol-400">h</span>
            {totM > 0 && <> {totM}<span className="text-xl font-bold text-petrol-400">m</span></>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-petrol-400 text-xs font-bold uppercase tracking-widest">Contratto</p>
          <p className="text-petrol-300 text-2xl font-bold mt-1">{employee.weekly_hours * 4}h</p>
          <p className="text-petrol-500 text-xs">stima mensile</p>
        </div>
      </div>

      {/* Lista giorni */}
      {loading ? (
        <p className="text-petrol-400 text-sm text-center">Caricamento…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map(d => {
            const dk     = toDateKey(d)
            const shift  = turni[dk] ?? null
            const dayPunches = punchByDay[dk] || []
            const isToday  = toDateKey(today) === dk
            const isPast   = d < today && !isToday
            const isFuture = d > today
            if (!shift && dayPunches.length === 0 && isFuture) return null

            const entrata = dayPunches.find(p => p.action === 'ENTRATA')
            const uscita  = dayPunches.find(p => p.action === 'USCITA')
            const ore     = calcHours(
              entrata ? punchToTime(entrata.punched_at) : null,
              uscita  ? punchToTime(uscita.punched_at)  : null,
            )
            const anomalia = isPast && dayPunches.length > 0 && !uscita

            return (
              <div key={dk}
                className={`bg-white/8 border rounded-2xl px-4 py-3 flex items-center gap-3
                  ${isToday ? 'border-petrol-400 bg-petrol-800/40' : 'border-white/10'}
                  ${anomalia ? 'border-red-400/40 bg-red-900/10' : ''}`}
              >
                <div className="w-10 text-center shrink-0">
                  <p className="text-petrol-400 text-xs font-bold">{DAYS_IT[d.getDay()]}</p>
                  <p className={`font-black text-xl tabular-nums leading-none mt-0.5
                    ${isToday ? 'text-petrol-300' : 'text-white'}`}>
                    {d.getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {typeof shift === 'string' ? (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${SPECIAL_STYLE[shift] || ''}`}>
                      {SPECIAL_LABEL[shift] || shift}
                    </span>
                  ) : shift?.pairs?.length ? (
                    <p className="text-petrol-300 text-sm font-mono">
                      {shift.pairs.map(p => `${p.in}–${p.out}`).join('  |  ')}
                    </p>
                  ) : null}
                  {dayPunches.length > 0 && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {entrata && <span className="text-white text-sm font-bold tabular-nums">→ {punchToTime(entrata.punched_at)}</span>}
                      {uscita  && <span className="text-petrol-300 text-sm font-bold tabular-nums">← {punchToTime(uscita.punched_at)}</span>}
                      {ore     && <span className="text-petrol-500 text-xs font-semibold ml-auto">{ore}</span>}
                    </div>
                  )}
                  {anomalia && <p className="text-red-400 text-xs font-semibold mt-1">Uscita mancante</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Componente tab Richieste ──────────────────────────────────────────────────

function countDays(from, to) {
  if (!from) return 0
  const end = to && to >= from ? to : from
  const d1 = new Date(from + 'T00:00:00')
  const d2 = new Date(end  + 'T00:00:00')
  return Math.round((d2 - d1) / 86400000) + 1
}

function TabRichieste({ id }) {
  const today    = new Date()
  const todayKey = toDateKey(today)

  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [type, setType]             = useState('FERIE')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', id)
      .order('date', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function handleDateFromChange(val) {
    setDateFrom(val)
    if (dateTo && dateTo < val) setDateTo(val)
  }

  async function handleSubmit() {
    if (!dateFrom) return
    setSubmitting(true)
    const effectiveTo = dateTo && dateTo >= dateFrom ? dateTo : dateFrom
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: id,
      type,
      date:    dateFrom,
      date_to: effectiveTo !== dateFrom ? effectiveTo : null,
      note:    note || null,
      status:  'IN_ATTESA',
    })
    if (!error) {
      setDateFrom('')
      setDateTo('')
      setNote('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2500)
      load()
    }
    setSubmitting(false)
  }

  const numDays = countDays(dateFrom, dateTo)

  return (
    <div className="flex flex-col gap-5">

      {/* Form nuova richiesta */}
      <div className="bg-white/8 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <p className="text-white font-bold text-sm uppercase tracking-widest">Nuova richiesta</p>

        {/* Tipo */}
        <div className="flex gap-2">
          {['FERIE', 'PERMESSO'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                type === t ? 'bg-petrol-600 text-white' : 'bg-white/5 text-petrol-300 hover:bg-white/10'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Range date */}
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-petrol-400 text-xs font-semibold mb-1.5">Dal</p>
            <input
              type="date"
              min={todayKey}
              value={dateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-petrol-400 transition"
            />
          </div>
          <div className="flex-1">
            <p className="text-petrol-400 text-xs font-semibold mb-1.5">Al</p>
            <input
              type="date"
              min={dateFrom || todayKey}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-petrol-400 transition"
            />
          </div>
        </div>

        {numDays > 1 && (
          <p className="text-petrol-400 text-xs font-semibold text-center -mt-1">
            {numDays} giorni
          </p>
        )}

        {/* Nota */}
        <div>
          <p className="text-petrol-400 text-xs font-semibold mb-1.5">Nota (opzionale)</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Es. Motivi personali, visita medica…"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-petrol-400 transition placeholder:text-petrol-700"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!dateFrom || submitting}
          className="w-full bg-petrol-600 hover:bg-petrol-500 text-white font-bold rounded-xl py-3 text-sm transition disabled:opacity-40 active:scale-95"
        >
          {submitted ? '✓ Richiesta inviata' : submitting ? 'Invio…' : 'Invia richiesta'}
        </button>
      </div>

      {/* Storico richieste */}
      <div>
        <p className="text-petrol-400 text-xs font-bold uppercase tracking-widest mb-3">Storico</p>
        {loading ? (
          <p className="text-petrol-500 text-sm">Caricamento…</p>
        ) : requests.length === 0 ? (
          <p className="text-petrol-600 text-sm">Nessuna richiesta inviata.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map(r => {
              const days = countDays(r.date, r.date_to)
              return (
                <div key={r.id}
                  className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.type === 'FERIE' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                      }`}>{r.type}</span>
                      <span className="text-white text-sm font-semibold">
                        {r.date_to ? `${formatDateLabel(r.date)} → ${formatDateLabel(r.date_to)}` : formatDateLabel(r.date)}
                      </span>
                      {days > 1 && <span className="text-petrol-500 text-xs">{days}gg</span>}
                    </div>
                    {r.note && <p className="text-petrol-400 text-xs mt-1 truncate">"{r.note}"</p>}
                    {r.admin_comment && (
                      <p className="text-petrol-400 text-xs mt-1">
                        <span className="text-petrol-500">Admin:</span> {r.admin_comment}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${REQ_STATUS_STYLE[r.status]}`}>
                    {REQ_STATUS_LABEL[r.status]}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard principale ──────────────────────────────────────────────────────

export default function DipendenteDashboard() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [tab, setTab]           = useState('presenze')

  useEffect(() => {
    const savedId = localStorage.getItem('dipendente_id')
    if (!savedId || savedId !== id) navigate('/dipendente', { replace: true })
  }, [id, navigate])

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  function logout() {
    localStorage.removeItem('dipendente_id')
    localStorage.removeItem('dipendente_name')
    navigate('/dipendente')
  }

  if (!employee) return null

  const displayName = employee.nickname || employee.name

  return (
    <div className="min-h-screen bg-petrol-900 pb-10">

      {/* Header */}
      <div className="bg-petrol-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="HEY" className="h-7 w-auto object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <div>
            <p className="text-white font-bold text-base leading-none">{displayName}</p>
            <p className="text-petrol-400 text-xs mt-0.5">{employee.department}</p>
          </div>
        </div>
        <button onClick={logout}
          className="text-petrol-500 hover:text-white text-xs font-semibold uppercase tracking-wider transition">
          Esci
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-petrol-950 border-t border-petrol-800 px-5 flex gap-1">
        {[['presenze', 'Presenze'], ['richieste', 'Richieste']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
              tab === key
                ? 'border-petrol-400 text-white'
                : 'border-transparent text-petrol-500 hover:text-petrol-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6">
        {tab === 'presenze'
          ? <TabPresenze id={id} employee={employee} />
          : <TabRichieste id={id} />}
      </div>
    </div>
  )
}
