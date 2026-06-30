import { useState, useEffect } from 'react'

const KEYS = ['1','2','3','4','5','6','7','8','9','del','0','ok']

export default function PinModal({ name, action, onConfirm, onSuccess, onCancel }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (loading) return
      if (e.key >= '0' && e.key <= '9') pressKey(e.key)
      if (e.key === 'Backspace') pressKey('del')
      if (e.key === 'Enter' && pin.length === 4) submit(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin, loading])

  function pressKey(k) {
    if (k === 'del') { setPin(p => p.slice(0, -1)); setError('') }
    else if (pin.length < 4) { setPin(p => p + k); setError('') }
  }

  async function submit(currentPin) {
    if (currentPin.length !== 4 || loading) return
    setLoading(true)
    const result = await onConfirm(currentPin)
    setLoading(false)
    if (result.ok) {
      onSuccess(result.time)
    } else {
      setPin('')
      setError(result.error || 'PIN errato')
      setShake(true)
      setTimeout(() => setShake(false), 400)
    }
  }

  const actionLabel = action === 'ENTRATA' ? 'Entrata' : 'Uscita'

  return (
    <div className="fixed inset-0 bg-petrol-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-xl text-petrol-900">Inserisci PIN</h2>
            <p className="text-sm text-petrol-400 mt-0.5">{name} — {actionLabel}</p>
          </div>
          <button onClick={onCancel} className="text-petrol-300 hover:text-petrol-700 text-2xl leading-none transition">×</button>
        </div>

        {/* Dots */}
        <div className={`flex justify-center gap-5 py-2 ${shake ? 'animate-shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 border-petrol-700 transition-all duration-150 ${i < pin.length ? 'bg-petrol-700 scale-110' : 'bg-transparent'}`}
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center -mt-3 font-medium">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map(k => {
            if (k === 'del') return (
              <button key={k} onClick={() => pressKey('del')} disabled={loading}
                className="bg-red-50 text-red-500 border border-red-100 rounded-2xl py-4 text-xl font-semibold hover:bg-red-100 active:scale-95 transition disabled:opacity-50">
                ⌫
              </button>
            )
            if (k === 'ok') return (
              <button key={k} onClick={() => submit(pin)} disabled={pin.length !== 4 || loading}
                className="bg-petrol-700 text-white rounded-2xl py-4 text-sm font-bold hover:bg-petrol-600 active:scale-95 transition disabled:opacity-30">
                {loading ? '…' : 'OK'}
              </button>
            )
            return (
              <button key={k} onClick={() => pressKey(k)} disabled={loading}
                className="bg-petrol-50 text-petrol-900 rounded-2xl py-4 text-xl font-semibold hover:bg-petrol-100 active:scale-95 transition disabled:opacity-50">
                {k}
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
