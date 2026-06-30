import { useState } from 'react'

const COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-gray-100 text-gray-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

const EMPTY = { name: '', pairs: [{ in: '', out: '' }], color: COLORS[0] }

function pairsLabel(pairs) {
  return pairs.map(p => `${p.in}–${p.out}`).join(' / ')
}

export default function ShiftTemplates({ templates, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)

  function startAdd() {
    setEditing({ id: null, ...EMPTY, pairs: [{ in: '', out: '' }] })
  }

  function startEdit(t) {
    setEditing({ ...t, pairs: t.pairs.map(p => ({ ...p })) })
  }

  function setField(field, value) {
    setEditing(prev => ({ ...prev, [field]: value }))
  }

  function setPairField(idx, field, value) {
    setEditing(prev => {
      const pairs = prev.pairs.map((p, i) => i === idx ? { ...p, [field]: value } : p)
      return { ...prev, pairs }
    })
  }

  function addPair() {
    setEditing(prev => ({ ...prev, pairs: [...prev.pairs, { in: '', out: '' }] }))
  }

  function removePair() {
    setEditing(prev => ({ ...prev, pairs: [prev.pairs[0]] }))
  }

  function saveTemplate() {
    if (!editing.name.trim()) return
    if (editing.pairs.some(p => !p.in || !p.out)) return
    onSave(editing)
    setEditing(null)
  }

  return (
    <div className="bg-white/10 border border-white/15 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-sm text-white">Turni prefabbricati</h2>
        <button
          onClick={startAdd}
          className="text-xs bg-petrol-600 text-white px-3 py-1.5 rounded-lg hover:bg-petrol-500 transition font-semibold"
        >
          + Nuovo
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-2 group">
            <div className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${t.color} shadow-sm`}>
              <div>{t.name}</div>
              <div className="opacity-60 font-mono text-[10px] mt-0.5">{pairsLabel(t.pairs)}</div>
            </div>
            <button onClick={() => startEdit(t)}
              className="text-petrol-400 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition">✎</button>
            <button onClick={() => onDelete(t.id)}
              className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-petrol-400 text-xs text-center py-2">Nessun turno prefabbricato</p>
        )}
      </div>

      <p className="text-petrol-400 text-xs leading-relaxed">
        Seleziona i prefab dal menu ☰ di ogni cella.
      </p>

      {editing && (
        <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-7 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-petrol-900">
                {!editing.id ? 'Nuovo turno' : 'Modifica turno'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-petrol-300 hover:text-petrol-700 text-2xl leading-none transition">×</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Es. Mattina"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">1° turno</label>
                <div className="flex gap-2">
                  <input type="time" value={editing.pairs[0].in}
                    onChange={e => setPairField(0, 'in', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500" />
                  <input type="time" value={editing.pairs[0].out}
                    onChange={e => setPairField(0, 'out', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500" />
                </div>
              </div>

              {editing.pairs.length >= 2 ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-gray-600">2° turno (spezzato)</label>
                    <button onClick={removePair} className="text-xs text-red-400 hover:text-red-600 font-semibold">Rimuovi</button>
                  </div>
                  <div className="flex gap-2">
                    <input type="time" value={editing.pairs[1].in}
                      onChange={e => setPairField(1, 'in', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500" />
                    <input type="time" value={editing.pairs[1].out}
                      onChange={e => setPairField(1, 'out', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-petrol-500" />
                  </div>
                </div>
              ) : (
                <button onClick={addPair}
                  className="text-xs text-petrol-500 hover:text-petrol-700 font-semibold text-left transition">
                  + Aggiungi 2° turno (spezzato)
                </button>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Colore</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setField('color', c)}
                      className={`w-7 h-7 rounded-full border-2 ${c.split(' ')[0]} ${editing.color === c ? 'border-gray-900' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditing(null)}
                className="flex-1 border-2 border-petrol-100 rounded-xl py-2.5 text-sm font-semibold text-petrol-700 hover:bg-petrol-50 transition">
                Annulla
              </button>
              <button onClick={saveTemplate}
                className="flex-1 bg-petrol-700 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-petrol-600 transition">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
