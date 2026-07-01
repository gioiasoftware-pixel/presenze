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

export default function DipendenteDashboard() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const today      = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [employee, setEmployee] = useState(null)
  const [turni, setTurni]       = useState({})
  const [punches, setPunches]   = useState([])
  const [loading, setLoading]   = useState(true)

  // Verifica sessione
  useEffect(() => {
    const savedId = localStorage.getItem('dipendente_id')
    if (!savedId || savedId !== id) {
      navigate('/dipendente', { replace: true })
    }
  }, [id, navigate])

  // Carica dati dipendente
  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  // Carica turni e timbrature del mese selezionato
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

  function logout() {
    localStorage.removeItem('dipendente_id')
    localStorage.removeItem('dipendente_name')
    navigate('/dipendente')
  }

  // Calcola ore totali del mese
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

  // Raggruppa timbrature per giorno
  const punchByDay = {}
  punches.forEach(p => {
    const dk = new Date(p.punched_at).toLocaleDateString('sv')
    if (!punchByDay[dk]) punchByDay[dk] = []
    punchByDay[dk].push(p)
  })

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

      <div className="max-w-lg mx-auto px-4 mt-6 flex flex-col gap-5">

        {/* Navigazione mese */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth}
            className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">←</button>
          <span className="text-white font-bold capitalize">{MONTHS_IT[month]} {year}</span>
          <button onClick={nextMonth}
            className="text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10 transition">→</button>
        </div>

        {/* Card totale ore */}
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
              const isToday = toDateKey(today) === dk
              const isPast  = d < today && !isToday
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
                  {/* Data */}
                  <div className="w-10 text-center shrink-0">
                    <p className="text-petrol-400 text-xs font-bold">{DAYS_IT[d.getDay()]}</p>
                    <p className={`font-black text-xl tabular-nums leading-none mt-0.5
                      ${isToday ? 'text-petrol-300' : 'text-white'}`}>
                      {d.getDate()}
                    </p>
                  </div>

                  {/* Contenuto */}
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
                        {entrata && (
                          <span className="text-white text-sm font-bold tabular-nums">
                            → {punchToTime(entrata.punched_at)}
                          </span>
                        )}
                        {uscita && (
                          <span className="text-petrol-300 text-sm font-bold tabular-nums">
                            ← {punchToTime(uscita.punched_at)}
                          </span>
                        )}
                        {ore && (
                          <span className="text-petrol-500 text-xs font-semibold ml-auto">{ore}</span>
                        )}
                      </div>
                    )}

                    {anomalia && (
                      <p className="text-red-400 text-xs font-semibold mt-1">Uscita mancante</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
