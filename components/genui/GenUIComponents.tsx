
import React, { useState } from 'react';
import { 
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

// --- 1. Generative Chart Component ---
export const GenUIChart: React.FC<{ data: any }> = ({ data }) => {
    const { title, chartType, data: chartData, xAxisLabel } = data;
    
    return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 my-4 w-full h-80 min-w-[300px] shadow-lg animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-200">{title}</h4>
                <div className="px-2 py-1 bg-indigo-500/20 rounded text-[10px] text-indigo-300 font-mono">
                    AI Generated
                </div>
            </div>
            <ResponsiveContainer width="100%" height="90%">
                {chartType === 'line' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValueGen" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tick={{dy: 5}} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} 
                            itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#22d3ee" fillOpacity={1} fill="url(#colorValueGen)" strokeWidth={2} />
                    </AreaChart>
                ) : (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tick={{dy: 5}} label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        />
                        <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

// --- 2. Generative Checklist (Actionable) ---
interface ChecklistItem {
    task: string;
    priority: 'High' | 'Medium' | 'Low';
}

export const GenUIChecklist: React.FC<{ 
    data: { title: string, items: ChecklistItem[] };
    onAddToPlanner?: (items: { task: string, time: number, topic: string }[]) => void;
}> = ({ data, onAddToPlanner }) => {
    const { title, items } = data;
    const [checked, setChecked] = useState<Record<number, boolean>>({});
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        if (onAddToPlanner) {
            // Convert to planner format (heuristic: high priority = 60m, others 30m)
            const tasks = items.map(item => ({
                task: item.task,
                time: item.priority === 'High' ? 60 : 30,
                topic: title.split(':')[0] || 'General' // Simple heuristic for topic
            }));
            onAddToPlanner(tasks);
            setIsSaved(true);
        }
    };

    return (
        <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 my-4 shadow-xl backdrop-blur-sm animate-fade-in group hover:border-cyan-500/30 transition-colors">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <span className="text-lg">📋</span> {title}
                </h4>
                {onAddToPlanner && (
                    <button 
                        onClick={handleSave}
                        disabled={isSaved}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${isSaved ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg hover:shadow-cyan-500/20'}`}
                    >
                        {isSaved ? '✓ Added to Planner' : '+ Add All to Planner'}
                    </button>
                )}
            </div>
            <div className="space-y-2">
                {items.map((item, idx) => (
                    <div 
                        key={idx} 
                        className={`flex items-start gap-3 p-2 rounded-lg transition-all ${checked[idx] ? 'bg-slate-800/30 opacity-60' : 'bg-slate-800/60 hover:bg-slate-800'}`}
                    >
                        <input 
                            type="checkbox" 
                            checked={!!checked[idx]} 
                            onChange={() => setChecked(p => ({...p, [idx]: !p[idx]}))} 
                            className="mt-1 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-700 cursor-pointer"
                        />
                        <div className="flex-grow">
                            <p className={`text-sm font-medium transition-all ${checked[idx] ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                {item.task}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                    item.priority === 'High' ? 'bg-red-900/30 border-red-800 text-red-300' : 
                                    item.priority === 'Medium' ? 'bg-yellow-900/30 border-yellow-800 text-yellow-300' : 
                                    'bg-blue-900/30 border-blue-800 text-blue-300'
                                }`}>
                                    {item.priority}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 3. Generative Diagram (SVG Renderer) ---
export const GenUIDiagram: React.FC<{ data: any }> = ({ data }) => {
    const { title, svgContent, description } = data;
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-300 my-4 shadow-xl text-black animate-scale-in overflow-hidden">
            <h4 className="text-sm font-bold mb-2 text-center text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2">{title}</h4>
            <div 
                className="w-full flex justify-center my-4 overflow-x-auto" 
                dangerouslySetInnerHTML={{ __html: svgContent }} 
            />
            <p className="text-xs text-slate-600 text-center italic bg-slate-100 p-2 rounded-lg border border-slate-200">
                {description}
            </p>
        </div>
    );
};

// --- 4. Generative Mind Map (Tree) ---
const MindMapNode: React.FC<{ node: any; depth?: number }> = ({ node, depth = 0 }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    
    // Depth-based colors
    const colors = ['border-cyan-500 text-cyan-100', 'border-indigo-500 text-indigo-100', 'border-purple-500 text-purple-100', 'border-slate-500 text-slate-300'];
    const colorClass = colors[Math.min(depth, colors.length - 1)];

    return (
        <div className="flex flex-col items-center relative">
            <div 
                className={`
                    p-2 px-4 rounded-full border-2 text-sm font-bold cursor-pointer transition-all duration-300 
                    ${hasChildren ? 'hover:scale-105 shadow-lg' : 'opacity-90'}
                    ${hasChildren && expanded ? 'bg-slate-800' : 'bg-slate-900'}
                    ${colorClass}
                `} 
                onClick={() => setExpanded(!expanded)}
            >
                {node.label}
                {hasChildren && (
                    <span className="ml-2 text-[10px] opacity-70">{expanded ? '▼' : '▶'}</span>
                )}
            </div>
            
            {hasChildren && expanded && (
                <div className="flex gap-6 mt-6 relative animate-fade-in">
                    {/* Vertical Line from Parent */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-slate-600"></div>
                    
                    {/* Horizontal connector line container */}
                    <div className="absolute -top-3 left-0 right-0 h-px bg-slate-600" style={{
                        left: `calc(${100 / (node.children.length * 2)}%)`,
                        right: `calc(${100 / (node.children.length * 2)}%)`
                    }}></div>

                    {node.children.map((child: any, idx: number) => (
                        <div key={idx} className="relative pt-2">
                            {/* Vertical Line to Child */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-slate-600"></div>
                            <MindMapNode node={child} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const GenUIMindMap: React.FC<{ data: any }> = ({ data }) => { 
    const { root } = data; 
    return (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 my-4 overflow-x-auto shadow-inner min-h-[300px] flex justify-center items-center animate-scale-in">
            <MindMapNode node={root} />
        </div>
    ); 
};
