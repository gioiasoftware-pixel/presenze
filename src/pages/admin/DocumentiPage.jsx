import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DEPT_STYLE = {
  SALA:   'bg-petrol-100 text-petrol-700',
  CUCINA: 'bg-amber-100 text-amber-700',
}

export default function DocumentiPage() {
  const [employees, setEmployees] = useState([])
  const [docCounts, setDocCounts] = useState({})
  const [loading, setLoading]     = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ data: emps }, { data: docs }] = await Promise.all([
        supabase.from('employees').select('id, name, nickname, department').order('department').order('name'),
        supabase.from('employee_documents').select('employee_id, type'),
      ])
      setEmployees(emps || [])
      const counts = {}
      docs?.forEach(d => {
        if (!counts[d.employee_id]) counts[d.employee_id] = { contratto: 0, busta_paga: 0 }
        counts[d.employee_id][d.type]++
      })
      setDocCounts(counts)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Documenti</h1>
        <p className="text-petrol-300 mt-1 text-sm">Contratti e buste paga per dipendente</p>
      </div>

      {loading ? (
        <p className="text-petrol-400 text-sm">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {employees.map(emp => {
            const counts      = docCounts[emp.id] || {}
            const hasContract = (counts.contratto || 0) > 0
            const busteCount  = counts.busta_paga || 0
            return (
              <button key={emp.id}
                onClick={() => navigate(`/admin/documenti/${emp.id}`)}
                className="bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 rounded-2xl p-6 text-left transition group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_STYLE[emp.department] || 'bg-gray-100 text-gray-600'}`}>
                    {emp.department}
                  </span>
                  <span className="text-petrol-500 group-hover:text-white text-lg transition">→</span>
                </div>
                <p className="font-bold text-white text-lg leading-tight">{emp.nickname || emp.name}</p>
                {emp.nickname && <p className="text-petrol-400 text-xs mt-0.5">{emp.name}</p>}
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasContract ? 'bg-green-400' : 'bg-petrol-700'}`} />
                    <span className="text-xs text-petrol-400">{hasContract ? 'Contratto caricato' : 'Nessun contratto'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${busteCount > 0 ? 'bg-green-400' : 'bg-petrol-700'}`} />
                    <span className="text-xs text-petrol-400">
                      {busteCount > 0 ? `${busteCount} busta${busteCount > 1 ? 'e' : ''} paga` : 'Nessuna busta paga'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
