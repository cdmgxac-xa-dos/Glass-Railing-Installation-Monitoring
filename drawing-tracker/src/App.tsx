import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { RoleHomePage } from '@/pages/RoleHomePage'
import { DrawingRegisterPage } from '@/pages/DrawingRegisterPage'
import { DrawingDetailPage } from '@/pages/DrawingDetailPage'
import { UsersPage } from '@/pages/UsersPage'
import { ClientDashboardPage } from '@/pages/ClientDashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/client" element={<ClientDashboardPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleHomePage />} />
          <Route path="/drawings/:id" element={<DrawingDetailPage />} />

          <Route element={<ProtectedRoute allow={['xa_admin']} />}>
            <Route path="/register" element={<DrawingRegisterPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
