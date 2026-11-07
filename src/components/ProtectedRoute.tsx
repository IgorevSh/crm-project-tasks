import { Center, Loader, Text } from '@mantine/core'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <Center mih="100vh">
        <Text fw={600}>Профиль не найден</Text>
      </Center>
    )
  }

  return <Outlet />
}
