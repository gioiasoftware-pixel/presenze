import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import EmployeeModal from './EmployeeModal'
import AdminManageModal from './AdminManageModal'

const DEPT_BADGE = {
  SALA:   'bg-petrol-100 text-petrol-700',
  CUCINA: 'bg-amber-100 text-amber-700',
}

const ROLE_BADGE = {
  senior:   'bg-petrol-900 text-white',
  superior: 'bg-amber-100 text-amber-700',
  visual:   'bg-gray-100 text-gray-500',
}

const ROLE_LABEL = {
  senior:   'Senior',
  superior: 'Superior',
  visual:   'Solo lettura',
}

function toRow(e) {
  return {
    id: e.id, name: e.name, nickname: e.nickname || '',
    department: e.department, weeklyHours: e.weekly_hours,
    pin: e.pin, iban: e.iban || '',
  }
}

export default function DirectoryPage() {
  const [tab, setTab] = useState('employees')

  // ── Dipendenti ──
  const [employees, setEmployees] = useState([])
  const [empLoading, setEmpLoading] = useState(true)
  const [empModal, setEmpModal]     = useState(null)
  const [empSearch, setEmpSearch]   = useState('')
  const [empDeleteConfirm, setEmpDeleteConfirm] = useState(null)
  const [empSaving, setEmpSaving]   = useState(false)

  // ── Admin ──
  const [admins, setAdmins]         = useState([])
  const [admLoading, setAdmLoading] = useState(true)
  const [admModal, setAdmModal]     = useState(null)
  const [admDeleteConfirm, setAdmDeleteConfirm] = useState(null)
  const [admSaving, setAdmSaving]   = useState(false)

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { loadAdmins() }, [])

  // ── Employee CRUD ─────────────────────────────────────────────────────────
  async function loadEmployees() {
    setEmpLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees((data || []).map(toRow))
    setEmpLoading(false)
  }

  async function handleEmpSave(data) {
    setEmpSaving(true)
    const payload = {
      name: data.name, nickname: data.nickname || null,
      department: data.department, weekly_hours: data.weeklyHours,
      pin: data.pin, iban: data.iban || null,
    }
    if (empModal.mode === 'add') {
      const { data: row, error } = await supabase.from('employees').insert(payload).select().single()
      if (error) { alert('Errore: ' + error.message); setEmpSaving(false); return }
      setEmployees(prev => [...prev, toRow(row)].sort((a,b) => a.name.localeCompare(b.name)))
    } else {
      const { error } = await supabase.from('employees').update(payload).eq('id', data.id)
      if (error) { alert('Errore: ' + error.message); setEmpSaving(false); return }
      setEmployees(prev => prev.map(e => e.id === data.id ? { ...data } : e))
    }
    setEmpSaving(false)
    setEmpModal(null)
  }

  async function handleEmpDelete(id) {
    await supabase.from('employees').delete().eq('id', id)
    setEmployees(prev => prev.filter(e => e.id !== id))
    setEmpDeleteConfirm(null)
  }

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.nickname || '').toLowerCase().includes(empSearch.toLowerCase())
  )

  // ── Admin CRUD ─────────────────────────────────────────────────────────────
  async function loadAdmins() {
    setAdmLoading(true)
    const { data } = await supabase.from('admins').select('id, name, username, role, department').order('name')
    setAdmins(data || [])
    setAdmLoading(false)
  }

  async function handleAdmSave(data) {
    setAdmSaving(true)
    const payload = {
      name: data.name, username: data.username,
      password: data.password, role: data.role,
      department: data.department || null,
    }
    if (admModal.mode === 'add') {
      const { data: row, error } = await supabase.from('admins').insert(payload).select().single()
      if (error) { alert('Errore: ' + error.message); setAdmSaving(false); return }
      setAdmins(prev => [...prev, row].sort((a,b) => a.name.localeCompare(b.name)))
    } else {
      const { error } = await supabase.from('admins').update(payload).eq('id', data.id)
      if (error) { alert('Errore: ' + error.message); setAdmSaving(false); return }
      setAdmins(prev => prev.map(a => a.id === data.id ? { ...a, ...data } : a))
    }
    setAdmSaving(false)
    setAdmModal(null)
  }

  async function handleAdmDelete(id) {
    await supabase.from('admins').delete().eq('id', id)
    setAdmins(prev => prev.filter(a => a.id !== id))
    setAdmDeleteConfirm(null)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Directory</h1>
          <p className="text-petrol-300 mt-1 text-sm">
            {tab === 'employees' ? `${employees.length} dipendenti` : `${admins.length} amministratori`}
          </p>
        </div>
        <button
          onClick={() => tab === 'employees' ? setEmpModal({ mode: 'add' }) : setAdmModal({ mode: 'add' })}
          className="bg-petrol-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-petrol-500 transition"
        >
          + {tab === 'employees' ? 'Aggiungi dipendente' : 'Aggiungi admin'}
        </button>
      </div>

      {/* Tab */}
      <div className="flex bg-petrol-950/60 rounded-xl p-1 gap-1 border border-white/10 w-fit mb-6">
        <button onClick={() => setTab('employees')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === 'employees' ? 'bg-petrol-600 text-white' : 'text-petrol-300 hover:text-white'}`}>
          Dipendenti
        </button>
        <button onClick={() => setTab('admins')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === 'admins' ? 'bg-petrol-600 text-white' : 'text-petrol-300 hover:text-white'}`}>
          Amministratori
        </button>
      </div>

      {/* ── TAB DIPENDENTI ─────────────────────────────────────────────────── */}
      {tab === 'employees' && (
        <>
          <input type="text" placeholder="Cerca dipendente..."
            value={empSearch} onChange={e => setEmpSearch(e.target.value)}
            className="mb-6 w-full max-w-xs bg-white/10 border border-white/20 text-white placeholder-petrol-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-petrol-400 transition" />

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {empLoading ? (
              <div className="text-center py-16 text-petrol-300 text-sm">Caricamento…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-petrol-50">
                    <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Nome</th>
                    <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Nickname</th>
                    <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Reparto</th>
                    <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Ore/sett.</th>
                    <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">PIN</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-petrol-50">
                  {filteredEmployees.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-14 text-petrol-300">
                      {employees.length === 0 ? 'Nessun dipendente — aggiungine uno!' : 'Nessun risultato'}
                    </td></tr>
                  )}
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-petrol-50 transition">
                      <td className="px-6 py-4 font-semibold text-petrol-900">{emp.name}</td>
                      <td className="px-6 py-4 text-petrol-500">
                        {emp.nickname || <span className="text-petrol-200 italic text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${DEPT_BADGE[emp.department] || 'bg-gray-100 text-gray-600'}`}>
                          {emp.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-petrol-700 font-medium">{emp.weeklyHours}h</td>
                      <td className="px-6 py-4 font-mono text-petrol-300 tracking-widest">••••</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-4 justify-end">
                          <button onClick={() => setEmpModal({ mode: 'edit', data: emp })}
                            className="text-petrol-500 hover:text-petrol-800 text-xs font-semibold transition">Modifica</button>
                          <button onClick={() => setEmpDeleteConfirm(emp.id)}
                            className="text-red-400 hover:text-red-600 text-xs font-semibold transition">Elimina</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── TAB AMMINISTRATORI ─────────────────────────────────────────────── */}
      {tab === 'admins' && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {admLoading ? (
            <div className="text-center py-16 text-petrol-300 text-sm">Caricamento…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-petrol-50">
                  <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Nome</th>
                  <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Username</th>
                  <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Ruolo</th>
                  <th className="text-left px-6 py-4 font-semibold text-petrol-700 text-xs uppercase tracking-wider">Reparto</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-petrol-50">
                {admins.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-14 text-petrol-300">Nessun amministratore</td></tr>
                )}
                {admins.map(adm => (
                  <tr key={adm.id} className="hover:bg-petrol-50 transition">
                    <td className="px-6 py-4 font-semibold text-petrol-900">{adm.name}</td>
                    <td className="px-6 py-4 font-mono text-petrol-500 text-xs">{adm.username}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[adm.role] || 'bg-gray-100'}`}>
                        {ROLE_LABEL[adm.role] || adm.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {adm.department
                        ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${DEPT_BADGE[adm.department]}`}>{adm.department}</span>
                        : <span className="text-petrol-200 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 justify-end">
                        <button onClick={() => setAdmModal({ mode: 'edit', data: adm })}
                          className="text-petrol-500 hover:text-petrol-800 text-xs font-semibold transition">Modifica</button>
                        <button onClick={() => setAdmDeleteConfirm(adm.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-semibold transition">Elimina</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals dipendenti */}
      {empModal && <EmployeeModal mode={empModal.mode} initial={empModal.data} saving={empSaving} onSave={handleEmpSave} onClose={() => setEmpModal(null)} />}

      {empDeleteConfirm && (
        <ConfirmDelete
          name={employees.find(e => e.id === empDeleteConfirm)?.name}
          onConfirm={() => handleEmpDelete(empDeleteConfirm)}
          onCancel={() => setEmpDeleteConfirm(null)}
        />
      )}

      {/* Modals admin */}
      {admModal && <AdminManageModal mode={admModal.mode} initial={admModal.data} saving={admSaving} onSave={handleAdmSave} onClose={() => setAdmModal(null)} />}

      {admDeleteConfirm && (
        <ConfirmDelete
          name={admins.find(a => a.id === admDeleteConfirm)?.name}
          onConfirm={() => handleAdmDelete(admDeleteConfirm)}
          onCancel={() => setAdmDeleteConfirm(null)}
        />
      )}
    </>
  )
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 flex flex-col gap-5">
        <h2 className="font-bold text-xl text-petrol-900">Conferma eliminazione</h2>
        <p className="text-petrol-500 text-sm leading-relaxed">
          Vuoi eliminare <span className="font-bold text-petrol-900">{name}</span>? Questa azione non può essere annullata.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border-2 border-petrol-100 rounded-xl py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
            Annulla
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition">
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}
