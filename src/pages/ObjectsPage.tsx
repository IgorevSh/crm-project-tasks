import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconChevronRight, IconPlus } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapAddressPicker } from '../components/MapAddressPicker'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { ConstructionObject } from '../types/database'

type ObjectRow = ConstructionObject & {
  tasks?: { count: number }[] | null
}

function tasksLabel(count: number) {
  const n10 = count % 10
  const n100 = count % 100
  if (n10 === 1 && n100 !== 11) return `${count} задача`
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${count} задачи`
  return `${count} задач`
}

export function ObjectsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = profile?.role === 'manager'
  const [objects, setObjects] = useState<ObjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opened, { open, close }] = useDisclosure(false)
  const [saving, setSaving] = useState(false)

  const form = useForm({
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
    setLoading(true)
    const { data, error } = await supabase
      .from('construction_objects')
      .select('*, tasks(count)')
      .order('created_at', { ascending: false })

    if (error) {
      notifications.show({ color: 'red', message: error.message })
    } else {
      setObjects((data as ObjectRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    form.setValues({ name: '', address: '', lat: null, lng: null })
    open()
  }

  const handleSave = form.onSubmit(async (values) => {
    if (!profile) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('construction_objects')
        .insert({
          name: values.name.trim(),
          address: values.address.trim(),
          lat: values.lat,
          lng: values.lng,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (error) throw error
      notifications.show({ color: 'green', message: 'Объект создан' })
      close()
      if (data?.id) {
        navigate(`/objects/${data.id}`)
      } else {
        await load()
      }
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Ошибка сохранения',
      })
    } finally {
      setSaving(false)
    }
  })

  return (
    <Stack gap="md" w="100%">
      <Group justify="space-between">
        <Title order={2}>Объекты</Title>
        {isManager && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Новый объект
          </Button>
        )}
      </Group>

      <Stack gap="sm" w="100%">
        {objects.map((obj) => {
          const taskCount = obj.tasks?.[0]?.count ?? 0
          return (
            <UnstyledButton
              key={obj.id}
              onClick={() => navigate(`/objects/${obj.id}`)}
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              <Paper withBorder p="md" radius="md" w="100%">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="sm">
                      <Text fw={600} truncate>
                        {obj.name}
                      </Text>
                      <Badge variant="light" color="gray">
                        {tasksLabel(taskCount)}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" truncate>
                      {obj.address}
                    </Text>
                  </Stack>
                  <IconChevronRight size={18} color="gray" />
                </Group>
              </Paper>
            </UnstyledButton>
          )
        })}
        {!loading && objects.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Нет объектов
          </Text>
        )}
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title="Новый объект"
        size="lg"
        zIndex={4000}
      >
        <form onSubmit={handleSave}>
          <Stack>
            <TextInput label="Название" {...form.getInputProps('name')} />
            {opened && (
              <MapAddressPicker
                key="new"
                address={form.values.address}
                lat={form.values.lat}
                lng={form.values.lng}
                onChange={(next) => {
                  form.setValues({
                    ...form.values,
                    address: next.address,
                    lat: next.lat,
                    lng: next.lng,
                  })
                  if (next.address.trim()) {
                    form.clearFieldError('address')
                  }
                }}
              />
            )}
            <Button type="submit" loading={saving}>
              Создать
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}
