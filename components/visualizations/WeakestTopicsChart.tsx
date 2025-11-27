
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { QuestionLog, QuestionStatus } from '../../types';

interface WeakestTopicsChartProps {
    data: { topic: string; count: number; subject: string }[];
    onClick: (topic: any) => void;
    totalErrorCount: number;
    logs: QuestionLog[];
    fitContainer?: boolean;
}

export const WeakestTopicsChart: React.FC<WeakestTopicsChartProps> = ({ onClick, logs, fitContainer = false }) => {
    const [metric, setMetric] = useState<string>('count');
    const [subjectFilter, setSubjectFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Maths'>('All');

    const processedData = useMemo(() => {
        // If in dashboard mode (fitContainer), always ignore subject filter (show Top 10 Global)
        // In modal mode, use the selected filter
        const effectiveSubjectFilter = fitContainer ? 'All' : subjectFilter;

        const allTopics = new Set(logs.map(l => l.topic).filter(t => t && t !== 'N/A'));
        
        let stats = Array.from(allTopics).map(topic => {
            const topicLogs = logs.filter(l => l.topic === topic);
            const attempts = topicLogs.length;
            const errors = topicLogs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect).length;
            const correct = topicLogs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
            const marks = topicLogs.reduce((sum, l) => sum + l.marksAwarded, 0);
            const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0;
            const avgMarks = attempts > 0 ? marks / attempts : 0;
            
            // Infer subject from logs
            const subjectLog = topicLogs.find(l => l.subject);
            const subject = subjectLog ? subjectLog.subject.charAt(0).toUpperCase() + subjectLog.subject.slice(1) : 'Unknown';
            
            return { topic, count: errors, attempts, accuracy, avgMarks, totalMarks: marks, subject };
        });
        
        // Filter by subject if selected
        if (effectiveSubjectFilter !== 'All') {
            stats = stats.filter(s => s.subject.toLowerCase() === effectiveSubjectFilter.toLowerCase());
        }

        // Sort based on metric
        const sorted = stats.sort((a, b) => {
            if (metric === 'count') return b.count - a.count;
            if (metric === 'accuracy') {
                // For accuracy, we want lowest first, but push 0 attempts/100% acc to bottom if needed?
                // Usually "Weakest" implies low accuracy.
                // If accuracy is equal, sort by count
                if (a.accuracy === b.accuracy) return b.count - a.count;
                return a.accuracy - b.accuracy;
            }
            if (metric === 'avgMarks') return a.avgMarks - b.avgMarks;
            return 0;
        });

        if (fitContainer) {
            // Limit to top 10 for compact, non-scroll view
            return sorted.slice(0, 10);
        }
        return sorted; // Return ALL chapters in modal mode
    }, [logs, metric, fitContainer, subjectFilter]);

    const currentMetricLabel = useMemo(() => { if (metric === 'count') return 'Error Count'; if (metric === 'accuracy') return 'Accuracy (%)'; if (metric === 'avgMarks') return 'Avg Marks'; return 'Value'; }, [metric]);

    // Calculate height for vertical scrolling only if not fitting to container
    const chartHeight = fitContainer ? '100%' : Math.max(processedData.length * 40, 400);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 px-1 pt-1">
                 {/* Subject Toggle only visible in Modal Mode (when fitContainer is false) */}
                 {!fitContainer ? (
                     <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                        {['All', 'Physics', 'Chemistry', 'Maths'].map(sub => (
                            <button 
                                key={sub}
                                onClick={() => setSubjectFilter(sub as any)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${subjectFilter === sub ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700'}`}
                            >
                                {sub}
                            </button>
                        ))}
                     </div>
                 ) : <div></div>}

                 <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 font-medium">Metric:</label>
                    <select value={metric} onChange={e => setMetric(e.target.value)} className="bg-slate-800 text-xs text-white p-1.5 rounded-md border border-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer">
                        <option value="count">Error Count</option>
                        <option value="accuracy">Lowest Accuracy</option>
                        <option value="avgMarks">Lowest Avg Marks</option>
                    </select>
                </div>
            </div>
            
            <div className={`flex-grow ${fitContainer ? 'overflow-hidden' : 'overflow-y-auto pr-2 custom-scrollbar'}`}>
                <div style={{ height: chartHeight, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart 
                            layout="vertical" 
                            data={processedData} 
                            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                            barCategoryGap={fitContainer ? 4 : 12}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} vertical={true} />
                            <XAxis type="number" stroke="#9CA3AF" hide />
                            <YAxis 
                                type="category" 
                                dataKey="topic" 
                                stroke="#9CA3AF" 
                                tick={{ fontSize: 11, fill: '#E5E7EB', fontWeight: 500 }} 
                                width={150} 
                                interval={0}
                            />
                            <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                content={({ active, payload }) => { 
                                    if (active && payload && payload.length) { 
                                        const d = payload[0].payload; 
                                        return ( 
                                            <div className="p-3 bg-slate-900/95 border border-slate-600 rounded-lg shadow-xl text-xs z-50 backdrop-blur-sm"> 
                                                <p className="font-bold text-white mb-1 text-sm">{d.topic}</p>
                                                <p className="text-xs text-gray-400 mb-2">{d.subject}</p>
                                                <div className="space-y-1">
                                                    <p className="text-cyan-300 flex justify-between gap-4"><span>{currentMetricLabel}:</span> <span className="font-mono font-bold">{typeof d[metric] === 'number' ? d[metric].toFixed(1) : d[metric]}</span></p>
                                                    {metric !== 'avgMarks' && <p className="text-gray-400 flex justify-between gap-4"><span>Avg Marks:</span> <span className="font-mono">{d.avgMarks.toFixed(1)}</span></p>}
                                                    {metric !== 'accuracy' && <p className="text-gray-400 flex justify-between gap-4"><span>Accuracy:</span> <span className="font-mono">{d.accuracy.toFixed(1)}%</span></p>}
                                                    {metric !== 'count' && <p className="text-gray-400 flex justify-between gap-4"><span>Errors:</span> <span className="font-mono">{d.count}</span></p>}
                                                </div>
                                            </div> 
                                        ); 
                                    } 
                                    return null; 
                                }} 
                            />
                            <Bar 
                                dataKey={metric} 
                                fill="#3b82f6" 
                                radius={[0, 4, 4, 0]} 
                                onClick={(d) => onClick(d)} 
                                cursor="pointer" 
                                barSize={fitContainer ? undefined : 24}
                                className="hover:opacity-80 transition-opacity"
                            >
                                <LabelList 
                                    dataKey={metric} 
                                    position="right" 
                                    fill="#9CA3AF" 
                                    fontSize={10} 
                                    formatter={(val: number) => typeof val === 'number' ? val.toFixed(metric === 'count' ? 0 : 1) : val} 
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
