import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './routes/ProtectedRoute'

import SplashPage from './pages/SplashPage'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProjectSelectionPage from './pages/ProjectSelectionPage'
import ProjectDashboardPage from './pages/ProjectDashboardPage'
import DashboardPage from './pages/DashboardPage'
import FloorSelectionPage from './pages/FloorSelectionPage'
import UnitTypeSelectionPage from './pages/UnitTypeSelectionPage'
import LocationCardsPage from './pages/LocationCardsPage'
import WorkCardPage from './pages/WorkCardPage'
import InstallationChecklistPage from './pages/InstallationChecklistPage'
import PhotosPage from './pages/PhotosPage'
import QCInspectionPage from './pages/QCInspectionPage'
import PunchListPage from './pages/PunchListPage'
import TimelinePage from './pages/TimelinePage'
import NotesPage from './pages/NotesPage'
import UpdateStatusPage from './pages/UpdateStatusPage'
import OwnerDashboardPage from './pages/OwnerDashboardPage'
import KanbanBoardPage from './pages/KanbanBoardPage'
import MorePage from './pages/MorePage'
import ReportsPage from './pages/ReportsPage'
import FloorPlanPage from './pages/FloorPlanPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<SplashPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Forced password change is full-screen, outside the bottom-nav shell */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Project selection is full-screen, outside the bottom-nav shell */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectSelectionPage />
          </ProtectedRoute>
        }
      />

      {/* Everything below uses the bottom-nav shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/project" element={<ProjectDashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/floors" element={<FloorSelectionPage />} />
        <Route path="/unit-types" element={<UnitTypeSelectionPage />} />
        <Route path="/floor-plan" element={<FloorPlanPage />} />
        <Route path="/locations" element={<LocationCardsPage />} />
        <Route path="/locations/:locationId" element={<WorkCardPage />} />
        <Route path="/locations/:locationId/checklist" element={<InstallationChecklistPage />} />
        <Route path="/locations/:locationId/photos" element={<PhotosPage />} />
        <Route path="/locations/:locationId/qc" element={<QCInspectionPage />} />
        <Route path="/locations/:locationId/punch-list" element={<PunchListPage />} />
        <Route path="/locations/:locationId/timeline" element={<TimelinePage />} />
        <Route path="/locations/:locationId/notes" element={<NotesPage />} />
        <Route path="/locations/:locationId/status" element={<UpdateStatusPage />} />
        <Route path="/punch-list" element={<PunchListPage />} />
        <Route path="/more" element={<MorePage />} />

        {/* Management-only */}
        <Route
          path="/owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={['Project Manager', 'Owner']}>
              <OwnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kanban"
          element={
            <ProtectedRoute allowedRoles={['Project Manager', 'Owner', 'Foreman']}>
              <KanbanBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['Project Manager', 'Owner']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
