import React, { useState, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import PrismControls from './components/PrismControls';
import { prismLayer, pointLayer } from './config/mapLayers';
import SimulationControls from './components/SimulationControls';

const INITIAL_VIEW_STATE = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 12
};

const API_URL = "http://localhost:8000";

function App() {
  const mapRef = useRef();
  
  // State
  const [mode, setMode] = useState(null); // 'add' or null
  const [points, setPoints] = useState([]); // Array of { id, lat, lng, nodeId, timeStr }
  const [prismData, setPrismData] = useState(null);

  // Handle Map Clicks
  const handleMapClick = async (event) => {
    if (mode !== 'add') return;

    const lng = event.lngLat.lng !== undefined ? event.lngLat.lng : event.lngLat[0];
    const lat = event.lngLat.lat !== undefined ? event.lngLat.lat : event.lngLat[1];

    try {
      const response = await fetch(`${API_URL}/nearest-node?lat=${lat}&lng=${lng}`);
      const data = await response.json();
      
      // Default time: Current time or last point's time + 15 mins
      let defaultTime = "10:00";
      if (points.length > 0) {
         // simplistic increment logic could go here, but "10:00" is fine as placeholder
         defaultTime = points[points.length-1].timeStr; 
      }

      const newPoint = {
          id: Date.now(), // Unique ID
          lat,
          lng,
          nodeId: data.node_id,
          timeStr: defaultTime
      };

      setPoints(prev => [...prev, newPoint]);
      // Note: We stay in 'add' mode so user can keep clicking
    } catch (error) {
      console.error("Failed to fetch node:", error);
    }
  };

  // Helper: Convert "10:30" to relative seconds from the first point
  const getSecondsFromTimeStr = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 3600 + m * 60;
  };

  const runAnalysis = async (overridePoints) => {
    // 1. Determine which points to use
    // If 'overridePoints' is an array, it came from the Simulation Loop (Real-time).
    // If it's a Click Event (or undefined), use the React State 'points' (Manual Mode).
    const pointsToUse = Array.isArray(overridePoints) ? overridePoints : points;

    if (pointsToUse.length < 2) return;

    // 2. Sort points by time (Logic remains the same)
    const sortedPoints = [...pointsToUse].sort((a, b) => 
        getSecondsFromTimeStr(a.timeStr) - getSecondsFromTimeStr(b.timeStr)
    );

    const payload = sortedPoints.map(p => ({
        node_id: p.nodeId,
        time: getSecondsFromTimeStr(p.timeStr)
    }));

    try {
      const response = await fetch(`${API_URL}/analyze/chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: payload })
      });

      const data = await response.json();
      setPrismData(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      // IMPORTANT: Comment out alert to avoid infinite popups if the simulation crashes
      // alert("Analysis failed. Check backend logs.");
    }
  };

  const handleReset = () => {
    setPoints([]);
    setPrismData(null);
    setMode(null);
  };

  // Convert points to GeoJSON for display
  const pointsGeoJSON = useMemo(() => {
    return {
        type: 'FeatureCollection',
        features: points.map((p, i) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { 
                index: i + 1,
                time: p.timeStr,
                type: i === 0 ? 'start' : (i === points.length - 1 ? 'end' : 'mid') 
            }
        }))
    };
  }, [points]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      
      <PrismControls 
        points={points}
        setPoints={setPoints}
        mode={mode}
        setMode={setMode}
        onAnalyze={runAnalysis}
        onReset={handleReset}
      />
      <SimulationControls 
        points={points}
        setPoints={setPoints}
        onAnalyze={runAnalysis}
        apiUrl={API_URL}
      />
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapLib={maplibregl}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onClick={handleMapClick}
        cursor={mode === 'add' ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="top-right" />

        {/* Prism Layer */}
        {prismData && (
          <Source id="prism-data" type="geojson" data={prismData}>
            <Layer {...prismLayer} beforeId="selected-points" />
          </Source>
        )}

        {/* Points Layer */}
        <Source id="points-data" type="geojson" data={pointsGeoJSON}>
          <Layer {...pointLayer} />
        </Source>

      </Map>
    </div>
  );
}

export default App;