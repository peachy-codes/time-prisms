import React from 'react';

const PrismControls = ({ 
    points, 
    setPoints,
    mode, 
    setMode, 
    onAnalyze, 
    onReset 
}) => {

    // Helper: Update time for specific point index
    const updateTime = (index, newTimeStr) => {
        const newPoints = [...points];
        newPoints[index].timeStr = newTimeStr;
        setPoints(newPoints);
    };

    // Helper: Remove a point
    const removePoint = (index) => {
        const newPoints = points.filter((_, i) => i !== index);
        setPoints(newPoints);
    };

    return (
        <div className="absolute top-4 left-4 bg-white p-5 rounded-lg shadow-xl w-80 z-10 font-sans max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Space-Time Path</h2>
            
            {/* Add Button */}
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

            {/* Point List */}
            <div className="flex flex-col gap-3 mb-6">
                {points.length === 0 && (
                    <div className="text-center text-slate-400 italic text-sm py-2">
                        No points added yet.
                    </div>
                )}

                {points.map((p, i) => (
                    <div key={p.id} className="bg-slate-50 p-3 rounded border border-slate-200 relative group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-slate-700">
                                Point {i + 1}
                            </span>
                            <button 
                                onClick={() => removePoint(i)}
                                className="text-slate-400 hover:text-red-500 text-xs px-2"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-500">TIME:</label>
                            <input 
                                type="time" 
                                value={p.timeStr}
                                onChange={(e) => updateTime(i, e.target.value)}
                                className="flex-1 p-1 border rounded text-sm"
                            />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                            {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
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