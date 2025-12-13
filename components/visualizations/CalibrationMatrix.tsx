
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Cell } from 'recharts';
import { QuestionLog, QuestionStatus } from '../../types';

interface CalibrationMatrixProps {
    logs: QuestionLog[];
}

export const CalibrationMatrix: React.FC<CalibrationMatrixProps> = ({ logs }) => {
    const data = useMemo(() => {
        const topicStats = new Map<string, { correct: number, attempts: number, totalConfidence: number }>();
        
        logs.forEach(log => {
            // Filter logs that have topic and explicit confidence set (or assume 50 if missing but want to plot?) 
            // Better to only plot logs where confidence was recorded to be accurate.
            if (!log.topic || log.topic === 'N/A' || log.confidence === undefined) return;
            
            const existing = topicStats.get(log.topic) || { correct: 0, attempts: 0, totalConfidence: 0 };
            existing.attempts++;
            existing.totalConfidence += log.confidence;
            
            if (log.status === QuestionStatus.FullyCorrect) {
                existing.correct++;
            } else if (log.status === QuestionStatus.PartiallyCorrect) {
                existing.correct += 0.5; // Partial credit logic
            }
            
            topicStats.set(log.topic, existing);
        });

        return Array.from(topicStats.entries())
            .map(([topic, stats]) => ({
                topic,
                accuracy: (stats.correct / stats.attempts) * 100,
                avgConfidence: stats.totalConfidence / stats.attempts,
                attempts: stats.attempts
            }))
            .filter(d => d.attempts >= 3); // Min attempts threshold to reduce noise
    }, [logs]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const calibration = data.avgConfidence - data.accuracy;
            let status = 'Calibrated';
            let color = 'text-green-400';
            
            if (calibration > 20) { status = 'Overconfident (Blind Spot)'; color = 'text-red-400'; }
            else if (calibration < -20) { status = 'Underconfident (Imposter)'; color = 'text-yellow-400'; }

            return (
                <div className="bg-slate-900 border border-slate-600 p-3 rounded-lg shadow-xl text-xs z-50">
                    <p className="font-bold text-white mb-1">{data.topic}</p>
                    <p className="text-gray-400">Attempts: {data.attempts}</p>
                    <div className="my-2 h-px bg-slate-700"></div>
                    <p>Confidence: <span className="text-white">{data.avgConfidence.toFixed(0)}%</span></p>
                    <p>Competence: <span className="text-white">{data.accuracy.toFixed(0)}%</span></p>
                    <p className={`mt-2 font-bold ${color}`}>{status}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center px-4 py-2 text-[10px] text-gray-500 bg-slate-900/30 rounded-t-lg">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Blind Spot (High Conf, Low Skill)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Mastery (High Conf, High Skill)</span>
                </div>
                <div className="flex gap-4">
                     <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Awareness (Low Conf, Low Skill)</span>
                     <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Imposter (Low Conf, High Skill)</span>
                </div>
            </div>
            
            <div className="flex-grow min-h-0 bg-slate-800/20">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        
                        <XAxis 
                            type="number" 
                            dataKey="accuracy" 
                            name="Competence" 
                            unit="%" 
                            domain={[0, 100]} 
                            stroke="#9CA3AF"
                            label={{ value: 'Competence (Actual Accuracy)', position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 10 }} 
                        />
                        
                        <YAxis 
                            type="number" 
                            dataKey="avgConfidence" 
                            name="Confidence" 
                            unit="%" 
                            domain={[0, 100]} 
                            stroke="#9CA3AF"
                            label={{ value: 'Confidence (Self-Assessment)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }} 
                        />
                        
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        
                        {/* Quadrant Dividers */}
                        <ReferenceLine x={50} stroke="#4B5563" strokeDasharray="3 3" />
                        <ReferenceLine y={50} stroke="#4B5563" strokeDasharray="3 3" />

                        {/* Quadrant Labels */}
                        <ReferenceLine x={25} y={85} stroke="none" label={{ value: "BLIND SPOT", fill: '#EF4444', fontSize: 12, opacity: 0.3, fontWeight: 'bold' }} />
                        <ReferenceLine x={75} y={85} stroke="none" label={{ value: "MASTERY", fill: '#10B981', fontSize: 12, opacity: 0.3, fontWeight: 'bold' }} />
                        <ReferenceLine x={25} y={15} stroke="none" label={{ value: "AWARENESS", fill: '#6B7280', fontSize: 12, opacity: 0.3, fontWeight: 'bold' }} />
                        <ReferenceLine x={75} y={15} stroke="none" label={{ value: "IMPOSTER", fill: '#F59E0B', fontSize: 12, opacity: 0.3, fontWeight: 'bold' }} />

                        <Scatter name="Topics" data={data}>
                            {data.map((entry, index) => {
                                let fill = '#6B7280'; // Default gray
                                const conf = entry.avgConfidence;
                                const acc = entry.accuracy;
                                
                                if (conf > 50 && acc < 50) fill = '#EF4444'; // Red (Blind Spot)
                                else if (conf > 50 && acc >= 50) fill = '#10B981'; // Green (Mastery)
                                else if (conf <= 50 && acc >= 50) fill = '#F59E0B'; // Yellow (Imposter)
                                else fill = '#6B7280'; // Gray (Awareness)

                                return <Cell key={`cell-${index}`} fill={fill} stroke="white" strokeWidth={1} />;
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            {data.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-slate-900/50 backdrop-blur-sm z-10">
                    <p className="text-sm">Log confidence scores in Question Editor to enable this chart.</p>
                </div>
            )}
        </div>
    );
};
