import React, { useState, useEffect, useRef } from 'react';

// Adjustable speed: 10 FPS is usually the "cinematic" sweet spot for map data
const TARGET_FPS = 10;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

const SimulationControls = ({ points, setPoints, onAnalyze, apiUrl }) => {
    // UI State
    const [isPlaying, setIsPlaying] = useState(false);
    const [stats, setStats] = useState({ fps: 0, latency: 0 });
    
    // Animation Refs (Mutable state that doesn't trigger re-renders)
    const requestRef = useRef();
    const pathRef = useRef([]);
    const frameIndex = useRef(0);
    const lastFrameTime = useRef(0);
    
    // We use a Ref for "isPlaying" to avoid Stale State issues in the loop
    // and to ensure the Stop button reacts INSTANTLY.
    const isPlayingRef = useRef(false);

    // Keep a Ref of points so the loop can access the latest drag updates
    const pointsRef = useRef(points);

    // Sync Ref whenever props change
    useEffect(() => {
        pointsRef.current = points;
    }, [points]);

    const startSimulation = async () => {
        if (points.length < 2) return;
        
        const startNode = points[0].nodeId;
        const endNode = points[points.length - 1].nodeId; 

        try {
            const res = await fetch(`${apiUrl}/route?start_node=${startNode}&end_node=${endNode}`);
            const data = await res.json();
            
            pathRef.current = data.path; 
            frameIndex.current = 0;
            
            // Start State
            setIsPlaying(true);
            isPlayingRef.current = true;
            lastFrameTime.current = performance.now();
            
            // Kick off loop
            requestRef.current = requestAnimationFrame(animate);
        } catch (e) {
            console.error("Could not fetch simulation path", e);
        }
    };

    const animate = async (timestamp) => {
        // 1. Instant Exit Check (Fixes "Stop Button Not Reactive")
        if (!isPlayingRef.current || !pathRef.current.length) return;

        // 2. Throttling Logic (Fixes "Too Fast to See")
        const elapsed = timestamp - lastFrameTime.current;

        if (elapsed > FRAME_INTERVAL) {
            // It's time to draw a frame!
            
            // Adjust time to prevent drift, but cap it to avoid huge jumps
            lastFrameTime.current = timestamp - (elapsed % FRAME_INTERVAL);

            // --- CORE LOGIC START ---
            const currentStep = pathRef.current[frameIndex.current];
            
            // Clone points from Ref
            const nextPoints = pointsRef.current.map(p => ({ ...p }));
            
            // Move the Ghost Car
            if (nextPoints[1]) {
                nextPoints[1].nodeId = currentStep.nodeId;
                nextPoints[1].lat = currentStep.lat;
                nextPoints[1].lng = currentStep.lng;
            }

            // Update Visuals (Map Marker)
            setPoints(nextPoints);
            pointsRef.current = nextPoints;

            // Trigger Backend Calc
            const t0 = performance.now();
            
            // We await the result, which naturally paces the loop if the server is slow.
            // But if the server is fast (23ms), our FRAME_INTERVAL (100ms) keeps it sane.
            await onAnalyze(nextPoints);
            
            const t1 = performance.now();
            const latency = Math.round(t1 - t0);

            // Update Stats (throttled visually to avoid flickering numbers)
            if (frameIndex.current % 5 === 0) {
                setStats({
                    latency: latency,
                    fps: Math.round(1000 / (Math.max(latency, FRAME_INTERVAL) + 1))
                });
            }

            // Increment Frame
            frameIndex.current = (frameIndex.current + 1) % pathRef.current.length;
            // --- CORE LOGIC END ---
        }

        // 3. Schedule Next Check
        // We always request the frame, but we only ACT if elapsed > interval
        if (isPlayingRef.current) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    const stopSimulation = () => {
        // Update both State (for UI) and Ref (for Logic)
        setIsPlaying(false);
        isPlayingRef.current = false;
        
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isPlayingRef.current = false;
            cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-xl z-10 w-64 font-sans">
            <h3 className="font-bold text-slate-700 border-b mb-2">Simulation</h3>
            
            <div className="flex gap-2 mb-4">
                {!isPlaying ? (
                    <button 
                        onClick={startSimulation}
                        disabled={points.length < 2}
                        className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-bold"
                    >
                        ▶ Play
                    </button>
                ) : (
                    <button 
                        onClick={stopSimulation}
                        className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 font-bold"
                    >
                        ⏹ Stop
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-100 p-2 rounded">
                    <div className="text-xs text-slate-500">Latency</div>
                    <div className={`text-xl font-mono font-bold ${stats.latency > 100 ? 'text-red-500' : 'text-green-600'}`}>
                        {stats.latency}ms
                    </div>
                </div>
                <div className="bg-slate-100 p-2 rounded">
                    <div className="text-xs text-slate-500">Speed</div>
                    <div className="text-xl font-mono font-bold text-slate-700">
                        {TARGET_FPS} FPS
                    </div>
                </div>
            </div>
            
            <p className="text-[10px] text-slate-400 mt-2 text-center italic">
                Throttled for visibility
            </p>
        </div>
    );
};

export default SimulationControls;