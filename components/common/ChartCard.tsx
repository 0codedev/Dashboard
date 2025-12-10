
import React from 'react';

interface ChartCardProps {
    title: React.ReactNode;
    children: React.ReactNode;
    isEditing?: boolean;
    isDragging?: boolean;
    onChartClick?: () => void;
    actionButton?: React.ReactNode;
    onInfoClick?: () => void;
    headerControls?: React.ReactNode;
    onHide?: () => void;
    onResize?: () => void;
    className?: string;
    insightText?: string;
    isInsightLoading?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export const ChartCard: React.FC<ChartCardProps> = ({ 
    title, 
    children, 
    isEditing, 
    isDragging, 
    onChartClick, 
    actionButton, 
    onInfoClick, 
    headerControls, 
    onHide, 
    onResize, 
    className, 
    insightText, 
    isInsightLoading, 
    onMouseEnter, 
    onMouseLeave 
}) => {
    return (
        <div
            className={`bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col h-full transition-all duration-300 relative ${isDragging ? 'shadow-[rgba(var(--color-primary-rgb),0.5)] opacity-50' : ''} ${!isEditing && onChartClick ? 'cursor-pointer hover:shadow-[rgba(var(--color-primary-rgb),0.2)] hover:-translate-y-1' : ''} ${isEditing ? 'ring-2 ring-dashed ring-slate-500 cursor-move' : ''} ${className || ''}`}
            onClick={() => { if (!isEditing && onChartClick) onChartClick(); }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
             {isEditing && (
                <div className="absolute inset-0 z-20 bg-slate-900/60 flex flex-col items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg backdrop-blur-sm">
                    <div className="flex gap-2">
                            {onResize && (
                            <button onClick={(e) => { e.stopPropagation(); onResize(); }} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full shadow-lg transition-colors" title="Toggle Size">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg>
                            </button>
                        )}
                        {onHide && (
                            <button onClick={(e) => { e.stopPropagation(); onHide(); }} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors" title="Hide Widget">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                            </button>
                        )}
                    </div>
                    <span className="text-white font-semibold bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-600">Drag to Move</span>
                </div>
            )}

            <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[rgb(var(--color-primary))]">
                        {title}
                    </h3>
                    {onInfoClick && !isEditing && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onInfoClick(); }} 
                            className="text-gray-400 hover:text-white transition-colors"
                            title="What is this?"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {headerControls && !isEditing && <div onClick={e => e.stopPropagation()}>{headerControls}</div>}
                    {actionButton && !isEditing && <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>{actionButton}</div>}
                </div>
            </div>
            <div className="flex-grow h-full relative min-h-0 flex flex-col" onClick={e => e.stopPropagation()}>
                {children}
                {(insightText || isInsightLoading) && (
                  <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg animate-fade-in transition-opacity z-10 pointer-events-none">
                    {isInsightLoading ? (
                      <div className="flex items-center gap-2 text-indigo-300">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      <p className="text-sm text-indigo-200 text-center"><span className="font-bold">💡 AI Insight:</span> {insightText}</p>
                    )}
                  </div>
                )}
            </div>
        </div>
    );
};
