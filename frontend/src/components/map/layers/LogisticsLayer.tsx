import { useContext, useEffect, useRef } from 'react'
import { Map, Popup } from 'maplibre-gl'
import { useCluster } from '../../../services/cluster/useCluster'
import { MapContext } from '../MapLibreVectorMap'

type Props = { id?: string; data?: GeoJSON.FeatureCollection }

export default function LogisticsLayer({ id = 'logistics', data }: Props){
  const { map, isStyleLoaded } = useContext(MapContext)
  const { ready, clusters, load, getClusters, getLeaves, getClusterExpansionZoom } = useCluster()
  const popupRef = useRef<Popup | null>(null)
  const hoveredId = useRef<string | null>(null)

  // register sources & layers safely and idempotently
  useEffect(()=>{
    if (!map) return
    if (!isStyleLoaded()) return

    // add source if missing
    if (!map.getSource(id)){
      map.addSource(id, { type: 'geojson', data: data ?? { type: 'FeatureCollection', features: [] } })
    }

    // cluster layer (visual groups) - circle
    if (!map.getLayer(id+'-clusters')){
      map.addLayer({
        id: id+'-clusters',
        type: 'circle',
        source: id,
        paint: {
          'circle-radius': ['case', ['has', 'point_count'], ['interpolate', ['linear'], ['get', 'point_count'], 1, 12, 100, 40], 6],
          'circle-color': ['case', ['has', 'point_count'], '#ff7a59', '#06b6d4'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }

    // cluster count symbol
    if (!map.getLayer(id+'-count')){
      map.addLayer({
        id: id+'-count',
        type: 'symbol',
        source: id,
        layout: { 'text-field': ['to-string', ['coalesce', ['get', 'point_count'], ['get', 'id'] ]], 'text-size': 12 },
        paint: { 'text-color': '#fff' }
      })
    }

    // unclustered points
    if (!map.getLayer(id+'-unclustered')){
      map.addLayer({
        id: id+'-unclustered',
        type: 'circle',
        source: id,
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': 6, 'circle-color': '#06b6d4', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
      })
    }

    return ()=>{
      try{ if (map.getLayer(id+'-unclustered')) map.removeLayer(id+'-unclustered') }catch(e){}
      try{ if (map.getLayer(id+'-count')) map.removeLayer(id+'-count') }catch(e){}
      try{ if (map.getLayer(id+'-clusters')) map.removeLayer(id+'-clusters') }catch(e){}
      try{ if (map.getSource(id)) map.removeSource(id) }catch(e){}
    }
  }, [map, isStyleLoaded, id])

  // load points into worker when ready
  useEffect(()=>{
    if (!ready) return
    if (!data) return
    const pts = data.features.map(f=>({ type: 'Feature', geometry: f.geometry, properties: f.properties || {} }))
    load(pts)
  }, [ready, data, load])

  // request clusters on moveend
  useEffect(()=>{
    if (!map) return
    const onMove = async ()=>{
      if (!map) return
      const b = map.getBounds()
      const bbox:[number,number,number,number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      const z = Math.round(map.getZoom())
      try{
        await getClusters(bbox, z)
      }catch(e){ }
    }
    map.on('moveend', onMove)
    return ()=>{ map.off('moveend', onMove) }
  }, [map, getClusters])

  // apply clusters -> source.setData
  useEffect(()=>{
    if (!map) return
    if (!clusters) return
    const fc = { type: 'FeatureCollection', features: clusters as any[] }
    try{ const src = map.getSource(id) as any; if (src) src.setData(fc) }catch(e){ console.warn('setData failed', e) }
  }, [clusters, map, id])

  // interactions: hover tooltip and click-to-zoom cluster expansion
  useEffect(()=>{
    if (!map) return
    // hover
    const onMove = (e:any)=>{
      const features = map.queryRenderedFeatures(e.point, { layers: [id+'-unclustered', id+'-clusters'] })
      if (features.length === 0){
        hoveredId.current = null
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
        map.getCanvas().style.cursor = ''
        return
      }
      const f = features[0]
      map.getCanvas().style.cursor = 'pointer'
      // show premium glassmorphism tooltip
      const coords = (f.geometry as any).coordinates.slice()
      const props = f.properties || {}
      const html = `<div style="min-width:140px;padding:8px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#fff;font-size:13px">${props.name || props.id || props.label || 'Point'}<br/><small style=\"opacity:.8\">${props.info || ''}</small></div>`
      if (!popupRef.current){
        popupRef.current = new Popup({ closeButton: false, closeOnClick: false })
      }
      popupRef.current.setLngLat(coords).setHTML(html).addTo(map)
    }

    const onClick = async (e:any)=>{
      const features = map.queryRenderedFeatures(e.point, { layers: [id+'-clusters', id+'-unclustered'] })
      if (!features.length) return
      const f = features[0]
      const props = f.properties || {}
      const coords = (f.geometry as any).coordinates.slice()
      // cluster detection: Supercluster returns 'cluster: true' and 'cluster_id' or 'cluster_id' prop
      const isCluster = !!props.cluster || !!props.cluster_id || !!props.point_count
      if (isCluster){
        const clusterId = props.cluster_id ?? props.clusterId ?? props.cluster_id ?? props.clusterId ?? props.cluster_id
        // request expansion zoom and leaves (sample)
        try{
          const expZoom = await getClusterExpansionZoom(Number(clusterId))
          const leaves = await getLeaves(Number(clusterId), 100)
          // compute bounds from leaves
          if (leaves && leaves.length){
            let minX=180, minY=90, maxX=-180, maxY=-90
            for (const lf of leaves){
              const c = (lf.geometry as any).coordinates
              if (!c) continue
              const x = c[0], y = c[1]
              if (x < minX) minX = x
              if (y < minY) minY = y
              if (x > maxX) maxX = x
              if (y > maxY) maxY = y
            }
            // small padding if single point
            if (minX === maxX && minY === maxY){
              const pad = 0.01
              minX -= pad; minY -= pad; maxX += pad; maxY += pad
            }
            const bounds:[[number,number],[number,number]] = [[minX, minY], [maxX, maxY]]
            map.fitBounds(bounds, { padding: 80, duration: 700 })

            // preview leaves: create temp source/layer
            const previewId = id + '-preview'
            try{ if (map.getLayer(previewId+'-layer')) map.removeLayer(previewId+'-layer') }catch(e){}
            try{ if (map.getSource(previewId)) map.removeSource(previewId) }catch(e){}
            map.addSource(previewId, { type: 'geojson', data: { type: 'FeatureCollection', features: leaves } })
            map.addLayer({ id: previewId+'-layer', type: 'circle', source: previewId, paint: { 'circle-radius': 8, 'circle-color': '#ffd166', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1, 'circle-opacity': 0.95 } })
            // remove preview after a delay
            setTimeout(()=>{
              try{ if (map.getLayer(previewId+'-layer')) map.removeLayer(previewId+'-layer') }catch(e){}
              try{ if (map.getSource(previewId)) map.removeSource(previewId) }catch(e){}
            }, 4000)
          }

          // show cluster summary popup
          const summaryHtml = `<div style=\"min-width:200px;padding:10px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.7);color:#fff\">Cluster: <strong>${props.point_count||props.count||''}</strong><br/><small>zoom target: ${expZoom ?? 'auto'}</small></div>`
          new Popup({ offset: 12 }).setLngLat(coords).setHTML(summaryHtml).addTo(map)
        }catch(err){
          console.warn('Cluster expansion failed', err)
        }
      }else{
        // open popup with details for single feature
        const html = `<div style="min-width:180px;padding:10px;border-radius:12px;backdrop-filter:blur(6px);background:rgba(0,0,0,0.6);color:#fff">${props.name || props.id || 'Feature'}<div style=\"opacity:.8;font-size:12px\">${props.info||''}</div></div>`
        new Popup({ offset: 12 }).setLngLat(coords).setHTML(html).addTo(map)
      }
    }

    map.on('mousemove', onMove)
    map.on('click', onClick)
    return ()=>{
      map.off('mousemove', onMove)
      map.off('click', onClick)
      if (popupRef.current){ popupRef.current.remove(); popupRef.current = null }
    }
  }, [map, id, getLeaves, getClusterExpansionZoom])

  return null
}
