import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'

export function PermissionGate({ module, action = 'view', children, fallback = null }: {
  module: string; action?: string; children: ReactNode; fallback?: ReactNode
}) {
  const { can } = usePermission()
  return <>{can(module, action) ? children : fallback}</>
}
