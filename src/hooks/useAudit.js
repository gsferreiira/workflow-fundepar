import { useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export function useAudit() {
  const { user } = useAuth()

  const log = useCallback(
    async (action, tableName, recordId, details = null) => {
      if (!user) return
      try {
        const { error } = await supabase.from('audit_logs').insert([
          {
            actor_id: user.id,
            actor_name: user.full_name || user.email || null,
            table_name: tableName,
            record_id: recordId != null ? String(recordId) : null,
            action,
            details,
          },
        ])
        if (error) {
          console.warn(`Audit.log falhou (${action} ${tableName}):`, error.message)
        }
      } catch (err) {
        console.warn(`Audit.log exceção (${action} ${tableName}):`, err)
      }
    },
    [user],
  )

  const created = useCallback(
    (tableName, recordId, details) => log('create', tableName, recordId, details),
    [log],
  )
  const updated = useCallback(
    (tableName, recordId, details) => log('update', tableName, recordId, details),
    [log],
  )
  const deleted = useCallback(
    (tableName, recordId, details) => log('delete', tableName, recordId, details),
    [log],
  )
  const restored = useCallback(
    (tableName, recordId, details) => log('restore', tableName, recordId, details),
    [log],
  )

  return { log, created, updated, deleted, restored }
}
