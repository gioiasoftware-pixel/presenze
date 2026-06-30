import { Navigate } from 'react-router-dom'
import { canAccess } from '../../lib/auth'

export default function ProtectedRoute({ section, children }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/admin" replace />
  if (section && !canAccess(section)) return <Navigate to="/admin/dashboard" replace />
  return children
}
