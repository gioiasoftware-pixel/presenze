export default function StatusMessage({ type, msg }) {
  const styles = {
    ok:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
    err: 'bg-red-50 text-red-600 border border-red-200',
  }
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${styles[type] || styles.err}`}>
      {msg}
    </div>
  )
}
