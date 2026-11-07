export type UserRole = 'manager' | 'executor' | (string & {})

export type TaskStatus =
  | 'new'
  | 'in_progress'
  | 'review'
  | 'accepted'
  | 'revision'

export interface Role {
  id: string
  code: string
  name: string
  description: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role_id: string
  role: string
  created_at: string
}

export interface ConstructionObject {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  task_number?: number | null
  title: string
  description: string
  object_id: string
  assignee_id: string
  author_id: string
  status: TaskStatus
  created_at: string
  updated_at: string
}

export function formatTaskNumber(
  taskNumber: number | null | undefined,
  fallbackId?: string,
) {
  if (taskNumber != null) {
    return `#${String(taskNumber).padStart(4, '0')}`
  }
  if (fallbackId) {
    return `#${fallbackId.slice(0, 4).toUpperCase()}`
  }
  return '#————'
}

export interface TaskStatusHistory {
  id: string
  task_id: string
  changed_by: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
}

export interface TaskWithRelations extends Task {
  object?: ConstructionObject | null
  assignee?: Profile | null
  author?: Profile | null
}

export interface HistoryWithActor extends TaskStatusHistory {
  actor?: Profile | null
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  revision: 'На доработке',
}

export const TASK_STATUS_COLORS: Record<
  TaskStatus,
  'gray' | 'blue' | 'yellow' | 'green' | 'orange'
> = {
  new: 'gray',
  in_progress: 'blue',
  review: 'yellow',
  accepted: 'green',
  revision: 'orange',
}

export type StatusAction = {
  to: TaskStatus
  label: string
  requiresComment?: boolean
  color?: string
}

export function getAvailableActions(
  status: TaskStatus,
  role: string,
  isAssignee: boolean,
): StatusAction[] {
  if (role === 'executor' && isAssignee) {
    if (status === 'new') {
      return [{ to: 'in_progress', label: 'Взять в работу', color: 'blue' }]
    }
    if (status === 'in_progress') {
      return [{ to: 'review', label: 'Отправить на проверку', color: 'yellow' }]
    }
    if (status === 'revision') {
      return [{ to: 'in_progress', label: 'Взять в работу', color: 'blue' }]
    }
  }

  if (role === 'manager' && status === 'review') {
    return [
      { to: 'accepted', label: 'Принять', color: 'green' },
      {
        to: 'revision',
        label: 'Вернуть на доработку',
        requiresComment: true,
        color: 'orange',
      },
    ]
  }

  return []
}
