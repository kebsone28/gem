import React, {useEffect, useRef, useState, createContext, useCallback, useMemo} from 'react'
import maplibregl, {Map} from 'maplibre-gl'
import {getStyleForMode} from './mapConfig'
import 'maplibre-gl/dist/maplibre-gl.css'

type Mode = 'light' | 'dark' | 'satellite' | 'hybrid' | 'terrain'

export type MapContextValue = {
  map: Map | null
  isStyleLoaded: () => boolean
}

export const MapContext = createContext<MapContextValue>({map: null, isStyleLoaded: ()=>false})

export default function MapLibreVectorMap({
  initialMode = 'dark',
  onMapReady,
  children
}: {
  initialMode?: Mode
  onMapReady?: (map: Map) => void
  children?: React.ReactNode
}){
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const mountedRef = useRef(false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [ready, setReady] = useState(false)

  const isStyleLoaded = useCallback(()=>{
    return Boolean(mapRef.current?.isStyleLoaded())
  }, [])

  useEffect(()=>{
    mountedRef.current = true
    return ()=>{ mountedRef.current = false }
  }, [])

  useEffect(()=>{
    if (!containerRef.current) return
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyleForMode(mode),
      center: [0,0],
      zoom: 2,
      pitch: 45,
      bearing: 0
    })

    // Controls
    map.addControl(new maplibregl.NavigationControl({visualizePitch: true}), 'top-right')

    const onLoad = () => {
      // mark ref and signal readiness
      mapRef.current = map
      setReady(true)
      try{ onMapReady?.(map) }catch(e){ console.error('onMapReady callback error', e) }
    }

    const onStyleData = ()=>{
      // when style changes, ensure consumers can re-register sources/layers safely
      try{ onMapReady?.(map) }catch(e){ console.error('onMapReady callback error', e) }
    }

    map.once('load', onLoad)
    map.on('styledata', onStyleData)

    // defensive error handling
    map.on('error', (e)=>console.warn('maplibre error', e))

    return ()=>{
      try{
        map.off('styledata', onStyleData)
        map.off('load', onLoad)
        map.remove()
      }catch(e){ /* ignore */ }
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // handle mode/style changes safely
  useEffect(()=>{
    const map = mapRef.current
    if (!map) return
    // if style not loaded yet, wait for load
    if (!map.isStyleLoaded()){
      const handler = ()=>{
        try{ map.setStyle(getStyleForMode(mode)) }catch(e){ console.error('setStyle error', e) }
        map.once('styledata', ()=>{ try{ onMapReady?.(map) }catch(e){console.error(e)} })
      }
      map.once('load', handler)
      return ()=>{ map.off('load', handler) }
    }
    try{
      map.setStyle(getStyleForMode(mode))
      map.once('styledata', ()=>{ try{ onMapReady?.(map) }catch(e){console.error(e)} })
    }catch(e){ console.error('Failed to set style', e) }
  }, [mode, onMapReady])

  const contextValue = useMemo<MapContextValue>(() => ({ map: mapRef.current, isStyleLoaded }), [isStyleLoaded, ready])

  return (
    <MapContext.Provider value={contextValue}>
      <div className="relative h-full w-full">
        <div ref={containerRef} className="h-full w-full" />
        <div className="absolute top-4 left-4 z-40 flex gap-2">
          <button onClick={()=>setMode('dark')} className="bg-white/5 text-white px-3 py-2 rounded-2xl">Dark</button>
          <button onClick={()=>setMode('light')} className="bg-white/5 text-white px-3 py-2 rounded-2xl">Light</button>
          <button onClick={()=>setMode('satellite')} className="bg-white/5 text-white px-3 py-2 rounded-2xl">Satellite</button>
        </div>
        {children}
      </div>
    </MapContext.Provider>
  )
}
