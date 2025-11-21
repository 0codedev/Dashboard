
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area, ScatterChart, Scatter, ReferenceLine, ComposedChart, ZAxis
} from 'recharts';
import { SUBJECT_CONFIG } from '../constants';
import CustomTooltip from './common/CustomTooltip';

// --- Tooltips ---
const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-3 bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 rounded-lg shadow-xl text-sm z-50">
                <p className="font-bold text-white mb-2">{data.subject}</p>
                <div className="space-y-1">
                    <p className="text-cyan-400 flex justify-between gap-4"><span>You:</span> <span>{data.A}</span></p>
                    <p className="text-yellow-400 flex justify-between gap-4"><span>Topper Est:</span> <span>{data.B}</span></p>
                    <p className="text-gray-500 flex justify-between gap-4"><span>Cohort Avg:</span> <span>{data.C}</span></p>
                </div>
            </div>
        );
    }
    return null;
};

const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-3 bg-slate-900/90 border border-slate-600 rounded-lg shadow-xl text-xs z-50 max-w-[200px]">
                <p className="font-bold text-white mb-1 truncate">{data.topic}</p>
                <span className={`inline-block px-2 py-0.5 rounded mb-2 text-[10px] font-semibold ${data.quadrant === 'Quick Wins' ? 'bg-green-900 text-green-300' :
                    data.quadrant === 'Big Bets' ? 'bg-amber-900 text-amber-300' :
                        data.quadrant === 'Maintenance' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-400'
                    }`}>{data.quadrant}</span>

                <div className="space-y-1">
                    <p className="text-gray-400 flex justify-between"><span>Impact:</span> <span className="text-white">{data.impact.toFixed(0)}</span></p>
                    <p className="text-gray-400 flex justify-between"><span>Effort:</span> <span className="text-white">{data.effort.toFixed(1)}</span></p>
                    <p className="text-gray-500 italic mt-1">Click to focus on this topic</p>
                </div>
            </div>
        );
    }
    return null;
};

// --- Widgets ---

export const PaperStrategyWidget: React.FC<{ 
    historicalAccuracy: { physics: number, chemistry: number, maths: number },
    userTargetTimes?: { physics: number, chemistry: number, maths: number } 
}> = ({ historicalAccuracy, userTargetTimes }) => {
    const [examType, setExamType] = useState<'mains' | 'advanced'>('mains');
    // Default Strategy: 60 mins each if no user setting
    const [timeAlloc, setTimeAlloc] = useState({ 
        physics: 60, 
        chemistry: 60, 
        maths: 60 
    });
    const [attemptTarget, setAttemptTarget] = useState({ physics: 20, chemistry: 20, maths: 15 });

    useEffect(() => {
        if (examType === 'mains') {
            // Mains: 25 attempts is max to score (out of 30 available)
            setAttemptTarget({ physics: 20, chemistry: 20, maths: 15 });
        } else {
            // Advanced: ~18-20 q total per subject, usually 60 marks
            setAttemptTarget({ physics: 12, chemistry: 12, maths: 8 });
        }
    }, [examType]);

    const maxAttempts = examType === 'mains' ? 25 : 18; // Cap sliders

    const stats = useMemo(() => {
        const subjects = ['physics', 'chemistry', 'maths'] as const;
        let totalScore = 0;
        let maxPotential = 0;
        
        // Safe defaults if user profile not set
        const safeTargetTimes: { physics: number; chemistry: number; maths: number } = userTargetTimes || { physics: 120, chemistry: 60, maths: 150 }; // Defaults in seconds

        const subjectStats = subjects.map(sub => {
            const time = timeAlloc[sub];
            const attempts = attemptTarget[sub];
            const timePerQ = attempts > 0 ? time / attempts : 0; // in minutes
            
            // Panic Factor: Logic updated to use user-defined targets (converted to minutes)
            const panicThreshold = safeTargetTimes[sub] / 60; 
            
            let panicFactor = 1;
            if (timePerQ < panicThreshold) {
                // Linearly decay accuracy if rushing below target
                panicFactor = Math.max(0.5, timePerQ / panicThreshold);
            }

            const baseAcc = (historicalAccuracy[sub] || 50) / 100;
            const effectiveAcc = baseAcc * panicFactor;
            
            const expectedCorrect = attempts * effectiveAcc;
            const expectedWrong = attempts * (1 - effectiveAcc);
            
            // Score Calc: +4, -1 logic
            // Mains: 4/-1. Advanced: Varies, but often 3/-1 or 4/-1. Using 4/-1 as base for simulation.
            // For Advanced (Total ~180), typical max mark per question is ~3 or 4. 
            // If Total is 180 for 54 questions -> ~3.33 marks/q. Let's use +4/-1 for Mains, +3/-1 for Advanced estimation.
            const marksPerCorrect = examType === 'mains' ? 4 : 3;
            const marksPerWrong = 1;

            const score = (expectedCorrect * marksPerCorrect) - (expectedWrong * marksPerWrong); 
            
            totalScore += score;
            maxPotential += attempts * marksPerCorrect;

            return {
                subject: sub,
                score: Math.round(score),
                timePerQ: timePerQ.toFixed(1),
                panicFactor: Math.round((1 - panicFactor) * 100), // % drop due to panic
                targetTime: panicThreshold.toFixed(1)
            };
        });

        return { totalScore: Math.round(totalScore), maxPotential, subjectStats };
    }, [timeAlloc, attemptTarget, historicalAccuracy, userTargetTimes, examType]);

    const totalTime: number = (Object.values(timeAlloc) as number[]).reduce((a, b) => a + b, 0);
    
    const handleTimeChange = (sub: string, val: number) => setTimeAlloc(p => ({...p, [sub]: val}));
    const handleAttemptChange = (sub: string, val: number) => setAttemptTarget(p => ({...p, [sub]: val}));

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setExamType('mains')} 
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${examType === 'mains' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-400'}`}
                    >
                        Mains (300)
                    </button>
                    <button 
                        onClick={() => setExamType('advanced')} 
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${examType === 'advanced' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-400'}`}
                    >
                        Adv (180)
                    </button>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Projected Score</p>
                    <p className="text-2xl font-bold text-cyan-300 tabular-nums">{stats.totalScore} <span className="text-xs text-gray-500 font-normal">/ {examType === 'mains' ? '300' : '180'}</span></p>
                </div>
            </div>
            
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                {stats.subjectStats.map(stat => (
                    <div key={stat.subject} className="bg-slate-900/50 p-2 rounded border border-slate-700 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="capitalize font-semibold text-gray-300 text-sm">{stat.subject}</span>
                            <span className={`text-xs px-1.5 rounded ${stat.panicFactor > 10 ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                                {stat.timePerQ} m/Q
                            </span>
                        </div>
                        
                        <div>
                            <label className="text-[10px] text-gray-500 flex justify-between"><span>Time (min)</span> <span>{timeAlloc[stat.subject as keyof typeof timeAlloc]}</span></label>
                            <input 
                                type="range" min="0" max="120" step="5" 
                                value={timeAlloc[stat.subject as keyof typeof timeAlloc]} 
                                onChange={(e) => handleTimeChange(stat.subject, parseInt(e.target.value))} 
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-primary-rgb))]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 flex justify-between"><span>Attempts</span> <span>{attemptTarget[stat.subject as keyof typeof attemptTarget]}</span></label>
                            <input 
                                type="range" min="0" max={maxAttempts} step="1" 
                                value={attemptTarget[stat.subject as keyof typeof attemptTarget]} 
                                onChange={(e) => handleAttemptChange(stat.subject, parseInt(e.target.value))} 
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--color-primary-rgb))]"
                            />
                        </div>
                         <div className="flex justify-between items-end pt-1">
                             <div className="text-[10px] text-gray-400">
                                 Est. Score: <span className="text-white font-bold">{stat.score}</span>
                             </div>
                             {stat.panicFactor > 0 ? (
                                <span className="text-[9px] text-red-400 animate-pulse" title={`Target: >${stat.targetTime}m`}>Panic: -{stat.panicFactor}% acc</span>
                             ) : (
                                <span className="text-[9px] text-gray-500" title={`Target: >${stat.targetTime}m`}>Pace: OK</span>
                             )}
                         </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>Total Time: <span className={`${totalTime > 180 ? 'text-red-400' : 'text-green-400'}`}>{totalTime}/180m</span></span>
                <span>Adjust targets in Settings.</span>
            </div>
        </div>
    );
};


export const StrategicROIWidget: React.FC<{ data: any[], onPointClick: (topic: string) => void }> = ({ data, onPointClick }) => (
    <div className="h-full w-full flex flex-col">
        <div className="flex justify-between items-center px-4 pb-2 text-xs text-gray-400">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span>Quick Wins</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Big Bets</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Maintenance</div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" dataKey="effort" name="Effort" unit="" stroke="#9CA3AF" label={{ value: 'Effort (Difficulty)', position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 10 }} domain={[0, 'auto']} />
                <YAxis type="number" dataKey="impact" name="Impact" unit="" stroke="#9CA3AF" label={{ value: 'Impact (Weightage)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }} domain={[0, 'auto']} />
                <ZAxis type="number" dataKey="bubbleSize" range={[60, 400]} name="Error Volume" />
                <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <ReferenceLine x={30} stroke="#4B5563" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#4B5563" strokeDasharray="3 3" />
                <Scatter name="Topics" data={data} onClick={(point) => onPointClick(point.topic)} cursor="pointer">
                    {data.map((entry, index) => {
                        let fill = '#6B7280';
                        if (entry.quadrant === 'Quick Wins') fill = '#10B981'; // Green
                        else if (entry.quadrant === 'Big Bets') fill = '#F59E0B'; // Amber
                        else if (entry.quadrant === 'Maintenance') fill = '#3B82F6'; // Blue
                        return <Cell key={`cell-${index}`} fill={fill} fillOpacity={0.7} stroke={fill} strokeWidth={1} />;
                    })}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    </div>
);

export const RankPredictorWidget: React.FC<{ rankPrediction: any, goalProbability: any }> = ({ rankPrediction, goalProbability }) => (
    <div className="h-full w-full flex flex-col">
        <div className="flex justify-between items-start mb-2 px-2">
            <div className="text-xs space-y-1">
                <p className="text-gray-400">Likely Range</p>
                <p className="text-white font-mono tabular-nums">{rankPrediction.bestCase.toLocaleString()} - {rankPrediction.worstCase.toLocaleString()}</p>
            </div>
            {goalProbability && (
                <div className="flex items-center gap-2 bg-slate-800/80 rounded-full px-3 py-1 border border-slate-700">
                    <div className="relative w-8 h-8">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#374151" strokeWidth="4" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={goalProbability.probability > 50 ? '#10B981' : '#F59E0B'} strokeWidth="4" strokeDasharray={`${goalProbability.probability}, 100`} />
                        </svg>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-white tabular-nums">{goalProbability.probability}%</p>
                        <p className="text-[9px] text-gray-400">Chance for {goalProbability.text}</p>
                    </div>
                </div>
            )}
        </div>
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rankPrediction.distribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="rankGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.0} />
                        <stop offset="20%" stopColor="#22d3ee" stopOpacity={0.1} />
                        <stop offset="50%" stopColor="#22d3ee" stopOpacity={0.5} />
                        <stop offset="80%" stopColor="#22d3ee" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.0} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="rank"
                    reversed={true}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    tickCount={7}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip label="Predicted Rank" />} />
                <ReferenceLine x={rankPrediction.likely} stroke="#ffffff" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Likely', position: 'top', fill: '#fff', fontSize: 10 }} />
                {/* Smoothed curve using type="basis" */}
                <Area type="basis" dataKey="probability" stroke="#22d3ee" fill="url(#rankGradient)" strokeWidth={2} />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

export const PercentilePredictorWidget: React.FC<{ percentileData: any }> = ({ percentileData }) => (
    <div className="h-full w-full flex flex-col">
        <div className="flex justify-around mb-2 text-center">
            <div>
                <p className="text-xs text-gray-400">Predicted Score</p>
                <p className="text-xl font-bold text-cyan-300 tabular-nums">{percentileData.predictedScore}</p>
            </div>
            <div>
                <p className="text-xs text-gray-400">Est. Percentile</p>
                <p className="text-xl font-bold text-amber-400 tabular-nums">{percentileData.predictedPercentile}%</p>
            </div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={percentileData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#9CA3AF" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip formatter={(val: number) => typeof val === 'number' ? val.toFixed(1) + '%' : val} />} />
                <Line yAxisId="left" type="monotone" dataKey="percentile" name="Percentile" stroke="#818CF8" strokeWidth={2} dot={{ r: 4, fill: '#818CF8' }} activeDot={{ r: 6 }} />
                <Line yAxisId="left" type="monotone" dataKey="trendPercentile" name="Trend" stroke="#FBBF24" strokeDasharray="5 5" strokeWidth={2} dot={false} />
            </ComposedChart>
        </ResponsiveContainer>
    </div>
);

export const VolatilityWidget: React.FC<{ volatilityMetrics: any }> = ({ volatilityMetrics }) => (
    <div className="flex flex-col items-center justify-center h-full w-full relative">
        <div className="relative w-full h-full max-w-[240px] max-h-[240px]">
            <svg className="w-full h-full" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#374151" strokeWidth="2" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={parseFloat(volatilityMetrics.sharpeRatio) > 1 ? '#10B981' : '#FBBF24'} strokeWidth="2" strokeDasharray={`${Math.min(100, parseFloat(volatilityMetrics.sharpeRatio) * 30)}, 100`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white tabular-nums">{volatilityMetrics.sharpeRatio}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Sharpe Ratio</span>
            </div>
        </div>
        <div className="text-center absolute bottom-2">
            <p className={`text-sm font-bold ${volatilityMetrics.isTestingOutOfZone ? 'text-amber-400' : 'text-green-400'}`}>{volatilityMetrics.zoneMessage}</p>
            <p className="text-[10px] text-gray-500 tabular-nums">Std Dev: {volatilityMetrics.stdDev}</p>
        </div>
    </div>
);

export const PerformanceTrendWidget: React.FC<{ data: any[] }> = ({ data }) => (
    <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="testName" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="total.marks" name="Total Score" stroke={SUBJECT_CONFIG.total.color} strokeWidth={2} />
        </LineChart>
    </ResponsiveContainer>
);

export const SubjectComparisonWidget: React.FC<{ data: any[] }> = ({ data }) => (
    <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="testName" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9CA3AF" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="physics.marks" name="Physics" stackId="a" fill={SUBJECT_CONFIG.physics.color} />
            <Bar dataKey="chemistry.marks" name="Chemistry" stackId="a" fill={SUBJECT_CONFIG.chemistry.color} />
            <Bar dataKey="maths.marks" name="Maths" stackId="a" fill={SUBJECT_CONFIG.maths.color} />
        </BarChart>
    </ResponsiveContainer>
);

export const SubjectRadarWidget: React.FC<{ data: any[] }> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid gridType="polygon" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
                
                <Radar name="Cohort Avg" dataKey="C" stroke="#6b7280" strokeDasharray="3 3" fill="#6b7280" fillOpacity={0.1} />
                <Radar name="Topper Avg" dataKey="B" stroke="#f59e0b" strokeWidth={1} fill="#f59e0b" fillOpacity={0.1} />
                <Radar name="You" dataKey="A" stroke={SUBJECT_CONFIG.total.color} strokeWidth={2} fill={SUBJECT_CONFIG.total.color} fillOpacity={0.5} />
                
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Tooltip content={<CustomRadarTooltip />} cursor={false} />
            </RadarChart>
        </ResponsiveContainer>
    );
};

export const CalendarHeatmapWidget: React.FC<{ reports: any[] }> = ({ reports }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const newWidth = entries[0].contentRect.width;
                // Add tolerance to prevent infinite loops on sub-pixel rendering differences
                setContainerWidth(prev => Math.abs(prev - newWidth) > 1 ? newWidth : prev);
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const { days, monthLabels, maxScore, cellSize, cellGap } = useMemo(() => {
        const dataMap = new Map<string, { count: number; totalScore: number }>();
        reports.forEach(report => {
            const date = new Date(report.testDate + "T00:00:00").toISOString().split('T')[0];
            const existing = dataMap.get(date) || { count: 0, totalScore: 0 };
            existing.count++;
            existing.totalScore += report.total.marks;
            dataMap.set(date, existing);
        });

        let maxScore = 0;
        for (const value of dataMap.values()) {
            const avgScore = value.totalScore / value.count;
            if (avgScore > maxScore) maxScore = avgScore;
        }

        // Align start date to the previous Monday to ensure grid alignment
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 365);
        
        // Adjust startDate to the nearest previous Monday
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        startDate.setDate(diff);

        const days = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const data = dataMap.get(dateStr);
            days.push({ date: new Date(d), data: data ? { ...data, avgScore: data.totalScore / data.count } : null });
        }

        const WEEKS_IN_YEAR = 53;
        const cellGap = 2;
        const PADDING_LEFT = 32;
        const calculatedCellSize = containerWidth > 0 ? Math.max(1, Math.floor((containerWidth - PADDING_LEFT) / WEEKS_IN_YEAR) - cellGap) : 12;

        const monthLabels = [];
        let lastMonth = -1;
        for (let i = 0; i < Math.ceil(days.length / 7); i++) {
            const firstDayOfWeek = days[i * 7]?.date;
            if (firstDayOfWeek) {
                const month = firstDayOfWeek.getMonth();
                if (month !== lastMonth && (monthLabels.length === 0 || i > monthLabels[monthLabels.length - 1].weekIndex + 2)) {
                    monthLabels.push({ month: firstDayOfWeek.toLocaleString('default', { month: 'short' }), weekIndex: i });
                    lastMonth = month;
                }
            }
        }
        return { days, monthLabels, maxScore: maxScore > 0 ? maxScore : 100, cellSize: calculatedCellSize, cellGap };
    }, [reports, containerWidth]);

    const getColorClass = (score: number | undefined) => {
        if (score === undefined || score === null) return 'bg-slate-700/50';
        const percentage = Math.max(0, score) / maxScore;
        if (percentage === 0) return 'bg-slate-700'; if (percentage < 0.25) return 'bg-[rgba(var(--color-primary-rgb),0.2)]';
        if (percentage < 0.5) return 'bg-[rgba(var(--color-primary-rgb),0.4)]'; if (percentage < 0.75) return 'bg-[rgba(var(--color-primary-rgb),0.7)]';
        return 'bg-[rgb(var(--color-primary-rgb))]';
    };

    return (
        <div className="flex flex-col h-full" ref={containerRef}>
            <div className="relative h-5 mb-1" style={{ paddingLeft: '32px' }}>
                {monthLabels.map(({ month, weekIndex }) => <div key={`${month}-${weekIndex}`} className="absolute text-xs text-gray-400" style={{ left: `${weekIndex * (cellSize + cellGap)}px` }}>{month}</div>)}
            </div>
            <div className="flex">
                <div className="flex flex-col justify-around text-xs text-gray-400 pr-2" style={{ height: `${7 * (cellSize + cellGap) - cellGap}px` }}>
                    <span className="h-full flex items-center">M</span>
                    <span className="h-full flex items-center">W</span>
                    <span className="h-full flex items-center">F</span>
                </div>
                <div className="grid grid-flow-col grid-rows-7" style={{ gap: `${cellGap}px` }}>
                    {days.map((day, index) => (
                        <div key={index} className="group relative" style={{ width: `${cellSize}px`, height: `${cellSize}px` }}>
                            <div className={`w-full h-full rounded-sm ${getColorClass(day.data?.avgScore)}`}></div>
                            {day.date && <div className="absolute z-10 hidden group-hover:block bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 text-xs text-white bg-slate-900/80 backdrop-blur-sm border border-slate-600 rounded-md shadow-lg w-max"><p className="font-bold">{day.date.toLocaleDateString()}</p><p>{day.data ? `${day.data.avgScore.toFixed(1)} score (${day.data.count} test${day.data.count > 1 ? 's' : ''})` : 'No tests'}</p></div>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-end items-center gap-2 text-xs text-gray-400 mt-2 flex-grow">
                <span>Less</span><div className="w-3.5 h-3.5 rounded-sm bg-slate-700/50"></div><div className="w-3.5 h-3.5 rounded-sm bg-[rgba(var(--color-primary-rgb),0.2)]"></div><div className="w-3.5 h-3.5 rounded-sm bg-[rgba(var(--color-primary-rgb),0.4)]"></div><div className="w-3.5 h-3.5 rounded-sm bg-[rgba(var(--color-primary-rgb),0.7)]"></div><div className="w-3.5 h-3.5 rounded-sm bg-[rgb(var(--color-primary-rgb))]"></div><span>More</span>
            </div>
        </div>
    );
};
