import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { session, profile, loading, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Некорректный email'),
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
    },
  })

  if (!loading && session && profile) {
    return <Navigate to="/" replace />
  }

  return (
    <Stack
      mih="100vh"
      align="center"
      justify="center"
      px="md"
      style={{
        background:
          'linear-gradient(160deg, #e8eef5 0%, #f7f4ef 45%, #dfe8df 100%)',
      }}
    >
      <Paper shadow="md" p="xl" radius="md" w="100%" maw={420} withBorder>
        <Stack gap="md">
          <div>
            <Title order={2}>СтройCRM</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Вход для сотрудников
            </Text>
          </div>

          {error && (
            <Alert color="red" title="Ошибка">
              {error}
            </Alert>
          )}

          <form
            onSubmit={form.onSubmit(async (values) => {
              setError(null)
              setSubmitting(true)
              try {
                await signIn(values.email.trim(), values.password)
              } catch (e) {
                const message =
                  e instanceof Error
                    ? e.message
                    : e &&
                        typeof e === 'object' &&
                        'message' in e &&
                        typeof (e as { message: unknown }).message === 'string'
                      ? (e as { message: string }).message
                      : 'Ошибка входа'
                setError(message)
                console.error('Login failed:', e)
              } finally {
                setSubmitting(false)
              }
            })}
          >
            <Stack gap="sm">
              <TextInput
                label="Email"
                placeholder="you@company.ru"
                autoComplete="email"
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Пароль"
                autoComplete="current-password"
                {...form.getInputProps('password')}
              />
              <Button type="submit" loading={submitting} fullWidth mt="xs">
                Войти
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  )
}
