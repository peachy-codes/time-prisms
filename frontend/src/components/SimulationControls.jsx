import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const TARGET_FPS = 10;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

const SimulationControls = ({ 
    points, 
    setPoints, 
    setCurrentPrismData, 
    setBaselinePrismData,
    setAlprPrismData,
    setHasRunSimulation,
    setPrivacyMode,
    setMetricsHistory, 
    cameraNodeSet 
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    const [progress, setProgress] = useState("Ready");
    const [simulationTime, setSimulationTime] = useState("--:--");

    const requestRef = useRef();
    const isPlayingRef = useRef(false);
    
    const cleanPointsRef = useRef([]); 
    const flightPlanRef = useRef([]); 
    const detectedCamerasRef = useRef(new Set()); 
    const staticPrismsRef = useRef([]); 
    
    const currentLegIndex = useRef(0);
    const frameIndex = useRef(0);
    const lastFrameTime = useRef(0);

    const pastFeaturesRef = useRef([]); 
    const lastDynamicFeaturesRef = useRef([]);
    const lastPropertiesRef = useRef({ total_length_km: 0 });

    const getSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 3600 + m * 60;
    };

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600) % 24;
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    };

    const startSimulation = async () => {
        const clean = points.filter(p => !p.isGhost && p.type !== 'alpr');
        if (clean.length < 2) return;
        
        setHasRunSimulation(false);
        setPrivacyMode('alpr');
        setBaselinePrismData(null);
        setAlprPrismData(null);
        setMetricsHistory([]); 
        setProgress("Calculating Route...");
        
        cleanPointsRef.current = JSON.parse(JSON.stringify(clean));
        detectedCamerasRef.current.clear();
        pastFeaturesRef.current = []; 
        lastDynamicFeaturesRef.current = [];
        setSimulationTime(clean[0].timeStr);

        try {
            const plan = [];
            const prisms = [];

            for (let i = 0; i < clean.length - 1; i++) {
                const startPoint = clean[i];
                const endPoint = clean[i+1];
                
                const routeData = await api.getRoute(startPoint.nodeId, endPoint.nodeId);
                if (!routeData.path) continue;

                plan.push({
                    path: routeData.path,
                    tStart: getSeconds(startPoint.timeStr),
                    tEnd: getSeconds(endPoint.timeStr),
                    startNodeId: startPoint.nodeId,
                    endNodeId: endPoint.nodeId
                });

                const payload = [
                    { node_id: startPoint.nodeId, time: getSeconds(startPoint.timeStr) },
                    { node_id: endPoint.nodeId, time: getSeconds(endPoint.timeStr) }
                ];
                const prismData = await api.getPrism(payload, true);
                prisms.push(prismData.features || []);
                
                if (i === 0 && prismData.properties) {
                    lastPropertiesRef.current = prismData.properties;
                }
            }
            
            setBaselinePrismData({
                type: "FeatureCollection",
                features: prisms.flat(),
                properties: lastPropertiesRef.current
            });

            flightPlanRef.current = plan;
            staticPrismsRef.current = prisms;
            currentLegIndex.current = 0;
            frameIndex.current = 0;
            
            setIsPlaying(true);
            isPlayingRef.current = true;
            lastFrameTime.current = performance.now();
            setProgress("Running");
            
            requestRef.current = requestAnimationFrame(animate);
        } catch (e) {
            console.error("Setup failed", e);
            setProgress("Error");
        }
    };

    const animate = async (timestamp) => {
        if (!isPlayingRef.current) return;

        const elapsed = timestamp - lastFrameTime.current;

        if (elapsed > FRAME_INTERVAL) {
            lastFrameTime.current = timestamp - (elapsed % FRAME_INTERVAL);

            if (currentLegIndex.current >= flightPlanRef.current.length) {
                stopSimulation();
                return;
            }

            const currentLeg = flightPlanRef.current[currentLegIndex.current];
            const currentPath = currentLeg.path;

            // Transition logic
            if (frameIndex.current >= currentPath.length) {
                // LOCK IN: Move dynamic features to permanent past history
                if (lastDynamicFeaturesRef.current.length > 0) {
                    pastFeaturesRef.current.push(...lastDynamicFeaturesRef.current);
                }
                
                lastDynamicFeaturesRef.current = [];
                currentLegIndex.current++;
                frameIndex.current = 0;
                
                requestRef.current = requestAnimationFrame(animate);
                return;
            }

            const currentStep = currentPath[frameIndex.current];
            const legPhysicsDuration = currentPath[currentPath.length - 1].timeOffset;
            const legScheduledDuration = currentLeg.tEnd - currentLeg.tStart;
            const timeRatio = legPhysicsDuration > 0 ? (legScheduledDuration / legPhysicsDuration) : 1;
            
            const tCurrent = currentLeg.tStart + ((currentStep.timeOffset || 0) * timeRatio);
            const currentStr = formatTime(tCurrent);
            setSimulationTime(currentStr);

            // ALPR TRIPWIRE
            if (cameraNodeSet && cameraNodeSet.has(currentStep.nodeId)) {
                if (!detectedCamerasRef.current.has(currentStep.nodeId)) {
                    detectedCamerasRef.current.add(currentStep.nodeId);
                    
                    const splitIdx = frameIndex.current;
                    
                    // LEG A (Locked History): We simply stop updating its dynamic features 
                    // and move them to pastFeaturesRef in the next transition.
                    const pathA = currentPath.slice(0, splitIdx + 1);
                    const legA = {
                        ...currentLeg,
                        path: pathA,
                        tEnd: tCurrent, 
                        endNodeId: currentStep.nodeId
                    };
                    
                    // LEG B (New Future)
                    const pathB = currentPath.slice(splitIdx);
                    const offsetShift = pathB[0].timeOffset;
                    const adjustedPathB = pathB.map(p => ({
                        ...p,
                        timeOffset: p.timeOffset - offsetShift
                    }));
                    
                    const legB = {
                        ...currentLeg,
                        path: adjustedPathB,
                        tStart: tCurrent,
                        tEnd: currentLeg.tEnd,
                        startNodeId: currentStep.nodeId
                    };
                    
                    // Atomic update to flight plan
                    flightPlanRef.current.splice(currentLegIndex.current, 1, legA, legB);
                    staticPrismsRef.current.splice(currentLegIndex.current, 1, [], []); 

                    const detectedPoint = {
                        id: Date.now(),
                        nodeId: currentStep.nodeId,
                        lat: currentStep.lat,
                        lng: currentStep.lng,
                        timeStr: currentStr,
                        type: 'alpr', 
                        isDetected: true 
                    };
                    cleanPointsRef.current.splice(currentLegIndex.current + 1, 0, detectedPoint);
                }
            }

            // GHOST CAR VISUALS
            const ghostPoint = {
                id: 'ghost-car',
                nodeId: currentStep.nodeId,
                lat: currentStep.lat,
                lng: currentStep.lng,
                timeStr: currentStr,
                isGhost: true 
            };

            const visualPoints = [...cleanPointsRef.current];
            visualPoints.splice(currentLegIndex.current + 1, 0, ghostPoint);
            setPoints(visualPoints);
            
            // PRISM UPDATES
            const t0 = performance.now();
            const activeStartNode = currentLeg.startNodeId;
            const activeEndNode = currentLeg.endNodeId;
            
            if (activeStartNode && activeEndNode) {
                const dynamicPayload = [
                    { node_id: activeStartNode, time: currentLeg.tStart },
                    { node_id: ghostPoint.nodeId, time: tCurrent },
                    { node_id: activeEndNode, time: currentLeg.tEnd }
                ];

                const dynData = await api.getPrism(dynamicPayload, false);
                lastDynamicFeaturesRef.current = dynData.features || [];

                if (dynData.properties && dynData.properties.total_length_km > 0) {
                    lastPropertiesRef.current = dynData.properties;
                }

                const combinedFeatures = [
                    ...pastFeaturesRef.current, 
                    ...lastDynamicFeaturesRef.current,         
                    ...staticPrismsRef.current.slice(currentLegIndex.current + 1).flat() 
                ];
                
                setCurrentPrismData({ 
                    type: "FeatureCollection", 
                    features: combinedFeatures,
                    properties: lastPropertiesRef.current 
                });

                const totalUncertainty = (dynData.features?.length || 0) + 
                                       staticPrismsRef.current.slice(currentLegIndex.current + 1).flat().length;

                setMetricsHistory(prev => [...prev, {
                    time: currentStr,
                    uncertainty: totalUncertainty
                }]);
            }

            const t1 = performance.now();
            setStats({
                latency: Math.round(t1 - t0),
                fps: Math.round(1000 / (Math.max((t1 - t0), FRAME_INTERVAL) + 1))
            });
            
            frameIndex.current++;
        }

        if (isPlayingRef.current) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    const stopSimulation = async () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        setProgress("Finalizing...");
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        
        if (cleanPointsRef.current.length > 0) {
            setPoints(cleanPointsRef.current);
            const payload = cleanPointsRef.current.map(p => ({
                node_id: p.nodeId,
                time: getSeconds(p.timeStr)
            }));
            
            try {
                const finalData = await api.getPrism(payload, true);
                if (finalData.properties) {
                    lastPropertiesRef.current = finalData.properties;
                }
                setAlprPrismData(finalData);
                setCurrentPrismData(finalData); 
                setHasRunSimulation(true);
                setProgress("Finished");
            } catch (e) {
                console.error("Final calc failed", e);
                setProgress("Error");
            }
        }
    };

    useEffect(() => {
        return () => {
            isPlayingRef.current = false;
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div className="bg-white p-4 rounded-lg shadow-xl w-72 font-sans pointer-events-auto">
            <h3 className="font-bold text-slate-700 border-b mb-4">Simulation</h3>
            <div className="mb-4 text-center">
                <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Current Time</div>
                <div className="text-4xl font-mono font-bold text-slate-800 bg-slate-50 rounded p-2 border border-slate-200">
                    {simulationTime}
                </div>
            </div>
            <div className="flex gap-2 mb-4">
                {!isPlaying ? (
                    <button onClick={startSimulation} disabled={points.length < 2} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-bold">▶ Play</button>
                ) : (
                    <button onClick={stopSimulation} className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 font-bold">⏹ Stop</button>
                )}
            </div>
            <div className="text-xs text-center text-slate-500 mb-2 font-mono">{progress}</div>
            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-100 p-2 rounded">
                    <div className="text-xs text-slate-500">Latency</div>
                    <div className={`text-xl font-mono font-bold ${stats.latency > 100 ? 'text-red-500' : 'text-green-600'}`}>{stats.latency}ms</div>
                </div>
                <div className="bg-slate-100 p-2 rounded">
                    <div className="text-xs text-slate-500">Speed</div>
                    <div className="text-xl font-mono font-bold text-slate-700">{TARGET_FPS} FPS</div>
                </div>
            </div>
        </div>
    );
};

export default SimulationControls;