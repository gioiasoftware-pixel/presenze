import { useState } from 'react'

const EMPTY = { name: '', nickname: '', department: 'SALA', weeklyHours: 40, pin: '', iban: '' }

export default function EmployeeModal({ mode, initial, saving, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY })
  const [showPin, setShowPin] = useState(false)
  const [showIban, setShowIban] = useState(false)
  const [errors, setErrors] = useState({})

  const isEdit = mode === 'edit'

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim())                        e.name        = 'Campo obbligatorio'
    if (!form.pin || !/^\d{4}$/.test(form.pin))  e.pin         = 'Il PIN deve essere di 4 cifre numeriche'
    if (!form.weeklyHours || form.weeklyHours<=0) e.weeklyHours = 'Inserisci le ore settimanali'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...form, weeklyHours: Number(form.weeklyHours) })
  }

  return (
    <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 overflow-y-auto max-h-[90vh]">

        <div className="flex justify-between items-center mb-7">
          <h2 className="font-bold text-xl text-petrol-900">{isEdit ? 'Modifica dipendente' : 'Nuovo dipendente'}</h2>
          <button onClick={onClose} className="text-petrol-300 hover:text-petrol-700 text-2xl leading-none transition">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Nome completo */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">
              Nome completo
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Es. Mario Rossi"
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition ${errors.name ? 'border-red-300' : 'border-petrol-100'}`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name}</p>}
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">
              Nickname <span className="text-petrol-300 normal-case font-normal">(mostrato nella schermata timbratura)</span>
            </label>
            <input
              type="text"
              value={form.nickname}
              onChange={e => set('nickname', e.target.value)}
              placeholder="Es. Mario"
              className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition"
            />
          </div>

          {/* Reparto */}
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
          </div>

          {/* Ore settimanali */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">Ore contrattuali / settimana</label>
            <input
              type="number" min="1" max="48"
              value={form.weeklyHours}
              onChange={e => set('weeklyHours', e.target.value)}
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition ${errors.weeklyHours ? 'border-red-300' : 'border-petrol-100'}`}
            />
            {errors.weeklyHours && <p className="text-red-500 text-xs mt-1.5">{errors.weeklyHours}</p>}
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">PIN (4 cifre)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={form.pin}
                onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4} placeholder="••••"
                className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition pr-20 ${errors.pin ? 'border-red-300' : 'border-petrol-100'}`}
              />
              <button type="button" onClick={() => setShowPin(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-petrol-400 hover:text-petrol-700 transition">
                {showPin ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
            {errors.pin && <p className="text-red-500 text-xs mt-1.5">{errors.pin}</p>}
          </div>

          {/* IBAN */}
          <div>
            <label className="block text-xs font-semibold text-petrol-700 uppercase tracking-wider mb-2">
              IBAN <span className="text-petrol-300 normal-case font-normal">(opzionale)</span>
            </label>
            <div className="relative">
              <input
                type={showIban ? 'text' : 'password'}
                value={form.iban}
                onChange={e => set('iban', e.target.value.replace(/\s/g, '').toUpperCase())}
                placeholder="IT00X0000000000000000000000"
                className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-sm text-petrol-900 focus:outline-none focus:border-petrol-500 transition pr-20 font-mono"
              />
              <button type="button" onClick={() => setShowIban(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-petrol-400 hover:text-petrol-700 transition">
                {showIban ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border-2 border-petrol-100 rounded-xl py-3 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-petrol-700 text-white rounded-xl py-3 text-sm font-bold hover:bg-petrol-600 transition disabled:opacity-50">
              {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
