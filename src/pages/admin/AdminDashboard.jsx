import { useNavigate } from 'react-router-dom'

const sections = [
  { label: 'Directory',    desc: 'Gestisci anagrafica, PIN, ore contratto', to: '/admin/directory', icon: '👤' },
  { label: 'LOG presenze', desc: 'Visualizza e correggi timbrature',         to: '/admin/log',       icon: '📋' },
  { label: 'Turni',        desc: 'Pianifica turni sala e cucina',             to: '/admin/turni',     icon: '📅' },
  { label: 'Riepilogo',    desc: 'Ore settimanali e mensili per dipendente',  to: '/admin/riepilogo', icon: '📊' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <>
      <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-petrol-300 mb-10">Seleziona una sezione per iniziare</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        {sections.map(s => (
          <button
            key={s.label}
            onClick={() => navigate(s.to)}
            className="bg-white/10 hover:bg-white/15 border border-white/10 hover:border-petrol-400 text-left rounded-2xl p-7 transition group"
          >
            <span className="text-3xl mb-4 block">{s.icon}</span>
            <h2 className="font-bold text-white text-lg mb-1 group-hover:text-petrol-200 transition">{s.label}</h2>
            <p className="text-petrol-400 text-sm">{s.desc}</p>
          </button>
        ))}
      </div>
    </>
  )
}
