import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import PinModal from './PinModal'
import StatusMessage from './StatusMessage'

const DEPT_LABELS = {
  SALA:   { label: 'Sala',   icon: '🍽', color: 'bg-petrol-600 text-white', active: 'ring-4 ring-petrol-300' },
  CUCINA: { label: 'Cucina', icon: '👨‍🍳', color: 'bg-petrol-800 text-white', active: 'ring-4 ring-petrol-300' },
}

function pad(n) { return String(n).padStart(2, '0') }

function getNow() {
  const d = new Date()
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    secs: pad(d.getSeconds()),
    date: d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

export default function EmployeePage() {
  const [dept, setDept]               = useState(null)
  const [name, setName]               = useState('')
  const [employeesByDept, setEmployeesByDept] = useState({ SALA: [], CUCINA: [] })
  const [clock, setClock]             = useState(getNow())
  const [customTime, setCustomTime]   = useState('')
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [note, setNote]               = useState('')
  const [showNote, setShowNote]       = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [status, setStatus]           = useState(null)
  const [busy, setBusy]               = useState(false)

  useEffect(() => {
    const id = setInterval(() => setClock(getNow()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function loadEmployees() {
      const { data } = await supabase.from('employees').select('id, name, nickname, department, pin').order('name')
      if (!data) return
      setEmployeesByDept({
        SALA:   data.filter(e => e.department === 'SALA'),
        CUCINA: data.filter(e => e.department === 'CUCINA'),
      })
    }
    loadEmployees()
  }, [])

  function selectDept(d) {
    setDept(d)
    setName('')
    setStatus(null)
  }

  const activeTime = showCustomTime && customTime ? customTime : clock.time
  const employees  = dept ? employeesByDept[dept] : []

  function startAction(action) {
    if (busy) return
    if (!name) {
      setStatus({ type: 'err', msg: 'Seleziona prima il tuo nome.' })
      setTimeout(() => setStatus(null), 3000)
      return
    }
    setStatus(null)
    setPendingAction(action)
  }

  async function handlePinConfirmed(pin) {
    setBusy(true)
    try {
      const employee = employees.find(e => e.name === name)
      if (!employee || employee.pin !== pin) return { ok: false, error: 'PIN errato' }

      // Costruisce il timestamp locale corretto (activeTime è ora locale CEST)
      const [h, m] = activeTime.split(':').map(Number)
      const now = new Date()
      const punchedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)

      const { error } = await supabase.from('punches').insert({
        employee_id: employee.id,
        action:      pendingAction,
        punched_at:  punchedAt.toISOString(),
        note:        note || null,
      })
      if (error) return { ok: false, error: 'Errore di rete, riprova' }
      return { ok: true, time: activeTime }
    } finally {
      setBusy(false)
    }
  }

  function handlePinSuccess(savedTime) {
    setPendingAction(null)
    setNote('')
    setShowNote(false)
    setShowCustomTime(false)
    setCustomTime('')
    setStatus({ type: 'ok', msg: `Registrato alle ${savedTime}` })
    setTimeout(() => setStatus(null), 5000)
  }

  function handlePinCancel() {
    setPendingAction(null)
  }

  const dateLabel = clock.date.charAt(0).toUpperCase() + clock.date.slice(1)

  return (
    <div className="min-h-screen bg-petrol-900 flex flex-col items-center justify-center p-5 gap-7">

      {/* Logo */}
      <img
        src="/logo.png"
        alt="HEY"
        className="h-9 w-auto object-contain"
        style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
      />

      {/* Orologio */}
      <div className="text-center select-none">
        <div className="flex items-end justify-center gap-1 leading-none">
          <span className="text-7xl font-black text-white tracking-tight tabular-nums">
            {clock.time}
          </span>
          <span className="text-3xl font-bold text-petrol-500 mb-1 tabular-nums">
            :{clock.secs}
          </span>
        </div>
        <p className="text-petrol-400 text-base mt-2 font-medium">{dateLabel}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Step 1: Reparto ─────────────────────────────────────────── */}
        <div className="p-5 pb-4">
          <p className="text-xs font-bold text-petrol-400 uppercase tracking-widest mb-3">Reparto</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(DEPT_LABELS).map(([key, d]) => (
              <button
                key={key}
                onClick={() => selectDept(key)}
                className={`
                  py-5 rounded-2xl font-bold text-lg flex flex-col items-center gap-1.5
                  transition active:scale-95
                  ${d.color}
                  ${dept === key ? 'ring-4 ring-petrol-400 ring-offset-2' : 'opacity-60 hover:opacity-90'}
                `}
              >
                <span className="text-3xl leading-none">{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Step 2: Nome (visibile solo dopo aver scelto reparto) ────── */}
        {dept && (
          <>
            <div className="border-t border-petrol-50 mx-5" />
            <div className="p-5 pb-4">
              <p className="text-xs font-bold text-petrol-400 uppercase tracking-widest mb-3">Chi sei?</p>
              <div className="grid grid-cols-2 gap-2">
                {employees.length === 0 && (
                  <p className="col-span-2 text-center text-petrol-300 text-sm py-2">Caricamento…</p>
                )}
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => setName(emp.name)}
                    className={`
                      py-4 px-4 rounded-2xl text-base font-bold text-left
                      transition active:scale-95
                      ${name === emp.name
                        ? 'bg-petrol-700 text-white shadow-md'
                        : 'bg-petrol-50 text-petrol-800'}
                    `}
                  >
                    {emp.nickname || emp.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Orario + Note (solo se nome scelto) ─────────────── */}
        {name && (
          <>
            <div className="border-t border-petrol-50 mx-5" />
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-petrol-400 uppercase tracking-widest">Orario</p>
                <button
                  onClick={() => { setShowCustomTime(v => !v); setCustomTime('') }}
                  className="text-xs font-semibold text-petrol-400 active:opacity-60 py-1 px-2 -mr-2"
                >
                  {showCustomTime ? 'Usa orario attuale' : 'Modifica'}
                </button>
              </div>

              {showCustomTime ? (
                <input
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  className="mt-2 w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-xl text-petrol-900 focus:outline-none focus:border-petrol-500 transition"
                />
              ) : (
                <div className="mt-1 text-3xl font-black text-petrol-700 tabular-nums tracking-tight">
                  {clock.time}
                </div>
              )}
            </div>

            <div className="px-5 pb-4">
              <button
                onClick={() => setShowNote(v => !v)}
                className="text-xs font-semibold text-petrol-300 flex items-center gap-1 py-1"
              >
                <span className="text-base leading-none">{showNote ? '−' : '+'}</span>
                <span>{showNote ? 'Rimuovi nota' : 'Aggiungi nota'}</span>
              </button>

              {showNote && (
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Es. Uscita anticipata…"
                  rows={2}
                  autoFocus
                  className="mt-2 w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-base text-petrol-900 resize-none focus:outline-none focus:border-petrol-400 transition placeholder:text-petrol-200"
                />
              )}
            </div>

            <div className="border-t border-petrol-50" />

            {/* Bottoni azione */}
            <div className="p-5 flex gap-3">
              <button
                onClick={() => startAction('ENTRATA')}
                disabled={busy}
                className="flex-1 flex flex-col items-center gap-1.5 bg-petrol-600 text-white rounded-2xl py-6 font-bold text-lg active:scale-95 transition disabled:opacity-50 shadow-lg shadow-petrol-900/20"
              >
                <span className="text-3xl leading-none">→</span>
                <span>Entrata</span>
              </button>
              <button
                onClick={() => startAction('USCITA')}
                disabled={busy}
                className="flex-1 flex flex-col items-center gap-1.5 bg-petrol-950 text-white rounded-2xl py-6 font-bold text-lg active:scale-95 transition disabled:opacity-50 shadow-lg shadow-petrol-950/30"
              >
                <span className="text-3xl leading-none">←</span>
                <span>Uscita</span>
              </button>
            </div>
          </>
        )}

        {status && (
          <div className="px-5 pb-5">
            <StatusMessage type={status.type} msg={status.msg} />
          </div>
        )}
      </div>

      {pendingAction && (
        <PinModal
          name={name}
          action={pendingAction}
          onConfirm={handlePinConfirmed}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      )}
    </div>
  )
}
