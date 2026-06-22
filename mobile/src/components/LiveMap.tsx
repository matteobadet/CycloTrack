import React, { useRef, useEffect, useMemo } from 'react'
import { WebView } from 'react-native-webview'
import { View, StyleSheet } from 'react-native'

interface Props {
  points: { lat: number; lng: number }[]
  plannedCoords?: [number, number][]
  style?: object
}

function buildInitialHtml() {
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
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([46.5, 2.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  var plannedLine = null;
  var liveLine = L.polyline([], { color: '#2563eb', weight: 4 }).addTo(map);
  var posMarker = null;
  var firstPoint = true;

  function updatePos(coords) {
    if (!coords.length) return;
    var last = coords[coords.length - 1];
    if (posMarker) map.removeLayer(posMarker);
    posMarker = L.circleMarker(last, { radius: 9, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }).addTo(map);
    if (firstPoint) {
      map.setView(last, 16);
      firstPoint = false;
    } else {
      map.panTo(last, { animate: true, duration: 0.5 });
    }
  }

  window.updateMap = function(newLiveCoords) {
    liveLine.setLatLngs(newLiveCoords);
    updatePos(newLiveCoords);
  };

  window.setPlannedRoute = function(coords) {
    if (plannedLine) { map.removeLayer(plannedLine); plannedLine = null; }
    if (coords.length > 1) {
      plannedLine = L.polyline(coords, { color: '#94a3b8', weight: 3, dashArray: '8,6', opacity: 0.7 }).addTo(map);
      if (firstPoint) {
        map.fitBounds(plannedLine.getBounds(), { padding: [20, 20] });
      }
    }
  };
</script>
</body>
</html>`
}

export default function LiveMap({ points, plannedCoords, style }: Props) {
  const webRef = useRef<WebView>(null)
  const prevCountRef = useRef(0)
  const prevPlannedRef = useRef<[number, number][] | undefined>()
  // Build HTML only once — never change source after mount
  const initialHtml = useMemo(() => buildInitialHtml(), [])

  useEffect(() => {
    if (!webRef.current || points.length === prevCountRef.current) return
    prevCountRef.current = points.length
    const coords = JSON.stringify(points.map(p => [p.lat, p.lng]))
    webRef.current.injectJavaScript(`window.updateMap(${coords}); true;`)
  }, [points])

  useEffect(() => {
    if (!webRef.current || !plannedCoords || plannedCoords === prevPlannedRef.current) return
    prevPlannedRef.current = plannedCoords
    const json = JSON.stringify(plannedCoords)
    webRef.current.injectJavaScript(`window.setPlannedRoute(${json}); true;`)
  }, [plannedCoords])

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: initialHtml }}
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
