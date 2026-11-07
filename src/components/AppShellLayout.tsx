import { AppShell, Burger, Button, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBuildingWarehouse,
  IconChecklist,
  IconLogout,
} from '@tabler/icons-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AppShellLayout() {
  const [opened, { toggle }] = useDisclosure()
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const isManager = profile?.role === 'manager'

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">
              СтройCRM
            </Text>
          </Group>
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              {profile?.full_name}
            </Text>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconLogout size={16} />}
              onClick={() => void signOut()}
            >
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavLink
          component={Link}
          to="/"
          label="Объекты"
          leftSection={<IconBuildingWarehouse size={18} />}
          active={location.pathname === '/' || location.pathname.startsWith('/objects')}
          onClick={() => opened && toggle()}
        />
        {!isManager && (
          <NavLink
            component={Link}
            to="/my-tasks"
            label="Мои задачи"
            leftSection={<IconChecklist size={18} />}
            active={location.pathname.startsWith('/my-tasks')}
            onClick={() => opened && toggle()}
          />
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
