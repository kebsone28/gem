const express = require('express')
const path = require('path')
const fs = require('fs')

// Simple static tile server for development. If you have actual .pbf tiles,
// place them under backend/pmtiles-server/data/{z}/{x}/{y}.pbf

const app = express()
const PORT = process.env.PORT || 4000

app.get('/tiles/:z/:x/:y.pbf', (req, res)=>{
  const {z,x,y} = req.params
  const file = path.join(__dirname, 'data', z, x, `${y}.pbf`)
  if (fs.existsSync(file)){
    res.setHeader('Content-Type', 'application/x-protobuf')
    res.sendFile(file)
    return
  }
  res.status(404).send('tile not found')
})

app.use('/', express.static(path.join(__dirname, 'static')))

app.listen(PORT, ()=> console.log(`PMTiles dev server listening on ${PORT}`))
