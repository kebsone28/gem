import { useEffect, useRef, useState, useCallback } from 'react'
import type { FeatureCollection } from 'geojson'
import { householdDb } from './db'
import type { HouseholdEntry } from './db'

type SyncStatus = 'idle'|'syncing'|'connected'|'error'|'offline'

export function useHouseholdSync(opts?: {
  apiBase?: string
  pageSize?: number
  wsUrl?: string
  useWebSocket?: boolean
}){
  const apiBase = opts?.apiBase || ''
  const pageSize = opts?.pageSize || 1000
  const wsUrl = opts?.wsUrl
  const useWebSocket = !!opts?.useWebSocket

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const subscribers = useRef(new Set<() => void>())
  const socketRef = useRef<WebSocket | EventSource | null>(null)
  const retryRef = useRef({ attempts: 0 })

  const notify = useCallback(()=>{ subscribers.current.forEach(fn=>fn()) }, [])

  // read cached data fast (offline-first)
  const readAllFromDb = useCallback(async (): Promise<FeatureCollection> => {
    const all = await householdDb.households.toArray()
    return {
      type: 'FeatureCollection',
      features: all
        .filter(h => !!h.geometry)
        .map(h=>({ type: 'Feature' as const, geometry: h.geometry!, properties: { ...h.properties, id: h.id, last_modified: h.last_modified } }))
    }
  }, [])

  // write/merge entry with last_modified conflict resolution
  const upsert = useCallback(async (entry: HouseholdEntry)=>{
    try{
      const existing = await householdDb.households.get(entry.id)
      if (!existing || (entry.last_modified >= existing.last_modified)){
        await householdDb.households.put(entry)
        notify()
      }
    }catch(e){ console.warn('household upsert failed', e) }
  }, [notify])

  const remove = useCallback(async (id: string)=>{
    try{ await householdDb.households.delete(id); notify() }catch(e){ console.warn('household delete failed', e) }
  }, [notify])

  // simple paginated bootstrap using page param; backend should support limit&page
  const bootstrap = useCallback(async ()=>{
    setStatus('syncing')
    setError(null)
    try{
      let page = 0; let fetched = 0
      do{
        const url = `${apiBase}/api/households?limit=${pageSize}&page=${page}`
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error(`bootstrap failed ${res.status}`)
        const json = await res.json()
        const features: GeoJSON.Feature[] = json.features || json
        fetched = features.length
        for (const f of features){
          const id = (f.properties && (f.properties.id || f.properties._id)) || f.id || String(Math.random())
          const lm = (f.properties && (f.properties.last_modified || f.properties.updated_at)) ? Date.parse(f.properties.last_modified || f.properties.updated_at) : Date.now()
          await householdDb.households.put({ id, geometry: f.geometry || null, properties: f.properties || {}, last_modified: lm })
        }
        page += 1
      }while(fetched === pageSize)
      setStatus('connected')
      notify()
    }catch(err:any){
      setError(String(err))
      setStatus('error')
    }
  }, [apiBase, pageSize, notify])

  // SSE or WebSocket subscribe
  const connectRealtime = useCallback(()=>{
    if (!apiBase && !wsUrl) return
    setStatus('syncing')
    setError(null)
    const connect = ()=>{
      try{
        if (useWebSocket && wsUrl){
          const ws = new WebSocket(wsUrl)
          socketRef.current = ws
          ws.onopen = ()=>{ retryRef.current.attempts = 0; setStatus('connected') }
          ws.onmessage = async (ev)=>{
            try{ const msg = JSON.parse(ev.data); handleRealtime(msg) }catch(e){ console.warn('ws parse', e) }
          }
          ws.onclose = ()=>{ attemptReconnect() }
          ws.onerror = (e)=>{ console.warn('ws err', e); ws.close() }
        }else{
          const s = new EventSource(`${apiBase}/api/households/stream`)
          socketRef.current = s
          s.onopen = ()=>{ retryRef.current.attempts = 0; setStatus('connected') }
          s.onmessage = async (ev:any)=>{ try{ const msg = JSON.parse(ev.data); handleRealtime(msg) }catch(e){ console.warn('sse parse', e) } }
          s.onerror = (e:any)=>{ console.warn('sse err', e); attemptReconnect() }
        }
      }catch(e){ console.warn('realtime connect failed', e); attemptReconnect() }
    }

    const attemptReconnect = ()=>{
      retryRef.current.attempts += 1
      const t = Math.min(30000, 1000 * Math.pow(2, retryRef.current.attempts))
      setStatus('error')
      setTimeout(()=>{ connect() }, t)
    }

    const handleRealtime = async (msg:any)=>{
      // expect { action: 'upsert'|'delete', data: feature }
      if (!msg) return
      const action = msg.action || msg.type
      const f = msg.data || msg.feature
      if (!f) return
      const id = (f.properties && (f.properties.id || f.properties._id)) || f.id
      const lm = (f.properties && (f.properties.last_modified || f.properties.updated_at)) ? Date.parse(f.properties.last_modified || f.properties.updated_at) : Date.now()
      if (action === 'delete' || action === 'removed'){
        await remove(String(id))
      }else{
        await upsert({ id: String(id), geometry: f.geometry || null, properties: f.properties || {}, last_modified: lm })
      }
    }

    connect()
  }, [apiBase, wsUrl, useWebSocket, upsert, remove])

  useEffect(()=>{
    const onOnline = ()=> setOnline(true)
    const onOffline = ()=> setOnline(false)
    try{ window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline) }catch(e){}
    return ()=>{ try{ window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }catch(e){} }
  }, [])

  // public subscribe to DB changes
  const subscribe = useCallback((fn: ()=>void)=>{ subscribers.current.add(fn); return ()=>subscribers.current.delete(fn) }, [])

  const start = useCallback(async ()=>{
    // initial read from DB for offline-first
    setStatus('syncing')
    try{
      await readAllFromDb()
      notify()
      // then bootstrap from server
      await bootstrap()
      // finally start realtime
      connectRealtime()
    }catch(e:any){ setError(String(e)); setStatus('error') }
  }, [readAllFromDb, bootstrap, connectRealtime, notify])

  const stop = useCallback(()=>{
    try{ if (socketRef.current instanceof EventSource) (socketRef.current as EventSource).close(); if (socketRef.current instanceof WebSocket) (socketRef.current as WebSocket).close() }catch(e){}
    socketRef.current = null
    setStatus('idle')
  }, [])

  useEffect(()=>{ start(); return ()=>{ stop() } }, [])

  return {
    status,
    error,
    online,
    start,
    stop,
    subscribe,
    readAllFromDb,
    upsert,
    remove,
    // helper to get current snapshot of households
    getSnapshot: readAllFromDb
  }
}

export default useHouseholdSync
