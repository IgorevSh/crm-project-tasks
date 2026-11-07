import { Badge } from '@mantine/core'
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from '../types/database'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge color={TASK_STATUS_COLORS[status]} variant="light">
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}
