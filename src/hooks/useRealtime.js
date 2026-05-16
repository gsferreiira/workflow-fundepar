// src/hooks/useRealtime.js
// Hook fino sobre supabase.channel() para escutar mudanças em uma tabela.
//
// Uso:
//   useRealtime('asset_movements', (payload) => {
//     // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
//     // payload.new / payload.old: linha
//     refetch()
//   })
//
// O canal é criado no mount e destruído no unmount. Quando a tab fica em
// background o Supabase mantém a conexão WebSocket viva — não precisa pausar.
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

export function useRealtime(table, callback, { event = '*', enabled = true } = {}) {
  // ref mantém o callback atualizado sem precisar derrubar o canal a cada render
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled || !table) return undefined

    // Nome do canal precisa ser único; sufixo aleatório evita colisão entre instâncias
    const channelName = `rt-${table}-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table },
        (payload) => {
          try {
            cbRef.current?.(payload)
          } catch (err) {
            console.warn(`useRealtime(${table}) callback error:`, err)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, enabled])
}
