import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PAGE = 50

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' +
         d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function diffMinutes(a, b) {
  return Math.abs(Math.round((new Date(a) - new Date(b)) / 60000))
}

function toIsoLocal(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m]     = timeStr.split(':').map(Number)
  return new Date(y, mo - 1, d, h, m, 0).toISOString()
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const EMPTY_FORM = { employeeId: '', action: 'ENTRATA', date: todayStr(), time: nowTimeStr(), note: '' }

export default function LogPage() {
  const [punches, setPunches]     = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [deleteId, setDeleteId]   = useState(null)
  const [modal, setModal]         = useState(null) // null | { mode:'add'|'edit', punch? }
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  // Filtri
  const [filterEmp, setFilterEmp]       = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate]     = useState('today')

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname').order('name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  useEffect(() => {
    setPage(0)
    setPunches([])
    load(0, true)
  }, [filterEmp, filterAction, filterDate])

  async function load(pageNum = 0, reset = false) {
    setLoading(true)
    let q = supabase
      .from('punches')
      .select('id, action, punched_at, created_at, note, is_manual, employees(id, name, nickname)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE, pageNum * PAGE + PAGE - 1)

    if (filterEmp)    q = q.eq('employee_id', filterEmp)
    if (filterAction) q = q.eq('action', filterAction)

    if (filterDate === 'today') {
      const today = new Date().toISOString().slice(0, 10)
      q = q.gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59')
    } else if (filterDate === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7)
      q = q.gte('created_at', d.toISOString())
    } else if (filterDate === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 30)
      q = q.gte('created_at', d.toISOString())
    }

    const { data, count } = await q
    setTotal(count || 0)
    setPunches(prev => reset ? (data || []) : [...prev, ...(data || [])])
    setLoading(false)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    load(next, false)
  }

  // ── Modal helpers ────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM, date: todayStr(), time: nowTimeStr() })
    setModal({ mode: 'add' })
  }

  function openEdit(p) {
    const d = new Date(p.punched_at)
    setForm({
      employeeId: p.employees?.id || '',
      action:     p.action,
      date:       `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      time:       `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
      note:       p.note || '',
    })
    setModal({ mode: 'edit', punch: p })
  }

  function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.employeeId || !form.date || !form.time) return
    setSaving(true)
    const punched_at = toIsoLocal(form.date, form.time)

    if (modal.mode === 'add') {
      const { data, error } = await supabase.from('punches').insert({
        employee_id: form.employeeId,
        action:      form.action,
        punched_at,
        note:        form.note || null,
        is_manual:   true,
      }).select('id, action, punched_at, created_at, note, is_manual, employees(id, name, nickname)').single()

      if (!error && data) {
        setPunches(prev => [data, ...prev])
        setTotal(t => t + 1)
      }
    } else {
      const { error } = await supabase.from('punches').update({
        employee_id: form.employeeId,
        action:      form.action,
        punched_at,
        note:        form.note || null,
        is_manual:   true,
      }).eq('id', modal.punch.id)

      if (!error) {
        // ricarica per avere i dati freschi (incluso join employees)
        load(0, true)
      }
    }

    setSaving(false)
    setModal(null)
  }

  async function handleDelete(id) {
    await supabase.from('punches').delete().eq('id', id)
    setPunches(prev => prev.filter(p => p.id !== id))
    setTotal(t => t - 1)
    setDeleteId(null)
  }

  const hasMore = punches.length < total

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Log presenze</h1>
          <p className="text-petrol-300 mt-1 text-sm">{total} registrazioni trovate</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-petrol-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-petrol-500 transition"
        >
          + Nuova registrazione
        </button>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10">
          {[
            { k: 'today', label: 'Oggi' },
            { k: 'week',  label: '7 giorni' },
            { k: 'month', label: '30 giorni' },
            { k: 'all',   label: 'Tutto' },
          ].map(({ k, label }) => (
            <button key={k} onClick={() => setFilterDate(k)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterDate === k ? 'bg-petrol-600 text-white' : 'text-petrol-300 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-petrol-400 transition">
          <option value="">Tutti i dipendenti</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.nickname || e.name}</option>
          ))}
        </select>

        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-petrol-400 transition">
          <option value="">Entrata + Uscita</option>
          <option value="ENTRATA">Solo Entrata</option>
          <option value="USCITA">Solo Uscita</option>
        </select>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {loading && punches.length === 0 ? (
          <div className="text-center py-16 text-petrol-300 text-sm">Caricamento…</div>
        ) : punches.length === 0 ? (
          <div className="text-center py-16 text-petrol-300 text-sm">Nessuna registrazione</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-petrol-50 bg-petrol-50">
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Nome</th>
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Data</th>
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Azione</th>
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Orario segnato</th>
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Registrazione effettiva</th>
                    <th className="text-left px-5 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Note</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {punches.map(p => {
                    const diff = diffMinutes(p.punched_at, p.created_at)
                    const hasDiff = !p.is_manual && diff >= 2
                    const emp = p.employees
                    return (
                      <tr key={p.id} className="hover:bg-petrol-50/50 transition group">

                        <td className="px-5 py-3.5 font-semibold text-petrol-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {emp?.nickname || emp?.name || '—'}
                            {p.is_manual && (
                              <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-bold">
                                ADM
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-petrol-600 whitespace-nowrap">
                          {fmtDate(p.punched_at)}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.action === 'ENTRATA'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-petrol-100 text-petrol-700'
                          }`}>
                            {p.action === 'ENTRATA' ? '→ Entrata' : '← Uscita'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 font-mono font-semibold text-petrol-800 whitespace-nowrap">
                          {fmtTime(p.punched_at)}
                          {hasDiff && (
                            <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                              Δ{diff}min
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-petrol-400 text-xs whitespace-nowrap">
                          {p.is_manual ? <span className="text-petrol-200 italic">inserita manualmente</span> : fmtDateTime(p.created_at)}
                        </td>

                        <td className="px-5 py-3.5 text-petrol-400 text-xs max-w-[160px] truncate">
                          {p.note || <span className="text-petrol-200">—</span>}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => openEdit(p)}
                              className="text-petrol-400 hover:text-petrol-700 transition text-sm"
                              title="Modifica"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="text-petrol-200 hover:text-red-400 transition text-sm"
                              title="Elimina"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="px-5 py-4 border-t border-petrol-50 text-center">
                <button onClick={loadMore} disabled={loading}
                  className="text-sm font-semibold text-petrol-500 hover:text-petrol-800 transition disabled:opacity-40">
                  {loading ? 'Caricamento…' : `Carica altri (${total - punches.length} rimanenti)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal aggiungi / modifica ───────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">

            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xl text-petrol-900">
                {modal.mode === 'add' ? 'Nuova registrazione' : 'Modifica registrazione'}
              </h2>
              <button onClick={() => setModal(null)} className="text-petrol-300 hover:text-petrol-700 text-2xl leading-none">×</button>
            </div>

            {/* Dipendente */}
            <div>
              <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Dipendente</label>
              <select
                value={form.employeeId}
                onChange={e => setField('employeeId', e.target.value)}
                className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition bg-white"
              >
                <option value="" disabled>Seleziona…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.nickname || e.name}</option>
                ))}
              </select>
            </div>

            {/* Azione */}
            <div>
              <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Azione</label>
              <div className="flex gap-3">
                {['ENTRATA', 'USCITA'].map(a => (
                  <button key={a} type="button" onClick={() => setField('action', a)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition ${
                      form.action === a
                        ? 'bg-petrol-700 text-white border-petrol-700'
                        : 'bg-white text-petrol-500 border-petrol-100 hover:border-petrol-400'
                    }`}>
                    {a === 'ENTRATA' ? '→ Entrata' : '← Uscita'}
                  </button>
                ))}
              </div>
            </div>

            {/* Data + Orario */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Data</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                  className="w-full border-2 border-petrol-100 rounded-xl px-3 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Orario</label>
                <input type="time" value={form.time} onChange={e => setField('time', e.target.value)}
                  className="w-full border-2 border-petrol-100 rounded-xl px-3 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition" />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">
                Note <span className="text-petrol-300 normal-case font-normal">(opzionale)</span>
              </label>
              <textarea
                value={form.note}
                onChange={e => setField('note', e.target.value)}
                rows={2}
                placeholder="Es. Dimenticato di timbrare…"
                className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-sm text-petrol-900 resize-none focus:outline-none focus:border-petrol-500 transition"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal(null)}
                className="flex-1 border-2 border-petrol-100 rounded-xl py-3 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving || !form.employeeId}
                className="flex-1 bg-petrol-700 text-white rounded-xl py-3 text-sm font-bold hover:bg-petrol-600 transition disabled:opacity-50">
                {saving ? 'Salvataggio…' : modal.mode === 'add' ? 'Aggiungi' : 'Salva modifiche'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal elimina */}
      {deleteId && (
        <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 flex flex-col gap-5">
            <h2 className="font-bold text-xl text-petrol-900">Elimina registrazione</h2>
            <p className="text-petrol-500 text-sm leading-relaxed">
              Vuoi eliminare questa timbratura? L'azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border-2 border-petrol-100 rounded-xl py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
                Annulla
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
