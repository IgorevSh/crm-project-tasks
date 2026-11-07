import {
  Anchor,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapAddressPicker } from '../components/MapAddressPicker'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  formatTaskNumber,
  type ConstructionObject,
  type Profile,
  type Task,
  type TaskStatus,
} from '../types/database'

type TaskRow = Task & { assignee?: Pick<Profile, 'full_name'> | null }

export function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [object, setObject] = useState<ConstructionObject | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [executors, setExecutors] = useState<Profile[]>([])
  const [taskOpened, taskModal] = useDisclosure(false)
  const [editOpened, editModal] = useDisclosure(false)
  const [saving, setSaving] = useState(false)

  const taskForm = useForm({
    initialValues: { title: '', description: '', assignee_id: '' },
    validate: {
      title: (v) => (v.trim() ? null : 'Укажите название'),
      assignee_id: (v) => (v ? null : 'Выберите исполнителя'),
    },
  })

  const objectForm = useForm({
    initialValues: {
      name: '',
      address: '',
      lat: null as number | null,
      lng: null as number | null,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Укажите название'),
      address: (v) => (v.trim() ? null : 'Укажите адрес'),
    },
  })

  const load = useCallback(async () => {
    if (!id) return

    const { data: obj, error: objErr } = await supabase
      .from('construction_objects')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (objErr) {
      notifications.show({ color: 'red', message: objErr.message })
      return
    }
    if (!obj) {
      notifications.show({ color: 'red', message: 'Объект не найден' })
      navigate('/')
      return
    }
    setObject(obj)
    objectForm.setValues({
      name: obj.name,
      address: obj.address,
      lat: obj.lat,
      lng: obj.lng,
    })

    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!assignee_id(full_name)')
      .eq('object_id', id)
      .order('created_at', { ascending: false })

    if (taskErr) {
      notifications.show({ color: 'red', message: taskErr.message })
    } else {
      setTasks((taskData as TaskRow[]) ?? [])
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isManager) return
    void supabase.rpc('list_executors').then(({ data, error }) => {
      if (error) {
        notifications.show({ color: 'red', message: error.message })
        return
      }
      setExecutors(data ?? [])
    })
  }, [isManager])

  const handleCreateTask = taskForm.onSubmit(async (values) => {
    if (!profile || !id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: values.title.trim(),
        description: values.description.trim(),
        object_id: id,
        assignee_id: values.assignee_id,
        author_id: profile.id,
        status: 'new' as TaskStatus,
      })
      if (error) throw error
      notifications.show({ color: 'green', message: 'Задача создана' })
      taskModal.close()
      taskForm.reset()
      await load()
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Ошибка создания',
      })
    } finally {
      setSaving(false)
    }
  })

  const handleSaveObject = objectForm.onSubmit(async (values) => {
    if (!object) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('construction_objects')
        .update({
          name: values.name.trim(),
          address: values.address.trim(),
          lat: values.lat,
          lng: values.lng,
        })
        .eq('id', object.id)
      if (error) throw error
      notifications.show({ color: 'green', message: 'Объект обновлён' })
      editModal.close()
      await load()
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Ошибка сохранения',
      })
    } finally {
      setSaving(false)
    }
  })

  const handleDeleteObject = async () => {
    if (!object) return
    if (!confirm(`Удалить объект «${object.name}» и все его задачи?`)) return
    const { error } = await supabase
      .from('construction_objects')
      .delete()
      .eq('id', object.id)
    if (error) {
      notifications.show({ color: 'red', message: error.message })
      return
    }
    notifications.show({ color: 'green', message: 'Объект удалён' })
    navigate('/')
  }

  if (!object) {
    return <Text c="dimmed">Загрузка…</Text>
  }

  return (
    <Stack gap="md" w="100%">
      <Anchor component={Link} to="/" size="sm">
        ← Объекты
      </Anchor>

      <Paper withBorder p="md" radius="md" w="100%">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Title order={2}>{object.name}</Title>
            {isManager && (
              <Group gap="xs">
                <Button
                  variant="light"
                  leftSection={<IconPencil size={16} />}
                  onClick={() => {
                    objectForm.setValues({
                      name: object.name,
                      address: object.address,
                      lat: object.lat,
                      lng: object.lng,
                    })
                    editModal.open()
                  }}
                >
                  Редактировать
                </Button>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => void handleDeleteObject()}
                >
                  Удалить
                </Button>
              </Group>
            )}
          </Group>
          <MapAddressPicker
            address={object.address}
            lat={object.lat}
            lng={object.lng}
            readOnly
            onChange={() => undefined}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md" w="100%">
        <Group justify="space-between" mb="md">
          <Title order={3}>Задачи</Title>
          {isManager && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                taskForm.reset()
                taskModal.open()
              }}
            >
              Новая задача
            </Button>
          )}
        </Group>

        <Stack gap="xs">
          {tasks.map((task) => (
            <UnstyledButton
              key={task.id}
              component={Link}
              to={`/tasks/${task.id}`}
              style={{
                display: 'block',
                border: '1px solid #e9ecef',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" c="dimmed" ff="monospace" style={{ flexShrink: 0 }}>
                      {formatTaskNumber(task.task_number, task.id)}
                    </Text>
                    <Text fw={600} truncate>
                      {task.title}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed" truncate>
                    {task.assignee?.full_name ?? '—'}
                  </Text>
                </Stack>
                <StatusBadge status={task.status} />
              </Group>
            </UnstyledButton>
          ))}
          {tasks.length === 0 && (
            <Text c="dimmed" ta="center" py="lg">
              Нет задач
            </Text>
          )}
        </Stack>
      </Paper>

      <Modal
        opened={taskOpened}
        onClose={taskModal.close}
        title="Новая задача"
        size="md"
        zIndex={4000}
      >
        <form onSubmit={handleCreateTask}>
          <Stack>
            <TextInput label="Объект" value={object.name} readOnly />
            <TextInput label="Название" {...taskForm.getInputProps('title')} />
            <Textarea
              label="Описание"
              minRows={3}
              {...taskForm.getInputProps('description')}
            />
            <Select
              label="Исполнитель"
              placeholder="Выберите"
              data={executors.map((e) => ({
                value: e.id,
                label: `${e.full_name} (${e.email})`,
              }))}
              searchable
              comboboxProps={{ withinPortal: true, zIndex: 5000 }}
              {...taskForm.getInputProps('assignee_id')}
            />
            <Button type="submit" loading={saving}>
              Создать
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={editOpened}
        onClose={editModal.close}
        title="Редактировать объект"
        size="lg"
        zIndex={4000}
      >
        <form onSubmit={handleSaveObject}>
          <Stack>
            <TextInput label="Название" {...objectForm.getInputProps('name')} />
            {editOpened && (
              <MapAddressPicker
                key={object.id}
                address={objectForm.values.address}
                lat={objectForm.values.lat}
                lng={objectForm.values.lng}
                onChange={(next) => {
                  objectForm.setValues({
                    ...objectForm.values,
                    address: next.address,
                    lat: next.lat,
                    lng: next.lng,
                  })
                  if (next.address.trim()) {
                    objectForm.clearFieldError('address')
                  }
                }}
              />
            )}
            <Button type="submit" loading={saving}>
              Сохранить
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
