import { useState } from 'react'

const ROLES = [
  { value: 'senior',   label: 'Senior',       desc: 'Controllo totale su tutto' },
  { value: 'superior', label: 'Superior',      desc: 'Gestisce i turni del proprio reparto' },
  { value: 'visual',   label: 'Solo lettura',  desc: 'Visualizzazione senza modifiche' },
]

const EMPTY = { name: '', username: '', password: '', role: 'visual', department: null }

export default function AdminManageModal({ mode, initial, saving, onSave, onClose }) {
  const [form, setForm]     = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY })
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState({})

  function set(k, v) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim())     e.name     = 'Campo obbligatorio'
    if (!form.username.trim()) e.username  = 'Campo obbligatorio'
    if (!form.password)        e.password  = 'Campo obbligatorio'
    if (form.role === 'superior' && !form.department) e.department = 'Seleziona il reparto'
    return e
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({
      ...form,
      username:   form.username.trim().toLowerCase(),
      department: form.role === 'superior' ? form.department : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 overflow-y-auto max-h-[90vh]">

        <div className="flex justify-between items-center mb-7">
          <h2 className="font-bold text-xl text-petrol-900">
            {mode === 'add' ? 'Nuovo amministratore' : 'Modifica amministratore'}
          </h2>
          <button onClick={onClose} className="text-petrol-300 hover:text-petrol-700 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Nome</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Es. Marco Rossi"
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition ${errors.name ? 'border-red-300' : 'border-petrol-100'}`} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Username</label>
            <input type="text" value={form.username} onChange={e => set('username', e.target.value)}
              placeholder="Es. marco"
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition ${errors.username ? 'border-red-300' : 'border-petrol-100'}`} />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => set('password', e.target.value)} placeholder="••••••••"
                className={`w-full border-2 rounded-xl px-4 py-3 pr-20 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition ${errors.password ? 'border-red-300' : 'border-petrol-100'}`} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-petrol-400 hover:text-petrol-700 transition">
                {showPw ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Ruolo */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Ruolo</label>
            <div className="flex flex-col gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition ${
                    form.role === r.value
                      ? 'border-petrol-600 bg-petrol-50'
                      : 'border-petrol-100 hover:border-petrol-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      form.role === r.value ? 'bg-petrol-600 border-petrol-600' : 'border-petrol-300'
                    }`} />
                    <span className="font-semibold text-petrol-900 text-sm">{r.label}</span>
                  </div>
                  <p className="text-petrol-400 text-xs mt-0.5 ml-5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Reparto (solo per Superior) */}
          {form.role === 'superior' && (
            <div>
              <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Reparto</label>
              <div className="flex gap-3">
                {['SALA', 'CUCINA'].map(d => (
                  <button key={d} type="button" onClick={() => set('department', d)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition ${
                      form.department === d
                        ? 'bg-petrol-700 text-white border-petrol-700'
                        : 'bg-white text-petrol-500 border-petrol-100 hover:border-petrol-400'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
              {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border-2 border-petrol-100 rounded-xl py-3 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-petrol-700 text-white rounded-xl py-3 text-sm font-bold hover:bg-petrol-600 transition disabled:opacity-50">
              {saving ? 'Salvataggio…' : mode === 'add' ? 'Aggiungi' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
