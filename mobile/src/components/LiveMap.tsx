import React, { useRef, useEffect } from 'react'
import { WebView } from 'react-native-webview'
import { View, StyleSheet } from 'react-native'

interface Props {
  points: { lat: number; lng: number }[]
  plannedCoords?: [number, number][]
  style?: object
}

function buildHtml(points: { lat: number; lng: number }[], plannedCoords?: [number, number][]) {
  const lat = points.length ? points[points.length - 1].lat : plannedCoords?.length ? plannedCoords[Math.floor(plannedCoords.length / 2)][0] : 46.5
  const lng = points.length ? points[points.length - 1].lng : plannedCoords?.length ? plannedCoords[Math.floor(plannedCoords.length / 2)][1] : 2.5
  const zoom = points.length ? 16 : plannedCoords?.length ? 13 : 6
  const liveCoords = JSON.stringify(points.map(p => [p.lat, p.lng]))
  const plannedJson = JSON.stringify(plannedCoords ?? [])

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { height: 100%; width: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // Planned route — light gray dashed
  var plannedCoords = ${plannedJson};
  var plannedLine = null;
  if (plannedCoords.length > 1) {
    plannedLine = L.polyline(plannedCoords, { color: '#94a3b8', weight: 3, dashArray: '8,6', opacity: 0.7 }).addTo(map);
    map.fitBounds(plannedLine.getBounds(), { padding: [20, 20] });
  }

  // Live GPS track — blue solid
  var liveCoords = ${liveCoords};
  var liveLine = L.polyline(liveCoords, { color: '#2563eb', weight: 4 }).addTo(map);

  // Current position marker
  var posMarker = null;
  function updatePos(coords) {
    if (!coords.length) return;
    var last = coords[coords.length - 1];
    if (posMarker) map.removeLayer(posMarker);
    posMarker = L.circleMarker(last, { radius: 9, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }).addTo(map);
    map.setView(last, Math.max(map.getZoom(), 15));
  }
  updatePos(liveCoords);

  window.updateMap = function(newLiveCoords) {
    liveLine.setLatLngs(newLiveCoords);
    updatePos(newLiveCoords);
  };
</script>
</body>
</html>`
}

export default function LiveMap({ points, plannedCoords, style }: Props) {
  const webRef = useRef<WebView>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (!webRef.current || points.length === prevCountRef.current) return
    prevCountRef.current = points.length
    const coords = JSON.stringify(points.map(p => [p.lat, p.lng]))
    webRef.current.injectJavaScript(`window.updateMap(${coords}); true;`)
  }, [points])

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: buildHtml(points, plannedCoords) }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
})
