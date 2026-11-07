import {
  Anchor,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  TASK_STATUS_LABELS,
  formatTaskNumber,
  getAvailableActions,
  type HistoryWithActor,
  type Profile,
  type Task,
  type TaskStatus,
} from '../types/database'

dayjs.locale('ru')

type TaskDetail = Task & {
  object?: { id: string; name: string; address: string } | null
  assignee?: Profile | null
  author?: Profile | null
}

function MetaItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4}>
        {label}
      </Text>
      <div>{children}</div>
    </Stack>
  )
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [history, setHistory] = useState<HistoryWithActor[]>([])
  const [executors, setExecutors] = useState<Profile[]>([])
  const [editOpen, editHandlers] = useDisclosure(false)
  const [commentOpen, commentHandlers] = useDisclosure(false)
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const editForm = useForm({
    initialValues: {
      title: '',
      description: '',
      assignee_id: '',
    },
  })

  const load = useCallback(async () => {
    if (!id) return

    const { data, error } = await supabase
      .from('tasks')
      .select(
        `
        *,
        object:construction_objects(id, name, address),
        assignee:profiles!assignee_id(*),
        author:profiles!author_id(*)
      `,
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      notifications.show({ color: 'red', message: error.message })
      return
    }
    if (!data) {
      notifications.show({ color: 'red', message: 'Задача не найдена' })
      navigate('/')
      return
    }

    setTask(data as TaskDetail)

    const { data: hist, error: histErr } = await supabase
      .from('task_status_history')
      .select('*, actor:profiles!changed_by(*)')
      .eq('task_id', id)
      .order('created_at', { ascending: true })

    if (histErr) {
      notifications.show({ color: 'red', message: histErr.message })
    } else {
      setHistory((hist as HistoryWithActor[]) ?? [])
    }
  }, [id, navigate])

  useEffect(() => {
    if (!task) return
    editForm.setValues({
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id,
    })
  }, [task?.id, task?.title, task?.description, task?.assignee_id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isManager) return
    void supabase.rpc('list_executors').then(({ data, error }) => {
      if (!error) setExecutors(data ?? [])
    })
  }, [isManager])

  const actions = useMemo(() => {
    if (!task || !profile) return []
    return getAvailableActions(
      task.status,
      profile.role,
      task.assignee_id === profile.id,
    )
  }, [task, profile])

  const runStatusChange = async (to: TaskStatus, commentText?: string) => {
    if (!id) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('change_task_status', {
        p_task_id: id,
        p_new_status: to,
        p_comment: commentText ?? null,
      })
      if (error) throw error
      notifications.show({
        color: 'green',
        message: `Статус: ${TASK_STATUS_LABELS[to]}`,
      })
      commentHandlers.close()
      setComment('')
      setPendingStatus(null)
      await load()
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Ошибка смены статуса',
      })
    } finally {
      setBusy(false)
    }
  }

  const onActionClick = (to: TaskStatus, requiresComment?: boolean) => {
    if (requiresComment) {
      setPendingStatus(to)
      setComment('')
      commentHandlers.open()
      return
    }
    void runStatusChange(to)
  }

  const saveEdit = editForm.onSubmit(async (values) => {
    if (!task) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: values.title.trim(),
          description: values.description.trim(),
          assignee_id: values.assignee_id,
        })
        .eq('id', task.id)
      if (error) throw error
      notifications.show({ color: 'green', message: 'Задача обновлена' })
      editHandlers.close()
      await load()
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Ошибка сохранения',
      })
    } finally {
      setBusy(false)
    }
  })

  const handleDelete = async () => {
    if (!task) return
    if (!confirm(`Удалить задачу «${task.title}»?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      notifications.show({ color: 'red', message: error.message })
      return
    }
    notifications.show({ color: 'green', message: 'Задача удалена' })
    navigate(task.object_id ? `/objects/${task.object_id}` : '/')
  }

  if (!task) {
    return <Text c="dimmed">Загрузка…</Text>
  }

  return (
    <Stack gap="md" w="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <div style={{ minWidth: 0 }}>
          {task.object ? (
            <Anchor component={Link} to={`/objects/${task.object.id}`} size="sm">
              ← {task.object.name}
            </Anchor>
          ) : (
            <Anchor component={Link} to="/" size="sm">
              ← Назад
            </Anchor>
          )}
        </div>
        <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
          <Text size="sm" fw={600} c="dimmed">
            задача {formatTaskNumber(task.task_number, task.id)}
          </Text>
          <Text size="xs" c="dimmed">
            {dayjs(task.created_at).format('D MMMM YYYY, HH:mm')}
          </Text>
        </Stack>
      </Group>

      <Paper withBorder p="lg" radius="md" w="100%">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md">
            <Group gap="sm" align="center" wrap="wrap" style={{ minWidth: 0 }}>
              <Title order={2} style={{ lineHeight: 1.25 }}>
                {task.title}
              </Title>
              <StatusBadge status={task.status} />
            </Group>
            {isManager && (
              <Group gap="xs" wrap="nowrap">
                <Button variant="light" onClick={editHandlers.open}>
                  Редактировать
                </Button>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => void handleDelete()}
                >
                  Удалить
                </Button>
              </Group>
            )}
          </Group>

          {task.description ? (
            <Text style={{ whiteSpace: 'pre-wrap' }}>{task.description}</Text>
          ) : (
            <Text c="dimmed">Без описания</Text>
          )}

          <Divider />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            <MetaItem label="Объект">
              {task.object ? (
                <Anchor
                  component={Link}
                  to={`/objects/${task.object.id}`}
                  fw={500}
                >
                  {task.object.name}
                </Anchor>
              ) : (
                <Text>—</Text>
              )}
            </MetaItem>
            <MetaItem label="Исполнитель">
              <Text fw={500}>{task.assignee?.full_name ?? '—'}</Text>
            </MetaItem>
            <MetaItem label="Автор">
              <Text fw={500}>{task.author?.full_name ?? '—'}</Text>
            </MetaItem>
          </SimpleGrid>

          {actions.length > 0 && (
            <>
              <Divider />
              <Group>
                {actions.map((action) => (
                  <Button
                    key={action.to}
                    color={action.color}
                    loading={busy}
                    onClick={() =>
                      onActionClick(action.to, action.requiresComment)
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </Group>
            </>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md" w="100%">
        <Title order={4} mb="md">
          История статусов
        </Title>
        {history.length === 0 ? (
          <Text c="dimmed">Нет записей</Text>
        ) : (
          <Timeline active={history.length - 1} bulletSize={20} lineWidth={2}>
            {history.map((item) => (
              <Timeline.Item
                key={item.id}
                title={
                  item.from_status
                    ? `${TASK_STATUS_LABELS[item.from_status]} → ${TASK_STATUS_LABELS[item.to_status]}`
                    : `Создана · ${TASK_STATUS_LABELS[item.to_status]}`
                }
              >
                <Text size="sm" c="dimmed">
                  {item.actor?.full_name ?? '—'} ·{' '}
                  {dayjs(item.created_at).format('D MMM YYYY, HH:mm')}
                </Text>
                {item.comment && (
                  <Text size="sm" mt={4}>
                    {item.comment}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Paper>

      <Modal
        opened={editOpen}
        onClose={editHandlers.close}
        title="Редактировать задачу"
        zIndex={4000}
      >
        <form onSubmit={saveEdit}>
          <Stack>
            <TextInput label="Название" {...editForm.getInputProps('title')} />
            <Textarea
              label="Описание"
              minRows={3}
              {...editForm.getInputProps('description')}
            />
            <Select
              label="Исполнитель"
              data={executors.map((e) => ({
                value: e.id,
                label: `${e.full_name} (${e.email})`,
              }))}
              searchable
              comboboxProps={{ withinPortal: true, zIndex: 5000 }}
              {...editForm.getInputProps('assignee_id')}
            />
            <Button type="submit" loading={busy}>
              Сохранить
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={commentOpen}
        onClose={commentHandlers.close}
        title="Комментарий к доработке"
        zIndex={4000}
      >
        <Stack>
          <Textarea
            label="Комментарий"
            minRows={3}
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
          />
          <Button
            color="orange"
            loading={busy}
            disabled={!comment.trim()}
            onClick={() => {
              if (pendingStatus) void runStatusChange(pendingStatus, comment)
            }}
          >
            Вернуть на доработку
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
