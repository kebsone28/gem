# setup_osrm.ps1
$DataDir = Join-Path -Path $PWD.Path -ChildPath "osrm_data"
if (-Not (Test-Path -Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir
}

Write-Host "Downloading OSM map data for Senegal..."
$PbfFile = Join-Path -Path $DataDir -ChildPath "senegal-latest.osm.pbf"

if (-Not (Test-Path -Path $PbfFile)) {
    Invoke-WebRequest -Uri "https://download.geofabrik.de/africa/senegal-latest.osm.pbf" -OutFile $PbfFile
}

Write-Host "Pulling OSRM backend image..."
docker pull osrm/osrm-backend

# Extract
Write-Host "Extracting street network..."
docker run --rm -t -v "${DataDir}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/senegal-latest.osm.pbf

# Partition
Write-Host "Partitioning network..."
docker run --rm -t -v "${DataDir}:/data" osrm/osrm-backend osrm-partition /data/senegal-latest.osrm

# Customize
Write-Host "Customizing routing..."
docker run --rm -t -v "${DataDir}:/data" osrm/osrm-backend osrm-customize /data/senegal-latest.osrm

# Run Daemon
Write-Host "Starting OSRM routing server on port 5000..."
# Check if a container on port 5000 is running and stop it
$existingId = docker ps -q --filter "publish=5000-5000"
if ($existingId) {
    Write-Host "Stopping existing container..."
    docker stop $existingId
    docker rm $existingId
}

docker run -d --name osrm-senegal -p 5000:5000 -v "${DataDir}:/data" osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 100000 /data/senegal-latest.osrm

Write-Host "OSRM setup complete and running!"
