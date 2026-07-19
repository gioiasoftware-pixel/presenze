import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('admins')
      .select('id, name, role, department')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password)
      .single()

    setLoading(false)

    if (err || !data) {
      setError('Credenziali non valide')
      return
    }

    localStorage.setItem('admin_token', JSON.stringify({
      id: data.id, name: data.name, role: data.role, department: data.department,
    }))
    navigate('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-petrol-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-8">

        <div className="text-center flex flex-col items-center gap-3">
          <img src="/logo.png" alt="HEY" className="h-9 w-auto object-contain"
            style={{ filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <p className="text-petrol-300 text-sm">Accesso amministratore</p>
        </div>

        <button onClick={() => navigate('/')}
          className="text-petrol-400 hover:text-white text-sm font-medium transition text-center -mt-4">
          ← Torna alle firme
        </button>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-petrol-700 uppercase tracking-wider">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="es. admin"
                className="border-2 border-petrol-100 rounded-xl px-4 py-3 text-base text-petrol-900 focus:outline-none focus:border-petrol-500 transition"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-petrol-700 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full border-2 border-petrol-100 rounded-xl px-4 py-3 pr-20 text-base text-petrol-900 focus:outline-none focus:border-petrol-500 transition"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-petrol-400 hover:text-petrol-700 transition">
                  {showPw ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

            <button type="submit" disabled={loading}
              className="bg-petrol-700 text-white rounded-xl px-4 py-3.5 font-semibold text-base hover:bg-petrol-600 active:scale-95 transition mt-1 disabled:opacity-50">
              {loading ? 'Accesso…' : 'Accedi'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
