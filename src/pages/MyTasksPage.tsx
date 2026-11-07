import { Anchor, Stack, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatTaskNumber, type Task } from '../types/database'

type Row = Task & {
  object?: { id: string; name: string } | null
}

export function MyTasksPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, object:construction_objects(id, name)')
      .eq('assignee_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      notifications.show({ color: 'red', message: error.message })
    } else {
      setTasks((data as Row[]) ?? [])
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Stack gap="md">
      <Title order={2}>Мои задачи</Title>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={100}>№</Table.Th>
            <Table.Th>Задача</Table.Th>
            <Table.Th>Объект</Table.Th>
            <Table.Th>Статус</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((task) => (
            <Table.Tr
              key={task.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <Table.Td>
                <Text size="sm" c="dimmed" ff="monospace">
                  {formatTaskNumber(task.task_number, task.id)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text fw={500}>{task.title}</Text>
              </Table.Td>
              <Table.Td>
                {task.object ? (
                  <Anchor
                    component={Link}
                    to={`/objects/${task.object.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.object.name}
                  </Anchor>
                ) : (
                  '—'
                )}
              </Table.Td>
              <Table.Td>
                <StatusBadge status={task.status} />
              </Table.Td>
            </Table.Tr>
          ))}
          {!loading && tasks.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" ta="center" py="lg">
                  Нет задач
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
