import React, { useMemo, useState, useContext, useEffect } from 'react'
import MapLibreVectorMap, { MapContext } from '../components/map/MapLibreVectorMap'
import LogisticsLayer from '../components/map/layers/LogisticsLayer'
import type { FeatureCollection, Point } from 'geojson'

// generate production-like sample points clustered around a bbox

function makeSample(count = 1500): FeatureCollection<Point>{
  const features = new Array(count).fill(0).map((_, i)=>{
    // sample around Europe / Africa for nicer demo
    const lon = -8 + Math.random()*40 // -8..32
    const lat = 35 + (Math.random()-0.5)*20 // 25..45
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { id: i, name: `Agent ${i}`, info: `Status ${(Math.random()*100|0)}%` }
    }
  })
  return { type: 'FeatureCollection', features } as FeatureCollection<Point>
}

export default function MapDemo(){
  const data = useMemo(()=> makeSample(2500), [])
  const [showLogistics, setShowLogistics] = useState(true)

  // KPI component uses MapContext and reads rendered features to show quick stats
  function KPICards(){
    const { map } = useContext(MapContext)
    const [visible, setVisible] = useState(0)
    useEffect(()=>{
      if (!map) return
      const update = ()=>{
        try{
          const feats = map.queryRenderedFeatures({ layers: ['logistics-clusters','logistics-unclustered'] })
          setVisible(feats.length || 0)
        }catch(e){ setVisible(0) }
      }
      update()
      map.on('moveend', update)
      return ()=>{ map.off('moveend', update) }
    }, [map])
    return (
      <div className="p-2 space-y-2">
        <div className="bg-white/6 text-white px-3 py-2 rounded-xl backdrop-blur-md">Total points: <strong>{data.features.length}</strong></div>
        <div className="bg-white/6 text-white px-3 py-2 rounded-xl backdrop-blur-md">Visible rendered features: <strong>{visible}</strong></div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen">
      <MapLibreVectorMap initialMode="dark">
        <div className="absolute right-4 top-4 z-50 flex flex-col gap-3">
          <div className="bg-black/50 text-white p-2 rounded-xl shadow-lg">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLogistics} onChange={e=>setShowLogistics(e.target.checked)} />
              <span className="ml-1">Logistics Layer</span>
            </label>
          </div>
          <div className="p-2 rounded-xl">
            <KPICards />
          </div>
        </div>
        {showLogistics && <LogisticsLayer data={data} />}
      </MapLibreVectorMap>
    </div>
  )
}
