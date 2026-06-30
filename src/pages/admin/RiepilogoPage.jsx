import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DEPT_STYLE = {
  SALA:   'bg-petrol-100 text-petrol-700',
  CUCINA: 'bg-amber-100 text-amber-700',
}

export default function RiepilogoPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department, weekly_hours')
      .order('department').order('name')
      .then(({ data }) => { setEmployees(data || []); setLoading(false) })
  }, [])

  if (loading) return (
    <>
      <h1 className="text-3xl font-bold text-white mb-8">Riepilogo</h1>
      <p className="text-petrol-400 text-sm">Caricamento…</p>
    </>
  )

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Riepilogo</h1>
        <p className="text-petrol-300 mt-1 text-sm">Seleziona un dipendente per vedere il riepilogo mensile</p>
      </div>

      {employees.length === 0 ? (
        <p className="text-petrol-400 text-sm">Nessun dipendente in directory.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => navigate(`/admin/riepilogo/${emp.id}`)}
              className="bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 rounded-2xl p-6 text-left transition group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_STYLE[emp.department] || 'bg-gray-100 text-gray-600'}`}>
                  {emp.department}
                </span>
                <span className="text-petrol-500 group-hover:text-white text-lg transition">→</span>
              </div>
              <p className="font-bold text-white text-lg leading-tight">
                {emp.nickname || emp.name}
              </p>
              {emp.nickname && (
                <p className="text-petrol-400 text-xs mt-0.5">{emp.name}</p>
              )}
              <p className="text-petrol-400 text-xs mt-3">{emp.weekly_hours}h / settimana</p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
