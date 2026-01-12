import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { api } from './services/api'; 
import { enrichPointsWithMetadata } from './utils/pointUtils';
import PrismControls from './components/PrismControls';
import PrivacyControls from './components/PrivacyControls';
import MetricsPanel from './components/MetricsPanel'; // NEW
import { prismLayer, pointLayer } from './config/mapLayers';
import SimulationControls from './components/SimulationControls';

const INITIAL_VIEW_STATE = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 12
};

function App() {
  const mapRef = useRef();
  
  // App State
  const [mode, setMode] = useState(null); 
  const [points, setPoints] = useState([]); 
  
  // Prism State
  const [currentPrismData, setCurrentPrismData] = useState(null); 
  const [baselinePrismData, setBaselinePrismData] = useState(null);
  const [alprPrismData, setAlprPrismData] = useState(null);
  
  // Metrics State (NEW)
  const [metricsHistory, setMetricsHistory] = useState([]); // For chart
  
  // Privacy State
  const [showCameras, setShowCameras] = useState(true);
  const [hasRunSimulation, setHasRunSimulation] = useState(false);
  const [privacyMode, setPrivacyMode] = useState('alpr');

  const [cameraGeoJSON, setCameraGeoJSON] = useState(null);
  const [cameraNodeSet, setCameraNodeSet] = useState(new Set());

  useEffect(() => {
      api.getCameras()
        .then(data => {
            setCameraGeoJSON(data);
            const ids = new Set(data.features.map(f => f.properties.node_id));
            setCameraNodeSet(ids);
        })
        .catch(err => console.error("Failed to load cameras", err));
  }, []);

  useEffect(() => {
      if (!hasRunSimulation) return;

      if (privacyMode === 'baseline' && baselinePrismData) {
          setCurrentPrismData(baselinePrismData);
      } else if (privacyMode === 'alpr' && alprPrismData) {
          setCurrentPrismData(alprPrismData);
      }
  }, [privacyMode, hasRunSimulation, baselinePrismData, alprPrismData]);

  const handleMapClick = async (event) => {
    if (mode !== 'add') return;
    const lng = event.lngLat.lng !== undefined ? event.lngLat.lng : event.lngLat[0];
    const lat = event.lngLat.lat !== undefined ? event.lngLat.lat : event.lngLat[1];

    try {
      const data = await api.getNearestNode(lat, lng);
      
      let defaultTime = "10:00";
      if (points.length > 0) {
         const lastPoint = points[points.length-1];
         
         // 1. Get precise route duration from Backend
         const routeData = await api.getRoute(lastPoint.nodeId, data.node_id);
         const travelTimeSeconds = routeData.duration_s || 0;
         
         // 2. Add to previous time
         const [h, m] = lastPoint.timeStr.split(':').map(Number);
         const lastSeconds = h * 3600 + m * 60;
         
         // Note: We add a small 2-minute "Human Buffer" so the prism isn't a 0-width line.
         // Without this, "Uncertainty" is 0 because you are exactly on schedule.
         const newTotalSeconds = lastSeconds + travelTimeSeconds + 120; 

         const newH = Math.floor(newTotalSeconds / 3600) % 24;
         const newM = Math.floor((newTotalSeconds % 3600) / 60);
         
         defaultTime = `${String(newH).padStart(2,'0')}:${String(newM).padStart(2,'0')}`;
      }

      const newPoint = {
          id: Date.now(), lat, lng, nodeId: data.node_id, timeStr: defaultTime, type: 'user' 
      };
      setPoints(prev => [...prev, newPoint]);
      
      setHasRunSimulation(false);
      setBaselinePrismData(null);
      setAlprPrismData(null);
      setMetricsHistory([]); // Reset chart

    } catch (error) {
      console.error("Failed to fetch node:", error);
    }
  };

  const getSecondsFromTimeStr = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 3600 + m * 60;
  };

  const runAnalysis = async (overridePoints) => {
    if (!Array.isArray(overridePoints)) setCurrentPrismData(null);

    const activePoints = Array.isArray(overridePoints) ? overridePoints : points;
    if (activePoints.length < 2) return;

    let payloadPoints = activePoints;
    if (!Array.isArray(overridePoints)) {
        payloadPoints = [...activePoints].sort((a, b) => 
            getSecondsFromTimeStr(a.timeStr) - getSecondsFromTimeStr(b.timeStr)
        );
    }

    const payload = payloadPoints.map(p => ({
        node_id: p.nodeId,
        time: getSecondsFromTimeStr(p.timeStr)
    }));

    try {
      const data = await api.getPrism(payload);
      if ((!data.features || data.features.length === 0) && !Array.isArray(overridePoints)) {
          alert("No prism found! Time budget too tight.");
      }
      setCurrentPrismData(data);
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleReset = () => {
    setPoints([]);
    setCurrentPrismData(null);
    setMode(null);
    setHasRunSimulation(false);
    setMetricsHistory([]);
  };

  const pointsGeoJSON = useMemo(() => {
    const enriched = enrichPointsWithMetadata(points);
    return {
        type: 'FeatureCollection',
        features: enriched.map((p) => {
            const { type, label } = p.meta;
            if (type === 'alpr' && privacyMode === 'baseline' && hasRunSimulation) return null; 
            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: { time: p.timeStr, type: type, label: label }
            };
        }).filter(Boolean)
    };
  }, [points, privacyMode, hasRunSimulation]);

  const dynamicPointLayer = {
      ...pointLayer,
      id: 'points-layer',
      paint: {
          ...pointLayer.paint,
          'circle-color': [
              'match', ['get', 'type'],
              'ghost', '#FBBF24', 'alpr', '#DC2626', 'start', '#10B981', 'end', '#EF4444', '#3B82F6'
          ],
          'circle-radius': [
              'match', ['get', 'type'],
              'ghost', 8, 'alpr', 5, 6
          ]
      }
  };

  const labelLayer = {
      id: 'point-labels',
      type: 'symbol',
      layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-allow-overlap': false
      },
      paint: { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
  };

  const cameraLayer = {
    id: 'camera-layer',
    type: 'circle',
    paint: { 'circle-radius': 4, 'circle-color': '#991b1b', 'circle-opacity': 0.2, 'circle-stroke-width': 0 }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* LEFT PANEL */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <PrismControls 
            points={points}
            setPoints={setPoints}
            mode={mode}
            setMode={setMode}
            onAnalyze={runAnalysis}
            onReset={handleReset}
          />
      </div>

      {/* RIGHT PANEL */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-3 pointer-events-none">
          
          <SimulationControls 
            points={points}
            setPoints={setPoints}
            setCurrentPrismData={setCurrentPrismData}
            setBaselinePrismData={setBaselinePrismData}
            setAlprPrismData={setAlprPrismData}
            setHasRunSimulation={setHasRunSimulation}
            setPrivacyMode={setPrivacyMode}
            setMetricsHistory={setMetricsHistory} // Pass this setter
            onAnalyze={runAnalysis}
            cameraNodeSet={cameraNodeSet}
          />
          
          <PrivacyControls 
            showCameras={showCameras}
            setShowCameras={setShowCameras}
            hasRunSimulation={hasRunSimulation}
            privacyMode={privacyMode}
            setPrivacyMode={setPrivacyMode}
          />

          {/* NEW METRICS PANEL */}
          <MetricsPanel 
             baselineStats={baselinePrismData}
             alprStats={alprPrismData}
             privacyMode={privacyMode}
             history={metricsHistory}
          />

      </div>

      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapLib={maplibregl}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onClick={handleMapClick}
        cursor={mode === 'add' ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="top-right" style={{marginTop: '350px'}} />

        {showCameras && cameraGeoJSON && (
            <Source id="camera-data" type="geojson" data={cameraGeoJSON}>
                <Layer {...cameraLayer} />
            </Source>
        )}

        <Source id="points-data" type="geojson" data={pointsGeoJSON}>
          <Layer {...dynamicPointLayer} />
          <Layer {...labelLayer} />
        </Source>

        {currentPrismData && (
          <Source id="prism-data" type="geojson" data={currentPrismData}>
            <Layer {...prismLayer} beforeId="points-layer" />
          </Source>
        )}

      </Map>
    </div>
  );
}

export default App;