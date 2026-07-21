import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

const DEPT_STYLE = {
  SALA:   'bg-petrol-100 text-petrol-700',
  CUCINA: 'bg-amber-100 text-amber-700',
}

function FileIcon({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-petrol-400`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
      <line x1="9" y1="11" x2="15" y2="11"/>
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3l-6 6"/>
    </svg>
  )
}

export default function EmployeeDocumentiPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const today    = new Date()

  const [employee, setEmployee]   = useState(null)
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(null) // 'contratto' | 'busta_paga' | null
  const [openingId, setOpeningId] = useState(null)
  const [bustaMese, setBustaMese] = useState(today.getMonth() + 1)
  const [bustaAnno, setBustaAnno] = useState(today.getFullYear())

  useEffect(() => {
    supabase.from('employees').select('id, name, nickname, department')
      .eq('id', id).single()
      .then(({ data }) => setEmployee(data))
  }, [id])

  async function loadDocs() {
    setLoading(true)
    const { data } = await supabase.from('employee_documents')
      .select('*').eq('employee_id', id)
      .order('year',  { ascending: false })
      .order('month', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  useEffect(() => { loadDocs() }, [id])

  async function uploadContratto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('contratto')
    try {
      const path = `${id}/contratto/contratto.pdf`
      const { error: err } = await supabase.storage
        .from('documenti dipendenti')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (err) throw err
      await supabase.from('employee_documents').delete().eq('employee_id', id).eq('type', 'contratto')
      await supabase.from('employee_documents').insert({
        employee_id: id, type: 'contratto', label: 'Contratto', storage_path: path,
      })
      await loadDocs()
    } catch (err) {
      alert('Errore upload: ' + err.message)
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  async function uploadBusta(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading('busta_paga')
    try {
      const path = `${id}/buste/${bustaAnno}-${String(bustaMese).padStart(2,'0')}.pdf`
      const { error: err } = await supabase.storage
        .from('documenti dipendenti')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (err) throw err
      const existing = docs.find(d => d.type === 'busta_paga' && d.month === bustaMese && d.year === bustaAnno)
      if (existing) await supabase.from('employee_documents').delete().eq('id', existing.id)
      await supabase.from('employee_documents').insert({
        employee_id: id, type: 'busta_paga',
        label: `${MONTHS_IT[bustaMese - 1]} ${bustaAnno}`,
        storage_path: path, month: bustaMese, year: bustaAnno,
      })
      await loadDocs()
    } catch (err) {
      alert('Errore upload: ' + err.message)
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  async function openDoc(doc) {
    setOpeningId(doc.id)
    try {
      const { data, error } = await supabase.storage
        .from('documenti dipendenti')
        .createSignedUrl(doc.storage_path, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      alert('Errore apertura: ' + err.message)
    } finally {
      setOpeningId(null)
    }
  }

  async function deleteDoc(doc) {
    if (!confirm(`Eliminare "${doc.label}"?`)) return
    await supabase.storage.from('documenti dipendenti').remove([doc.storage_path])
    await supabase.from('employee_documents').delete().eq('id', doc.id)
    await loadDocs()
  }

  const contratto = docs.find(d => d.type === 'contratto')
  const buste     = docs.filter(d => d.type === 'busta_paga')

  if (!employee) return null

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <button onClick={() => navigate('/admin/documenti')}
          className="text-petrol-400 hover:text-white transition text-sm font-semibold">
          ← Tutti i dipendenti
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DEPT_STYLE[employee.department] || 'bg-gray-100 text-gray-600'}`}>
            {employee.department}
          </span>
          <h1 className="text-2xl font-bold text-white">{employee.nickname || employee.name}</h1>
          {employee.nickname && <span className="text-petrol-400 text-sm">{employee.name}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-6 max-w-2xl">

        {/* ── Contratto ── */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-petrol-800 text-base">Contratto di lavoro</h2>
            <label className={`flex items-center gap-2 bg-petrol-700 hover:bg-petrol-600 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer transition select-none ${uploading === 'contratto' ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="8" y1="2" x2="8" y2="11"/><polyline points="4,6 8,2 12,6"/>
                <line x1="2" y1="14" x2="14" y2="14"/>
              </svg>
              {uploading === 'contratto' ? 'Caricamento…' : contratto ? 'Sostituisci PDF' : 'Carica PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={uploadContratto} />
            </label>
          </div>

          {loading ? (
            <p className="text-petrol-400 text-sm">Caricamento…</p>
          ) : contratto ? (
            <div className="flex items-center justify-between bg-petrol-50 rounded-xl px-4 py-3.5">
              <div className="flex items-center gap-3">
                <FileIcon className="w-9 h-9" />
                <div>
                  <p className="font-semibold text-petrol-800 text-sm">Contratto.pdf</p>
                  <p className="text-petrol-400 text-xs mt-0.5">
                    Caricato il {new Date(contratto.uploaded_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openDoc(contratto)} disabled={openingId === contratto.id}
                  className="flex items-center gap-1.5 text-petrol-600 hover:text-petrol-900 text-sm font-semibold transition disabled:opacity-40">
                  {openingId === contratto.id ? 'Apertura…' : 'Apri'} <ExternalIcon />
                </button>
                <button onClick={() => deleteDoc(contratto)}
                  className="text-petrol-300 hover:text-red-500 text-xl leading-none transition">×</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-petrol-100 rounded-xl">
              <p className="text-petrol-400 text-sm">Nessun contratto caricato</p>
              <p className="text-petrol-300 text-xs mt-1">Carica un PDF con il pulsante in alto</p>
            </div>
          )}
        </div>

        {/* ── Buste paga ── */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-petrol-800 text-base mb-5">Buste paga</h2>

          {/* Form upload */}
          <div className="flex items-end gap-3 mb-6 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-petrol-500 mb-1.5 uppercase tracking-wider">Mese</p>
              <select value={bustaMese} onChange={e => setBustaMese(Number(e.target.value))}
                className="border-2 border-petrol-100 rounded-xl px-3 py-2.5 text-sm text-petrol-800 focus:outline-none focus:border-petrol-400 transition">
                {MONTHS_IT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-petrol-500 mb-1.5 uppercase tracking-wider">Anno</p>
              <input type="number" value={bustaAnno} onChange={e => setBustaAnno(Number(e.target.value))}
                min="2020" max="2099"
                className="border-2 border-petrol-100 rounded-xl px-3 py-2.5 text-sm text-petrol-800 w-24 focus:outline-none focus:border-petrol-400 transition" />
            </div>
            <label className={`flex items-center gap-2 bg-petrol-700 hover:bg-petrol-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition select-none ${uploading === 'busta_paga' ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="8" y1="2" x2="8" y2="11"/><polyline points="4,6 8,2 12,6"/>
                <line x1="2" y1="14" x2="14" y2="14"/>
              </svg>
              {uploading === 'busta_paga' ? 'Caricamento…' : `Carica busta — ${MONTHS_IT[bustaMese - 1]} ${bustaAnno}`}
              <input type="file" accept="application/pdf" className="hidden" onChange={uploadBusta} />
            </label>
          </div>

          {/* Lista */}
          {loading ? (
            <p className="text-petrol-400 text-sm">Caricamento…</p>
          ) : buste.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-petrol-100 rounded-xl">
              <p className="text-petrol-400 text-sm">Nessuna busta paga caricata</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {buste.map(doc => (
                <div key={doc.id} className="flex items-center justify-between bg-petrol-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileIcon className="w-7 h-7" />
                    <div>
                      <p className="font-semibold text-petrol-800 text-sm">{doc.label}</p>
                      <p className="text-petrol-400 text-xs mt-0.5">
                        Caricato il {new Date(doc.uploaded_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => openDoc(doc)} disabled={openingId === doc.id}
                      className="flex items-center gap-1.5 text-petrol-600 hover:text-petrol-900 text-sm font-semibold transition disabled:opacity-40">
                      {openingId === doc.id ? 'Apertura…' : 'Apri'} <ExternalIcon />
                    </button>
                    <button onClick={() => deleteDoc(doc)}
                      className="text-petrol-300 hover:text-red-500 text-xl leading-none transition">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
