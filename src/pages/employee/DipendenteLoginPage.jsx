import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function pad(n) { return String(n).padStart(2, '0') }

export default function DipendenteLoginPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [selected, setSelected]   = useState(null)
  const [pin, setPin]             = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, pin')
      .order('name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  function selectEmployee(emp) {
    setSelected(emp)
    setPin('')
    setError('')
  }

  async function handleLogin() {
    if (!selected || pin.length < 4) return
    setLoading(true)
    setError('')
    if (selected.pin !== pin) {
      setError('PIN errato')
      setPin('')
      setLoading(false)
      return
    }
    // Salva sessione dipendente in localStorage
    localStorage.setItem('dipendente_id',   selected.id)
    localStorage.setItem('dipendente_name', selected.name)
    navigate(`/dipendente/${selected.id}`)
    setLoading(false)
  }

  const DEPT_LABEL = { SALA: 'Sala', CUCINA: 'Cucina' }

  return (
    <div className="min-h-screen bg-petrol-900 flex flex-col items-center justify-center p-5 gap-7">

      <img
        src="/logo.png"
        alt="HEY"
        className="h-9 w-auto object-contain"
        style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
      />

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-petrol-900 px-6 py-5">
          <p className="text-white font-bold text-lg">Area Dipendente</p>
          <p className="text-petrol-400 text-sm mt-0.5">Accedi per vedere le tue presenze</p>
        </div>

        {/* Step 1 — Selezione nome */}
        <div className="p-5 pb-4">
          <p className="text-xs font-bold text-petrol-400 uppercase tracking-widest mb-3">Chi sei?</p>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => selectEmployee(emp)}
                className={`py-3 px-3 rounded-2xl text-sm font-bold text-left transition active:scale-95
                  ${selected?.id === emp.id
                    ? 'bg-petrol-700 text-white shadow-md'
                    : 'bg-petrol-50 text-petrol-800'}`}
              >
                <span className="block truncate">{emp.nickname || emp.name}</span>
                <span className={`text-xs font-medium mt-0.5 block ${selected?.id === emp.id ? 'text-petrol-300' : 'text-petrol-400'}`}>
                  {DEPT_LABEL[emp.department] || emp.department}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — PIN */}
        {selected && (
          <>
            <div className="border-t border-petrol-50 mx-5" />
            <div className="p-5">
              <p className="text-xs font-bold text-petrol-400 uppercase tracking-widest mb-3">PIN</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••"
                autoFocus
                className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 text-2xl text-center text-petrol-900 tracking-[0.5em] focus:outline-none focus:border-petrol-500 transition"
              />
              {error && (
                <p className="text-red-500 text-sm font-semibold text-center mt-2">{error}</p>
              )}
              <button
                onClick={handleLogin}
                disabled={loading || pin.length < 4}
                className="mt-4 w-full bg-petrol-700 text-white rounded-2xl py-4 font-bold text-base active:scale-95 transition disabled:opacity-40"
              >
                {loading ? 'Accesso…' : 'Entra'}
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => navigate('/')}
        className="text-petrol-700 hover:text-petrol-400 text-xs font-semibold tracking-widest uppercase transition"
      >
        ← Timbratura
      </button>
    </div>
  )
}
