import React, { useMemo } from 'react';
import { enrichPointsWithMetadata } from '../utils/pointUtils';

const PrismControls = ({ 
    points, 
    setPoints,
    mode, 
    setMode, 
    onAnalyze, 
    onReset 
}) => {

    const updateTime = (index, newTimeStr) => {
        setPoints(prev => prev.map((p, i) => i === index ? { ...p, timeStr: newTimeStr } : p));
    };

    const removePoint = (index) => {
        setPoints(prev => prev.filter((_, i) => i !== index));
    };

    // Use our new utility to get labels and colors
    const enrichedPoints = useMemo(() => enrichPointsWithMetadata(points), [points]);

    return (
        <div className="bg-white p-5 rounded-lg shadow-xl w-80 font-sans max-h-[90vh] overflow-y-auto pointer-events-auto">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Space-Time Path</h2>
            
            <button 
                onClick={() => setMode(mode === 'add' ? null : 'add')}
                className={`w-full py-3 mb-4 rounded font-bold border-2 border-dashed transition-all ${
                    mode === 'add' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'
                }`}
            >
                {mode === 'add' ? "Click Map to Place Point..." : "+ Add Detection Point"}
            </button>

            <div className="flex flex-col gap-3 mb-6">
                {enrichedPoints.length === 0 && (
                    <div className="text-center text-slate-400 italic text-sm py-2">
                        No points added yet.
                    </div>
                )}

                {enrichedPoints.map((p, i) => {
                    if (p.isGhost) return null;
                    
                    const { label, style, type } = p.meta;

                    return (
                        <div key={p.id} className={`bg-slate-50 p-3 rounded border relative group ${style.twBorder}`}>
                            <div className="flex justify-between items-center mb-2">
                                {/* Theme-based Badge */}
                                <span className={`text-xs font-bold px-2 py-1 rounded ${style.twBadge}`}>
                                    {label}
                                </span>
                                
                                {type !== 'alpr' && (
                                    <button 
                                        onClick={() => removePoint(i)}
                                        className="text-slate-400 hover:text-red-500 text-xs px-2"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-slate-500">TIME:</label>
                                <input 
                                    type="time" 
                                    value={p.timeStr}
                                    onChange={(e) => updateTime(i, e.target.value)}
                                    disabled={type === 'alpr'}
                                    className={`flex-1 p-1 border rounded text-sm ${type === 'alpr' ? 'bg-slate-200 cursor-not-allowed text-slate-500' : 'cursor-pointer'}`}
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 truncate">
                                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-2">
                <button 
                    onClick={onAnalyze}
                    disabled={points.length < 2}
                    className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Compute Chain
                </button>

                <button 
                    onClick={onReset}
                    className="w-full bg-white text-slate-500 py-2 rounded border border-slate-300 hover:bg-slate-50 text-sm"
                >
                    Reset All
                </button>
            </div>
        </div>
    );
};

export default PrismControls;