import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const FILTERS = ['IN_ATTESA', 'APPROVATA', 'RIFIUTATA']

const TYPE_STYLE = {
  FERIE:    'bg-green-100 text-green-700',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}

const STATUS_STYLE = {
  IN_ATTESA: 'bg-petrol-100 text-petrol-700',
  APPROVATA: 'bg-green-100 text-green-700',
  RIFIUTATA: 'bg-red-100 text-red-700',
}
const STATUS_LABEL = {
  IN_ATTESA: 'In attesa',
  APPROVATA: 'Approvata',
  RIFIUTATA: 'Rifiutata',
}

const MONTHS_IT = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function getDaysInRange(from, to) {
  const days = []
  const d   = new Date(from + 'T00:00:00')
  const end = new Date((to || from) + 'T00:00:00')
  while (d <= end) { days.push(toDateKey(d)); d.setDate(d.getDate() + 1) }
  return days
}

function countDays(from, to) {
  if (!from) return 1
  return getDaysInRange(from, to).length
}

export default function RichiestePage() {
  const [filter, setFilter]       = useState('IN_ATTESA')
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [comments, setComments]   = useState({})   // id → testo commento
  const [processing, setProcessing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leave_requests')
      .select('*, employees(name, nickname, department)')
      .eq('status', filter)
      .order('date', { ascending: true })
    setRequests(data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleDecision(req, decision) {
    setProcessing(req.id)
    const comment = comments[req.id] || null

    // Aggiorna stato richiesta
    await supabase.from('leave_requests').update({
      status:        decision,
      admin_comment: comment,
    }).eq('id', req.id)

    // Se approvata → segna tutti i giorni del range nei turni
    if (decision === 'APPROVATA') {
      const days = getDaysInRange(req.date, req.date_to)
      await supabase.from('turni').upsert(
        days.map(date => ({ employee_id: req.employee_id, date, shift_data: req.type })),
        { onConflict: 'employee_id,date' }
      )
    }

    setProcessing(null)
    setComments(prev => { const n = { ...prev }; delete n[req.id]; return n })
    load()
  }

  const pendingCount = requests.filter(r => r.status === 'IN_ATTESA').length

  return (
    <>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Richieste</h1>
          <p className="text-petrol-300 mt-1 text-sm">Ferie e permessi richiesti dai dipendenti</p>
        </div>

        {/* Badge in attesa */}
        {filter !== 'IN_ATTESA' && (
          <button onClick={() => setFilter('IN_ATTESA')}
            className="text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1.5 rounded-full">
            {pendingCount > 0 ? `${pendingCount} in attesa` : ''}
          </button>
        )}
      </div>

      {/* Filtri */}
      <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10 w-fit mb-6">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              filter === f ? 'bg-petrol-600 text-white shadow' : 'text-petrol-300 hover:text-white'
            }`}>
            {STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-petrol-400 text-sm">Caricamento…</p>
      ) : requests.length === 0 ? (
        <p className="text-petrol-400 text-sm">Nessuna richiesta {STATUS_LABEL[filter].toLowerCase()}.</p>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {requests.map(req => {
            const emp = req.employees
            return (
              <div key={req.id}
                className="bg-white/8 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">

                {/* Intestazione */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-white font-bold text-base">{emp?.nickname || emp?.name}</p>
                    <p className="text-petrol-400 text-xs mt-0.5">{emp?.department}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TYPE_STYLE[req.type]}`}>
                      {req.type}
                    </span>
                    <span className="text-white font-semibold text-sm">
                      {req.date_to
                        ? `${formatDate(req.date)} → ${formatDate(req.date_to)}`
                        : formatDate(req.date)}
                    </span>
                    {req.date_to && (
                      <span className="text-petrol-400 text-xs font-semibold">
                        {countDays(req.date, req.date_to)} giorni
                      </span>
                    )}
                    {filter !== 'IN_ATTESA' && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[req.status]}`}>
                        {STATUS_LABEL[req.status]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Nota dipendente */}
                {req.note && (
                  <p className="text-petrol-300 text-sm italic bg-white/5 rounded-xl px-4 py-2">
                    "{req.note}"
                  </p>
                )}

                {/* Commento admin (se già gestita) */}
                {req.admin_comment && filter !== 'IN_ATTESA' && (
                  <p className="text-petrol-400 text-xs">
                    <span className="font-semibold text-petrol-300">Nota admin:</span> {req.admin_comment}
                  </p>
                )}

                {/* Azioni (solo IN_ATTESA) */}
                {filter === 'IN_ATTESA' && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                    <input
                      type="text"
                      placeholder="Commento opzionale…"
                      value={comments[req.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-petrol-600 focus:outline-none focus:border-petrol-400 transition"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={processing === req.id}
                        onClick={() => handleDecision(req, 'APPROVATA')}
                        className="flex-1 bg-green-700/80 hover:bg-green-600 text-white font-bold rounded-xl py-2.5 text-sm transition disabled:opacity-40">
                        {processing === req.id ? '…' : 'Approva'}
                      </button>
                      <button
                        disabled={processing === req.id}
                        onClick={() => handleDecision(req, 'RIFIUTATA')}
                        className="flex-1 bg-red-800/60 hover:bg-red-700 text-white font-bold rounded-xl py-2.5 text-sm transition disabled:opacity-40">
                        {processing === req.id ? '…' : 'Rifiuta'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
