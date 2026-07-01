import { Routes, Route, Navigate } from 'react-router-dom'
import EmployeePage from './pages/employee/EmployeePage'
import DipendenteLoginPage from './pages/employee/DipendenteLoginPage'
import DipendenteDashboard from './pages/employee/DipendenteDashboard'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import DirectoryPage from './pages/admin/DirectoryPage'
import TurniPage from './pages/admin/TurniPage'
import LogPage from './pages/admin/LogPage'
import RiepilogoPage from './pages/admin/RiepilogoPage'
import EmployeeRiepilogoPage from './pages/admin/EmployeeRiepilogoPage'
import ProtectedRoute from './components/shared/ProtectedRoute'

function AdminArea({ section, children }) {
  return (
    <ProtectedRoute section={section}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EmployeePage />} />
      <Route path="/dipendente" element={<DipendenteLoginPage />} />
      <Route path="/dipendente/:id" element={<DipendenteDashboard />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard"         element={<AdminArea section="dashboard"><AdminDashboard /></AdminArea>} />
      <Route path="/admin/directory"         element={<AdminArea section="directory"><DirectoryPage /></AdminArea>} />
      <Route path="/admin/turni"             element={<AdminArea section="turni"><TurniPage /></AdminArea>} />
      <Route path="/admin/log"               element={<AdminArea section="log"><LogPage /></AdminArea>} />
      <Route path="/admin/riepilogo"         element={<AdminArea section="riepilogo"><RiepilogoPage /></AdminArea>} />
      <Route path="/admin/riepilogo/:id"     element={<AdminArea section="riepilogo"><EmployeeRiepilogoPage /></AdminArea>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
