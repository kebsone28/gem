/*
  Supercluster worker.
  Expects Supercluster to be available (bundle it in build) or import via importScripts.
  Messages:
    {type: 'init', options}
    {type: 'load', points: GeoJSON.Feature[]}
    {type: 'getClusters', bbox: [minX,minY,maxX,maxY], zoom}
  Replies:
    {type: 'clusters', clusters}

  Note: include supercluster in your build pipeline for production.
*/

let supercluster = null

self.onmessage = (e) => {
  const msg = e.data
  if (msg.type === 'init'){
    try{
      // try to import global Supercluster if available
      if (!self.Supercluster && msg.importScriptUrl){
        importScripts(msg.importScriptUrl)
      }
      const SC = self.Supercluster || Supercluster
      supercluster = new SC(msg.options || {radius:60, maxZoom:16})
      self.postMessage({type:'ready'})
    }catch(err){
      self.postMessage({type:'error', error: String(err)})
    }
  }else if (msg.type === 'load'){
    if (!supercluster){ self.postMessage({type:'error', error:'not-initialized'}); return }
    try{
      supercluster.load(msg.points || [])
      self.postMessage({type:'loaded'})
    }catch(err){ self.postMessage({type:'error', error: String(err)}) }
  }else if (msg.type === 'getClusters'){
    if (!supercluster){ self.postMessage({type:'error', error:'not-initialized'}); return }
    try{
      const clusters = supercluster.getClusters(msg.bbox, msg.zoom)
      self.postMessage({type:'clusters', clusters})
    }catch(err){ self.postMessage({type:'error', error: String(err)}) }
  }
}
