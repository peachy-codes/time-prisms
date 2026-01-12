import React from 'react';

const PrivacyControls = ({ 
    showCameras, 
    setShowCameras, 
    hasRunSimulation, 
    privacyMode,      
    setPrivacyMode    
}) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-xl flex flex-col gap-3 w-72 font-sans pointer-events-auto">
            <h3 className="font-bold text-slate-700 border-b pb-1 text-sm">Privacy Layer</h3>

            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    checked={showCameras} 
                    onChange={(e) => setShowCameras(e.target.checked)}
                    id="cam-toggle"
                    className="cursor-pointer accent-red-600" // Added brand color accent
                />
                <label htmlFor="cam-toggle" className="text-sm text-slate-700 cursor-pointer select-none">
                    Show ALPR Locations
                </label>
            </div>

            <div className={`transition-opacity duration-300 ${hasRunSimulation ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Dataset Comparison
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded">
                    <button
                        onClick={() => setPrivacyMode('baseline')}
                        className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${
                            privacyMode === 'baseline' 
                            ? 'bg-white text-blue-600 shadow' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Baseline
                    </button>
                    <button
                        onClick={() => setPrivacyMode('alpr')}
                        className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${
                            privacyMode === 'alpr' 
                            ? 'bg-white text-red-600 shadow' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        With ALPR
                    </button>
                </div>
                
                {!hasRunSimulation && (
                    <div className="text-[10px] text-slate-400 mt-1 italic text-center">
                        Run simulation to unlock
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrivacyControls;