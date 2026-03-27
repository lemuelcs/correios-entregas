#!/bin/sh
set -eu

OSM_REGION_URL="${OSM_REGION_URL:-https://download.geofabrik.de/south-america/brazil/centro-oeste-latest.osm.pbf}"
OSRM_DATASET="${OSRM_DATASET:-centro-oeste-latest}"
OSRM_PROFILE="${OSRM_PROFILE:-/opt/car.lua}"
OSRM_BASE="/data/${OSRM_DATASET}"
OSM_PBF="${OSRM_BASE}.osm.pbf"

mkdir -p /data

if [ ! -f "${OSM_PBF}" ]; then
  echo "Downloading OSM extract: ${OSM_REGION_URL}"
  curl -L --fail --output "${OSM_PBF}" "${OSM_REGION_URL}"
else
  echo "OSM extract already present: ${OSM_PBF}"
fi

if [ ! -f "${OSRM_BASE}.osrm.partition" ] || [ ! -f "${OSRM_BASE}.osrm.cells" ] || [ ! -f "${OSRM_BASE}.osrm.mldgr" ]; then
  echo "Preparing OSRM graph using profile ${OSRM_PROFILE}"
  osrm-extract -p "${OSRM_PROFILE}" "${OSM_PBF}"
  osrm-partition "${OSRM_BASE}.osrm"
  osrm-customize "${OSRM_BASE}.osrm"
else
  echo "OSRM graph already prepared"
fi

exec osrm-routed --algorithm mld "${OSRM_BASE}.osrm"

