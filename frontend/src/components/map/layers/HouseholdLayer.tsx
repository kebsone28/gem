import React, { useContext, useEffect, useRef, useState } from 'react'
import { Map, Popup } from 'maplibre-gl'
import { MapContext } from '../MapLibreVectorMap'
import useHouseholdSync from '../../../services/households/useHouseholdSync'
import { useCluster } from '../../../services/cluster/useCluster'

type Props = { id?: string }

export default function HouseholdLayer({ id = 'households' }: Props){
  const { map, isStyleLoaded } = useContext(MapContext)
  const apiBase = import.meta.env.VITE_API_URL || ''
  const sync = useHouseholdSync({ apiBase, pageSize: 1000 })
  const { ready, clusters, load, getClusters, getLeaves, getClusterExpansionZoom } = useCluster()
  const [snapshot, setSnapshot] = useState<GeoJSON.FeatureCollection | null>(null)
  const popupRef = useRef<Popup | null>(null)

  // subscribe to local DB updates
  useEffect(()=>{
    const unsub = sync.subscribe(async ()=>{
      const s = await sync.getSnapshot()
      setSnapshot(s)
      // load into worker
      if (ready && s && s.features.length) load(s.features)
    })
    // initial snapshot
    ;(async ()=>{ const s = await sync.getSnapshot(); setSnapshot(s); if (ready && s.features.length) load(s.features) })()
    return ()=>{ unsub() }
  }, [sync, ready, load])

  // register sources/layers idempotently
  useEffect(()=>{
    if (!map) return
    if (!isStyleLoaded()) return
    if (!map.getSource(id)){
      map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer(id+'-clusters')){
      map.addLayer({ id: id+'-clusters', type: 'circle', source: id, paint: { 'circle-radius': ['case', ['has','point_count'], ['interpolate',['linear'], ['get','point_count'], 1,10,100,36],6], 'circle-color': ['case',['has','point_count'],'#ff7a59','#22c55e'], 'circle-stroke-color':'#fff','circle-stroke-width':1 } })
    }
    if (!map.getLayer(id+'-unclustered')){
      map.addLayer({ id: id+'-unclustered', type: 'circle', source: id, filter: ['!',['has','point_count']], paint: { 'circle-radius':6, 'circle-color':'#22c55e', 'circle-stroke-color':'#fff', 'circle-stroke-width':1 } })
    }
    if (!map.getLayer(id+'-count')){
      map.addLayer({ id: id+'-count', type: 'symbol', source: id, layout: { 'text-field': ['to-string',['coalesce',['get','point_count'], ['get','id'] ]], 'text-size': 12 }, paint: { 'text-color':'#fff' } })
    }
    return ()=>{
      try{ if (map.getLayer(id+'-count')) map.removeLayer(id+'-count') }catch(e){}
      try{ if (map.getLayer(id+'-unclustered')) map.removeLayer(id+'-unclustered') }catch(e){}
      try{ if (map.getLayer(id+'-clusters')) map.removeLayer(id+'-clusters') }catch(e){}
      try{ if (map.getSource(id)) map.removeSource(id) }catch(e){}
    }
  }, [map, isStyleLoaded, id])

  // update source with clusters from worker
  useEffect(()=>{
    if (!map) return
    if (!clusters) return
    const fc = { type: 'FeatureCollection', features: clusters as any[] }
    try{ const src = map.getSource(id) as any; if (src) src.setData(fc) }catch(e){ console.warn('household setData failed', e) }
  }, [clusters, map, id])

  // request clusters on moveend
  useEffect(()=>{
    if (!map) return
    const onMove = async ()=>{
      const b = map.getBounds()
      const bbox:[number,number,number,number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      const z = Math.round(map.getZoom())
      try{ await getClusters(bbox, z) }catch(e){ }
    }
    map.on('moveend', onMove)
    return ()=>{ map.off('moveend', onMove) }
  }, [map, getClusters])

  // interactions: hover and cluster expansion using getLeaves + fitBounds
  useEffect(()=>{
    if (!map) return
    const onMove = (e:any)=>{
      const feats = map.queryRenderedFeatures(e.point, { layers: [id+'-unclustered', id+'-clusters'] })
      if (!feats.length){ if (popupRef.current){ popupRef.current.remove(); popupRef.current = null } map.getCanvas().style.cursor = ''; return }
      const f = feats[0]
      map.getCanvas().style.cursor = 'pointer'
      const coords = (f.geometry as any).coordinates.slice()
      const props = f.properties || {}
      const html = `<div style="min-width:140px;padding:8px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.6);color:#fff;font-size:13px">${props.name||props.id||'Household'}<br/><small style=\"opacity:.85\">${props.status||''}</small></div>`
      if (!popupRef.current) popupRef.current = new Popup({ closeButton:false, closeOnClick:false })
      popupRef.current.setLngLat(coords).setHTML(html).addTo(map)
    }

    const onClick = async (e:any)=>{
      const feats = map.queryRenderedFeatures(e.point, { layers: [id+'-clusters', id+'-unclustered'] })
      if (!feats.length) return
      const f = feats[0]
      const props = f.properties || {}
      const coords = (f.geometry as any).coordinates.slice()
      const isCluster = !!props.cluster || !!props.cluster_id || !!props.point_count
      if (isCluster){
        const clusterId = Number(props.cluster_id ?? props.clusterId ?? props.cluster_id)
        try{
          const leaves = await getLeaves(clusterId, 200)
          if (leaves && leaves.length){
            let minX=180, minY=90, maxX=-180, maxY=-90
            for (const lf of leaves){ const c = (lf.geometry as any).coordinates; if (!c) continue; const x=c[0], y=c[1]; if (x<minX) minX=x; if (y<minY) minY=y; if (x>maxX) maxX=x; if (y>maxY) maxY=y }
            if (minX===maxX && minY===maxY){ const pad=0.01; minX-=pad; minY-=pad; maxX+=pad; maxY+=pad }
            map.fitBounds([[minX,minY],[maxX,maxY]], { padding: 80, duration: 700 })
            // preview
            const previewId = id + '-preview'
            try{ if (map.getLayer(previewId+'-layer')) map.removeLayer(previewId+'-layer') }catch(e){}
            try{ if (map.getSource(previewId)) map.removeSource(previewId) }catch(e){}
            map.addSource(previewId, { type: 'geojson', data: { type: 'FeatureCollection', features: leaves } })
            map.addLayer({ id: previewId+'-layer', type: 'circle', source: previewId, paint: { 'circle-radius':7, 'circle-color':'#ffd166', 'circle-stroke-color':'#fff', 'circle-stroke-width':1 } })
            setTimeout(()=>{ try{ if (map.getLayer(previewId+'-layer')) map.removeLayer(previewId+'-layer') }catch(e){} try{ if (map.getSource(previewId)) map.removeSource(previewId) }catch(e){} }, 4000)
          }
          const summaryHtml = `<div style=\"min-width:200px;padding:10px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.75);color:#fff\">Cluster: <strong>${props.point_count||props.count||''}</strong></div>`
          new Popup({ offset:12 }).setLngLat(coords).setHTML(summaryHtml).addTo(map)
        }catch(err){ console.warn('household cluster expand', err) }
      }else{
        const html = `<div style=\"min-width:180px;padding:10px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.6);color:#fff\">${props.name||props.id||'Household'}<div style=\"opacity:.85;font-size:12px\">${props.info||''}</div></div>`
        new Popup({ offset:12 }).setLngLat(coords).setHTML(html).addTo(map)
      }
    }

    map.on('mousemove', onMove)
    map.on('click', onClick)
    return ()=>{ map.off('mousemove', onMove); map.off('click', onClick); if (popupRef.current){ popupRef.current.remove(); popupRef.current = null } }
  }, [map, id, getLeaves])

  return null
}
