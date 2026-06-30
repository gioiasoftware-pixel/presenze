import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const SPECIAL_STYLE = {
  OFF:      'bg-gray-100 text-gray-500',
  FERIE:    'bg-green-100 text-green-700',
  MALATTIA: 'bg-red-100 text-red-600',
  PERMESSO: 'bg-yellow-100 text-yellow-700',
}

const SPECIALS = ['OFF', 'FERIE', 'MALATTIA', 'PERMESSO']

export default function TurniCell({ cell, templates, onChange }) {
  const isSpecial = typeof cell === 'string'
  const pairs = cell && !isSpecial ? (cell.pairs || []) : []
  const hasShift2 = pairs.length >= 2

  function setPairField(idx, field, value) {
    const next = [...pairs]
    if (!next[idx]) next[idx] = { in: '', out: '' }
    next[idx] = { ...next[idx], [field]: value }
    onChange({ pairs: next })
  }

  function addShift2() {
    const base = pairs[0] || { in: '', out: '' }
    onChange({ pairs: [base, { in: '', out: '' }] })
  }

  function removeShift2() {
    onChange({ pairs: [pairs[0] || { in: '', out: '' }] })
  }

  return (
    <div className="px-2 py-1.5 min-h-[48px] group/cell">

      {/* STATO SPECIALE */}
      {isSpecial && (
        <div className="flex items-center justify-between gap-1">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${SPECIAL_STYLE[cell]}`}>
            {cell}
          </span>
          <CellMenu templates={templates} cell={cell} onApply={v => onChange(v)} />
        </div>
      )}

      {/* TURNO */}
      {!isSpecial && (
        <div className="flex flex-col gap-0.5">

          {/* Riga 1° turno */}
          <div className="flex items-center gap-1">
            <TimeInput value={pairs[0]?.in  ?? ''} onChange={v => setPairField(0, 'in',  v)} />
            <span className="text-petrol-200 text-[10px] leading-none">–</span>
            <TimeInput value={pairs[0]?.out ?? ''} onChange={v => setPairField(0, 'out', v)} />
            <CellMenu templates={templates} cell={cell} onApply={v => onChange(v)} />
          </div>

          {/* Riga 2° turno */}
          {hasShift2 && (
            <div className="flex items-center gap-1">
              <TimeInput value={pairs[1]?.in  ?? ''} onChange={v => setPairField(1, 'in',  v)} />
              <span className="text-petrol-200 text-[10px] leading-none">–</span>
              <TimeInput value={pairs[1]?.out ?? ''} onChange={v => setPairField(1, 'out', v)} />
              <button
                onClick={removeShift2}
                title="Rimuovi 2° turno"
                className="shrink-0 text-petrol-200 hover:text-red-400 text-[10px] px-0.5 transition opacity-0 group-hover/cell:opacity-100"
              >✕</button>
            </div>
          )}

          {/* Aggiungi 2° turno */}
          {!hasShift2 && (
            <button
              onClick={addShift2}
              className="text-petrol-200 hover:text-petrol-500 text-[10px] text-left transition opacity-0 group-hover/cell:opacity-100 leading-none py-0.5"
            >
              + 2° turno
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* Input orario compatto */
function TimeInput({ value, onChange }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-[76px] shrink-0 border border-petrol-100 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-petrol-400 bg-white text-petrol-800"
    />
  )
}

/* Dropdown hamburger via portal */
function CellMenu({ templates, cell, onApply }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setDropPos({
      top:  rect.bottom + window.scrollY + 4,
      left: rect.right  + window.scrollX,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!e.target.closest('[data-cell-menu]')) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const hasContent = cell !== null && cell !== undefined

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title="Opzioni cella"
        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs transition hover:bg-petrol-100 ${open ? 'text-petrol-600 bg-petrol-100' : 'text-petrol-300'}`}
      >
        ☰
      </button>

      {open && createPortal(
        <div
          data-cell-menu=""
          style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
          className="bg-white rounded-xl shadow-xl border border-petrol-100 py-1.5 min-w-[170px]"
        >
          {/* Prefab */}
          {templates.length > 0 && (
            <>
              <p className="text-xs font-bold text-petrol-400 uppercase tracking-wider px-3 pt-1 pb-1.5">
                Turni prefabbricati
              </p>
              {templates.map(t => (
                <button
                  key={t.id}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => { onApply({ pairs: t.pairs }); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-petrol-50 flex justify-between items-center gap-3 transition"
                >
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${t.color}`}>{t.name}</span>
                  <span className="text-petrol-400 font-mono text-right leading-tight">
                    {t.pairs.map(p => `${p.in}–${p.out}`).join('\n')}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Speciali */}
          <div className={templates.length > 0 ? 'border-t border-petrol-50 mt-1 pt-1' : ''}>
            <p className="text-xs font-bold text-petrol-400 uppercase tracking-wider px-3 pt-1 pb-1.5">
              Stato speciale
            </p>
            <div className="grid grid-cols-2 gap-1 px-2 pb-1">
              {SPECIALS.map(s => (
                <button
                  key={s}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => { onApply(s); setOpen(false) }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition hover:opacity-80 ${SPECIAL_STYLE[s]}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Cancella */}
          {hasContent && (
            <div className="border-t border-petrol-50 mt-1 pt-1">
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { onApply(null); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 font-semibold transition"
              >
                Cancella cella
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
