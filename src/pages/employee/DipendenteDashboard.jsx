import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS_IT   = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                     'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const MONTHS_SHORT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
const DAYS_IT      = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const DAYS_SHORT   = ['do','lu','ma','me','gi','ve','sa']

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

function calcHoursFromTimes(in_, out_) {
  if (!in_ || !out_) return null
  const [h1, m1] = in_.split(':').map(Number)
  const [h2, m2] = out_.split(':').map(Number)
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
  return diff > 0 ? diff : null
}

const SPECIAL_LABEL = { OFF: 'Riposo', FERIE: 'Ferie', MALATTIA: 'Malattia', PERMESSO: 'Permesso' }
const SPECIAL_STYLE = {
  OFF:      'bg-gray-100 text-gray-500',
  FERIE:    'bg-green-100 text-green-700',
  MALATTIA: 'bg-red-100 text-red-700',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}
const SPECIAL_DARK = {
  OFF:      'bg-gray-700/40 text-gray-300',
  FERIE:    'bg-green-900/40 text-green-300',
  MALATTIA: 'bg-red-900/40 text-red-300',
  PERMESSO: 'bg-yellow-900/40 text-yellow-300',
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
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function countDays(from, to) {
  if (!from) return 0
  const d1  = new Date(from + 'T00:00:00')
  const d2  = new Date((to || from) + 'T00:00:00')
  return Math.round((d2 - d1) / 86400000) + 1
}

// ── Shift display helpers ─────────────────────────────────────────────────────

function ShiftBadge({ shift, dark = false }) {
  if (!shift) return <span className="text-petrol-600 text-sm">–</span>
  if (typeof shift === 'string') {
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dark ? SPECIAL_DARK[shift] : SPECIAL_STYLE[shift]}`}>
        {SPECIAL_LABEL[shift] || shift}
      </span>
    )
  }
  if (shift.pairs?.length) {
    return (
      <span className="text-sm font-mono text-petrol-200 leading-snug">
        {shift.pairs.map(p => `${p.in}–${p.out}`).join('\n')}
      </span>
    )
  }
  return null
}

// ── Tab Presenze ──────────────────────────────────────────────────────────────

function TabPresenze({ id, upcoming }) {
  const today = new Date()
  const todayKey = toDateKey(today)

  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth())
  const [turni, setTurni]   = useState({})
  const [punches, setPunches] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showAnomalieDetail, setShowAnomalieDetail] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days     = getDaysInMonth(year, month)
      const firstDay = toDateKey(days[0])
      const lastDay  = toDateKey(days[days.length - 1])
      const [{ data: turniData }, { data: punchData }] = await Promise.all([
        supabase.from('turni').select('date, shift_data')
          .eq('employee_id', id).gte('date', firstDay).lte('date', lastDay),
        supabase.from('punches').select('action, punched_at')
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

  // Raggruppa punch per giorno
  const punchByDay = {}
  punches.forEach(p => {
    const dk = new Date(p.punched_at).toLocaleDateString('sv')
    if (!punchByDay[dk]) punchByDay[dk] = []
    punchByDay[dk].push(p)
  })

  // Anomalie: solo giorni già terminati (escluso oggi) con ENTRATA senza USCITA
  const anomalie = Object.entries(punchByDay).filter(([dk, ps]) => {
    if (dk >= todayKey) return false
    const entries = ps.filter(p => p.action === 'ENTRATA').length
    const exits   = ps.filter(p => p.action === 'USCITA').length
    return entries > exits
  })

  // Totale ore mese
  let totalMinutes = 0
  let giorniLavorati = 0
  let ferieUsate = 0

  const days = getDaysInMonth(year, month)
  days.forEach(d => {
    const dk = toDateKey(d)
    const shift = turni[dk]
    if (typeof shift === 'string' && shift === 'FERIE') ferieUsate++

    const dayPunches = punchByDay[dk] || []
    if (dayPunches.length > 0) giorniLavorati++

    const entries = dayPunches.filter(p => p.action === 'ENTRATA').map(p => punchToTime(p.punched_at))
    const exits   = dayPunches.filter(p => p.action === 'USCITA').map(p => punchToTime(p.punched_at))
    const pairs   = Math.min(entries.length, exits.length)
    for (let i = 0; i < pairs; i++) {
      const diff = calcHoursFromTimes(entries[i], exits[i])
      if (diff) totalMinutes += diff
    }
  })

  const totH = Math.floor(totalMinutes / 60)
  const totM = totalMinutes % 60

  const todayShift = upcoming[todayKey] ?? null

  // Prossimi 5 giorni (escluso oggi)
  const next5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i + 1)
    return d
  })

  return (
    <div className="flex flex-col gap-4">

      {/* ── Anomalia banner ── */}
      {anomalie.length > 0 && (
        <button
          onClick={() => setShowAnomalieDetail(v => !v)}
          className="w-full bg-red-900/30 border border-red-500/30 rounded-2xl px-4 py-3 text-left transition hover:bg-red-900/40"
        >
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-xl">⚠</span>
            <div className="flex-1">
              <p className="text-red-300 font-bold text-sm">
                {anomalie.length === 1 ? '1 uscita mancante' : `${anomalie.length} uscite mancanti`}
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">Tocca per vedere i dettagli</p>
            </div>
            <span className="text-red-400 text-xs">{showAnomalieDetail ? '▲' : '▼'}</span>
          </div>

          {showAnomalieDetail && (
            <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-col gap-1.5">
              {anomalie.map(([dk, ps]) => {
                const d = new Date(dk + 'T00:00:00')
                const entries = ps.filter(p => p.action === 'ENTRATA')
                const label = `${DAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
                return (
                  <div key={dk} className="flex items-center justify-between">
                    <span className="text-red-300 text-xs font-semibold">{label}</span>
                    <span className="text-red-400/70 text-xs">
                      entrata {punchToTime(entries[entries.length - 1].punched_at)} senza uscita
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </button>
      )}

      {/* ── Turno di oggi ── */}
      <div className="bg-petrol-800/50 border border-petrol-600/40 rounded-2xl p-4">
        <p className="text-petrol-400 text-xs font-bold uppercase tracking-widest mb-2">Oggi</p>
        {!todayShift ? (
          <p className="text-petrol-500 text-sm font-medium">Nessun turno pianificato</p>
        ) : typeof todayShift === 'string' ? (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${SPECIAL_DARK[todayShift]}`}>
            {SPECIAL_LABEL[todayShift] || todayShift}
          </span>
        ) : todayShift.pairs?.length ? (
          <div className="flex flex-col gap-1">
            {todayShift.pairs.map((p, i) => (
              <p key={i} className="text-white font-black text-2xl tabular-nums tracking-tight">
                {p.in} <span className="text-petrol-400 font-normal text-lg">→</span> {p.out}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Prossimi 5 giorni ── */}
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <p className="text-petrol-400 text-xs font-bold uppercase tracking-widest mb-3">Prossimi giorni</p>
        <div className="grid grid-cols-5 gap-2">
          {next5.map(d => {
            const dk    = toDateKey(d)
            const shift = upcoming[dk] ?? null
            return (
              <div key={dk} className="flex flex-col items-center gap-1.5">
                <p className="text-petrol-500 text-xs font-bold">{DAYS_SHORT[d.getDay()]}</p>
                <p className="text-white text-sm font-bold tabular-nums">{d.getDate()}</p>
                <div className="text-center min-h-[20px] flex items-center justify-center">
                  {!shift ? (
                    <span className="text-petrol-700 text-xs">–</span>
                  ) : typeof shift === 'string' ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${SPECIAL_DARK[shift]}`}>
                      {shift === 'OFF' ? 'OFF' : shift.slice(0, 3)}
                    </span>
                  ) : shift.pairs?.length ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {shift.pairs.map((p, i) => (
                        <p key={i} className="text-petrol-300 text-[10px] font-mono leading-none">{p.in}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Riepilogo mese ── */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={prevMonth}
          className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
        <span className="text-white font-bold capitalize">{MONTHS_IT[month]} {year}</span>
        <button onClick={nextMonth}
          className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/8 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-petrol-400 text-[10px] font-bold uppercase tracking-wider">Giorni</p>
          <p className="text-white text-2xl font-black mt-1">{giorniLavorati}</p>
          <p className="text-petrol-500 text-[10px]">lavorati</p>
        </div>
        <div className="bg-white/8 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-petrol-400 text-[10px] font-bold uppercase tracking-wider">Ore</p>
          <p className="text-white text-2xl font-black mt-1 tabular-nums">
            {totH}{totM > 0 && <span className="text-base">:{String(totM).padStart(2,'0')}</span>}
          </p>
          <p className="text-petrol-500 text-[10px]">totali</p>
        </div>
        <div className="bg-white/8 border border-white/10 rounded-2xl p-3 text-center">
          <p className="text-petrol-400 text-[10px] font-bold uppercase tracking-wider">Ferie</p>
          <p className="text-white text-2xl font-black mt-1">{ferieUsate}</p>
          <p className="text-petrol-500 text-[10px]">giorni usati</p>
        </div>
      </div>

      {/* ── Lista giorni ── */}
      {loading ? (
        <p className="text-petrol-400 text-sm text-center py-4">Caricamento…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map(d => {
            const dk         = toDateKey(d)
            const shift      = turni[dk] ?? null
            const dayPunches = punchByDay[dk] || []
            const isToday    = todayKey === dk
            const isPast     = d < today && !isToday
            const isFuture   = d > today

            if (!shift && dayPunches.length === 0 && isFuture) return null

            const entries  = dayPunches.filter(p => p.action === 'ENTRATA')
            const exits    = dayPunches.filter(p => p.action === 'USCITA')
            const numPairs = Math.max(entries.length, exits.length)
            let totalMin   = 0
            for (let i = 0; i < numPairs; i++) {
              const diff = calcHoursFromTimes(
                entries[i] ? punchToTime(entries[i].punched_at) : null,
                exits[i]   ? punchToTime(exits[i].punched_at)   : null,
              )
              if (diff) totalMin += diff
            }
            const oreLabel = totalMin > 0
              ? `${Math.floor(totalMin/60)}h${totalMin%60 > 0 ? ` ${totalMin%60}m` : ''}`
              : null
            const anomalia = dk < todayKey && entries.length > exits.length

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
                  {numPairs > 0 && (
                    <div className="flex flex-col gap-1 mt-1.5">
                      {Array.from({ length: numPairs }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {entries[i] && <span className="text-white text-sm font-bold tabular-nums">→ {punchToTime(entries[i].punched_at)}</span>}
                          {exits[i]   && <span className="text-petrol-300 text-sm font-bold tabular-nums">← {punchToTime(exits[i].punched_at)}</span>}
                          {i === numPairs - 1 && oreLabel && <span className="text-petrol-500 text-xs font-semibold ml-auto">{oreLabel}</span>}
                        </div>
                      ))}
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

// ── Tab Richieste ─────────────────────────────────────────────────────────────

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
      setDateFrom(''); setDateTo(''); setNote('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2500)
      load()
    }
    setSubmitting(false)
  }

  const numDays = countDays(dateFrom, dateTo)

  // Badge: richieste con risposta recente
  const decided = requests.filter(r => r.status !== 'IN_ATTESA')

  return (
    <div className="flex flex-col gap-5">

      {/* Banner risposte recenti */}
      {decided.length > 0 && (
        <div className="bg-petrol-800/50 border border-petrol-600/30 rounded-2xl px-4 py-3">
          <p className="text-petrol-200 text-sm font-semibold">
            {decided.filter(r => r.status === 'APPROVATA').length > 0 && (
              <span className="text-green-400">
                {decided.filter(r => r.status === 'APPROVATA').length} approvata/e
              </span>
            )}
            {decided.filter(r => r.status === 'APPROVATA').length > 0 &&
             decided.filter(r => r.status === 'RIFIUTATA').length > 0 && ' · '}
            {decided.filter(r => r.status === 'RIFIUTATA').length > 0 && (
              <span className="text-red-400">
                {decided.filter(r => r.status === 'RIFIUTATA').length} rifiutata/e
              </span>
            )}
          </p>
          <p className="text-petrol-500 text-xs mt-0.5">Vedi storico qui sotto</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white/8 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <p className="text-white font-bold text-sm uppercase tracking-widest">Nuova richiesta</p>
        <div className="flex gap-2">
          {['FERIE', 'PERMESSO'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                type === t ? 'bg-petrol-600 text-white' : 'bg-white/5 text-petrol-300 hover:bg-white/10'
              }`}>{t}</button>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-petrol-400 text-xs font-semibold mb-1.5">Dal</p>
            <input type="date" min={todayKey} value={dateFrom}
              onChange={e => handleDateFromChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-petrol-400 transition" />
          </div>
          <div className="flex-1">
            <p className="text-petrol-400 text-xs font-semibold mb-1.5">Al</p>
            <input type="date" min={dateFrom || todayKey} value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-petrol-400 transition" />
          </div>
        </div>
        {numDays > 1 && (
          <p className="text-petrol-400 text-xs font-semibold text-center -mt-1">{numDays} giorni</p>
        )}
        <div>
          <p className="text-petrol-400 text-xs font-semibold mb-1.5">Nota (opzionale)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Es. Motivi personali, visita medica…" rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-petrol-400 transition placeholder:text-petrol-700" />
        </div>
        <button onClick={handleSubmit} disabled={!dateFrom || submitting}
          className="w-full bg-petrol-600 hover:bg-petrol-500 text-white font-bold rounded-xl py-3 text-sm transition disabled:opacity-40 active:scale-95">
          {submitted ? '✓ Richiesta inviata' : submitting ? 'Invio…' : 'Invia richiesta'}
        </button>
      </div>

      {/* Storico */}
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

  const [employee, setEmployee]   = useState(null)
  const [upcoming, setUpcoming]   = useState({})
  const [tab, setTab]             = useState('presenze')
  const [reqBadge, setReqBadge]   = useState(0)

  useEffect(() => {
    const savedId = localStorage.getItem('dipendente_id')
    if (!savedId || savedId !== id) navigate('/dipendente', { replace: true })
  }, [id, navigate])

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  // Carica turni oggi + prossimi 5 giorni
  useEffect(() => {
    const today = new Date()
    const dates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      return toDateKey(d)
    })
    supabase.from('turni').select('date, shift_data')
      .eq('employee_id', id)
      .in('date', dates)
      .then(({ data }) => {
        const m = {}
        data?.forEach(r => { m[r.date] = r.shift_data })
        setUpcoming(m)
      })
  }, [id])

  // Badge richieste con risposta
  useEffect(() => {
    supabase.from('leave_requests')
      .select('id', { count: 'exact' })
      .eq('employee_id', id)
      .neq('status', 'IN_ATTESA')
      .then(({ count }) => setReqBadge(count || 0))
  }, [id])

  function logout() {
    localStorage.removeItem('dipendente_id')
    localStorage.removeItem('dipendente_name')
    navigate('/dipendente')
  }

  if (!employee) return null

  return (
    <div className="min-h-screen bg-petrol-900 pb-10">

      {/* Header */}
      <div className="bg-petrol-950 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="HEY" className="h-7 w-auto object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <div>
            <p className="text-white font-bold text-base leading-none">{employee.nickname || employee.name}</p>
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
        {[['presenze', 'Presenze', 0], ['richieste', 'Richieste', reqBadge]].map(([key, label, badge]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative px-5 py-3 text-sm font-semibold border-b-2 transition ${
              tab === key
                ? 'border-petrol-400 text-white'
                : 'border-transparent text-petrol-500 hover:text-petrol-300'
            }`}>
            {label}
            {badge > 0 && (
              <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-petrol-400" />
            )}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 mt-5">
        {tab === 'presenze'
          ? <TabPresenze id={id} upcoming={upcoming} />
          : <TabRichieste id={id} />}
      </div>
    </div>
  )
}
