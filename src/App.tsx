import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShellLayout } from './components/AppShellLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { ObjectDetailPage } from './pages/ObjectDetailPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'

function ExecutorOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  if (profile?.role !== 'executor') {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShellLayout />}>
          <Route index element={<ObjectsPage />} />
          <Route path="objects/:id" element={<ObjectDetailPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route
            path="my-tasks"
            element={
              <ExecutorOnly>
                <MyTasksPage />
              </ExecutorOnly>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
