import React, { useState } from 'react';

const MetricsPanel = ({ 
    baselineStats, 
    alprStats, 
    privacyMode,
    history // Array of { time: string, uncertainty: number }
}) => {
    const [activeTab, setActiveTab] = useState('physical');

    // --- 1. DATA EXTRACTION ---
    // We strictly use the backend-provided 'total_length_km'
    const baselineLen = baselineStats?.properties?.total_length_km || 0;
    const alprLen = alprStats?.properties?.total_length_km || 0;

    // --- 2. DERIVED METRICS ---
    
    // Privacy Loss Ratio: (Baseline - ALPR) / Baseline
    // Only calculable if we have a baseline
    const lossRatio = baselineLen > 0 ? ((baselineLen - alprLen) / baselineLen) * 100 : 0;
    
    // Hartley Entropy (Bits) = log2(Total Length in Meters)
    // We convert KM to Meters (* 1000) for standard precision
    const baselineEntropy = baselineLen > 0 ? Math.log2(baselineLen * 1000) : 0;
    const alprEntropy = alprLen > 0 ? Math.log2(alprLen * 1000) : 0;
    const entropyLoss = baselineEntropy - alprEntropy;

    // --- 3. DYNAMIC DISPLAY VALUES ---
    // These switch based on what the user is currently viewing (Baseline vs ALPR)
    const currentLen = privacyMode === 'baseline' ? baselineLen : alprLen;
    const currentEntropy = privacyMode === 'baseline' ? baselineEntropy : alprEntropy;

    // --- CHART COMPONENT ---
    const TimelineChart = () => {
        if (!history || history.length < 2) {
            return <div className="text-[10px] text-slate-400 italic p-4 text-center">Waiting for simulation data...</div>;
        }

        const height = 100;
        const width = 250;
        const padding = 5;

        // Auto-scale Y-axis
        const maxVal = Math.max(...history.map(h => h.uncertainty));
        if (maxVal === 0) return <div className="text-[10px] text-slate-400 italic p-4">No volume data</div>;

        const points = history.map((h, i) => {
            const x = (i / (history.length - 1)) * (width - 2 * padding) + padding;
            // Invert Y (SVG 0 is top)
            const y = height - ((h.uncertainty / maxVal) * (height - 2 * padding)) - padding;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="mt-2 bg-slate-50 rounded border border-slate-100 p-2">
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                    <path d={`M ${padding},${height} L ${points} L ${width-padding},${height} Z`} fill={privacyMode === 'baseline' ? "#dbeafe" : "#fee2e2"} stroke="none" opacity="0.5" />
                    <path d={`M ${points}`} fill="none" stroke={privacyMode === 'baseline' ? "#2563eb" : "#dc2626"} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
                    <span>Start</span>
                    <span>Time</span>
                    <span>End</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-xl w-72 font-sans pointer-events-auto">
            {/* HEADER */}
            <h3 className="font-bold text-slate-700 border-b pb-2 mb-3 text-sm flex justify-between items-center">
                <span>Privacy Metrics</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors duration-300 ${
                    privacyMode === 'baseline' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>
                    {privacyMode === 'baseline' ? 'Baseline' : 'Monitoring'}
                </span>
            </h3>

            {/* TABS */}
            <div className="flex border-b border-slate-200 mb-4">
                {[
                    { id: 'physical', label: 'Roads' },
                    { id: 'ratio', label: 'Loss %' },
                    { id: 'volume', label: 'Chart' },
                    { id: 'entropy', label: 'Bits' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 pb-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            activeTab === tab.id 
                            ? 'text-slate-800 border-b-2 border-slate-800' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="min-h-[120px] flex flex-col justify-center transition-all duration-300">
                
                {/* 1. PHYSICAL (Road Length) */}
                {activeTab === 'physical' && (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Reachable Network</div>
                        <div className={`text-3xl font-mono font-bold transition-colors duration-300 ${privacyMode === 'baseline' ? 'text-blue-600' : 'text-red-600'}`}>
                            {currentLen.toFixed(2)}
                            <span className="text-sm font-normal text-slate-500 ml-1">km</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                            Total length of valid roads accessible within the time budget.
                        </div>
                    </div>
                )}

                {/* 2. RATIO (Percentage Loss) */}
                {activeTab === 'ratio' && (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Anonymity Reduction</div>
                        <div className={`text-3xl font-mono font-bold ${lossRatio > 50 ? 'text-red-600' : 'text-slate-800'}`}>
                            {lossRatio.toFixed(1)}%
                        </div>
                        
                        {/* Visual Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden relative">
                            <div className="absolute inset-0 w-full h-full opacity-20 bg-[length:10px_10px] bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_50%,#ccc_50%,#ccc_75%,transparent_75%,transparent)]"></div>
                            <div 
                                className="bg-red-500 h-full transition-all duration-700 ease-out" 
                                style={{ width: `${Math.max(2, lossRatio)}%` }}
                            />
                        </div>
                        
                        <div className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                            Percent of reachable space eliminated by ALPRs compared to baseline.
                        </div>
                    </div>
                )}

                {/* 3. VOLUME (Timeline Chart) */}
                {activeTab === 'volume' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-[10px] text-slate-500 uppercase font-bold text-center mb-1">Space-Time Volume</div>
                        <TimelineChart />
                        <div className="text-[9px] text-center text-slate-400 mt-2">
                            Relative uncertainty over time
                        </div>
                    </div>
                )}

                {/* 4. ENTROPY (Bits) */}
                {activeTab === 'entropy' && (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Hartley Entropy</div>
                        <div className={`text-3xl font-mono font-bold transition-colors duration-300 ${privacyMode === 'baseline' ? 'text-blue-600' : 'text-red-600'}`}>
                            {currentEntropy.toFixed(2)}
                            <span className="text-sm font-normal text-slate-500 ml-1">bits</span>
                        </div>
                        
                        {entropyLoss > 0 && privacyMode === 'alpr' && (
                             <div className="text-[10px] text-red-600 mt-1 font-bold bg-red-50 inline-block px-2 py-0.5 rounded border border-red-100">
                                -{entropyLoss.toFixed(2)} bits lost
                            </div>
                        )}
                        
                        <div className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                            Information-theoretic measure of location uncertainty (log₂ of space).
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MetricsPanel;