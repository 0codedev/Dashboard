
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { QuestionLog, TestReport, PanicEvent, DependencyAlert, GuessStats } from '../types';
import { ErrorReason, QuestionStatus, QuestionType, TestType, TestSubType } from '../types';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine, ScatterChart,
    Scatter, Label, Sector, Line, LabelList, Rectangle, AreaChart, Area, Sankey, ComposedChart, Brush, ZAxis
} from 'recharts';
import { getAIChiefAnalystSummary } from '../services/geminiService';
import { useRootCauseAnalytics } from '../hooks/useRootCauseAnalytics';
import CustomTooltip from './common/CustomTooltip';
import Modal from './common/Modal';
import { JEE_SYLLABUS, SUBJECT_COLORS } from '../constants';
import { DynamicKnowledgeGraph } from './visualizations/DynamicKnowledgeGraph';
import { WeakestTopicsChart } from './visualizations/WeakestTopicsChart';
import { ExecutiveBriefing } from './visualizations/ExecutiveBriefing';
import { getMarkingScheme } from '../utils/metrics';
import { Button } from './common/Button';
import { MarkdownRenderer } from './common/MarkdownRenderer';

interface RootCauseProps {
  logs: QuestionLog[];
  reports: TestReport[];
  rootCauseFilter: { subject?: string | null };
  setRootCauseFilter: (filter: { subject?: string | null }) => void;
  apiKey: string;
  modelName?: string;
  onAddTask?: (task: { task: string; time: number; topic: string }) => void;
}

type WidgetId = 'conceptualKnowledgeGraph' | 'weakestTopics' | 'errorReason' | 'questionType' | 'scoreContribution' | 'lostMarksWaterfall' | 'metricScatterPlot' | 'errorTrend' | 'fatigueAnalysis' | 'errorFlowSankey' | 'paretoAnalysis' | 'errorReasonsBySubject' | 'speedVsAccuracy' | 'weakestTopics_full' | 'panicAnalysis' | 'guessingGame' | 'scoreSimulator' | 'dependencyAlerts';

interface WidgetLayout {
    id: WidgetId;
    visible: boolean;
    size: 'normal' | 'wide';
}

type ModalType = 'errorReasonDetail' | 'topicDetail' | 'widget' | 'simulator' | 'info';

interface ModalData {
    type: ModalType;
    title: string;
    widgetId?: WidgetId;
    drillDownKey?: string;
    simulatorData?: any;
    infoContent?: React.ReactNode;
}

const DEFAULT_ROOT_CAUSE_LAYOUT: WidgetLayout[] = [
    { id: 'scoreSimulator', visible: true, size: 'wide' },
    { id: 'panicAnalysis', visible: true, size: 'normal' },
    { id: 'dependencyAlerts', visible: true, size: 'normal' },
    { id: 'conceptualKnowledgeGraph', visible: true, size: 'wide' },
    { id: 'weakestTopics', visible: true, size: 'wide' },
    { id: 'lostMarksWaterfall', visible: true, size: 'wide' },
    { id: 'speedVsAccuracy', visible: true, size: 'wide' },
    { id: 'errorReasonsBySubject', visible: true, size: 'normal' },
    { id: 'metricScatterPlot', visible: true, size: 'normal' },
    { id: 'scoreContribution', visible: true, size: 'normal' },
    { id: 'errorFlowSankey', visible: true, size: 'wide' },
    { id: 'paretoAnalysis', visible: true, size: 'wide' },
    { id: 'errorTrend', visible: true, size: 'wide' },
    { id: 'fatigueAnalysis', visible: true, size: 'normal' },
    { id: 'errorReason', visible: true, size: 'normal' },
    { id: 'guessingGame', visible: true, size: 'normal' }, // Now larger visually but same slot
    { id: 'questionType', visible: false, size: 'normal' },
];

// ... (Colors and Chart Components omitted for brevity, identical to existing file)

const COLORS_PIE: Record<string, string> = {
    [ErrorReason.ConceptualGap]: '#FBBF24', // amber-400
    [ErrorReason.MisreadQuestion]: '#34D399', // emerald-400
    [ErrorReason.SillyMistake]: '#F87171', // red-400
    [ErrorReason.TimePressure]: '#818CF8', // indigo-400
    [ErrorReason.Guess]: '#A78BFA', // violet-400
};

// Pastel Palette for Waterfall
const PASTEL_COLORS: Record<string, string> = {
    [ErrorReason.SillyMistake]: '#fda4af', // rose-300
    [ErrorReason.ConceptualGap]: '#fcd34d', // amber-300
    [ErrorReason.TimePressure]: '#a5b4fc', // indigo-300
    [ErrorReason.MisreadQuestion]: '#fdba74', // orange-300
    [ErrorReason.Guess]: '#99f6e4', // teal-300
    'Unattempted': '#94a3b8', // slate-400
    'Partial Loss': '#f0abfc', // fuchsia-300
    'Actual': '#34d399', // emerald-400
    'Potential': '#64748b' // slate-500
};

// ... [Child Components (Charts) like ScoreContributionWidget, etc. remain unchanged]

const ScoreContributionWidget: React.FC<{ reports: TestReport[] }> = ({ reports }) => {
    const [localTestId, setLocalTestId] = useState('all');

    const data = useMemo(() => {
        let relevantReports = reports;
        if (localTestId !== 'all') {
            relevantReports = reports.filter(r => r.id === localTestId);
        }

        if (relevantReports.length === 0) return [];

        const totals = relevantReports.reduce((acc, r) => {
            acc.physics += r.physics.marks;
            acc.chemistry += r.chemistry.marks;
            acc.maths += r.maths.marks;
            return acc;
        }, { physics: 0, chemistry: 0, maths: 0 });

        const totalScore = totals.physics + totals.chemistry + totals.maths;
        if (totalScore === 0) return [];

        return [
            { name: 'Physics', value: totals.physics, color: SUBJECT_COLORS.physics },
            { name: 'Chemistry', value: totals.chemistry, color: SUBJECT_COLORS.chemistry },
            { name: 'Maths', value: totals.maths, color: SUBJECT_COLORS.maths },
        ];
    }, [reports, localTestId]);

    return (
        <div className="flex flex-col h-full relative">
             <div className="absolute top-0 left-0 right-0 flex justify-center z-10">
                <select 
                    value={localTestId} 
                    onChange={e => setLocalTestId(e.target.value)} 
                    className="bg-slate-800/80 backdrop-blur-sm text-xs py-1 px-3 rounded-full border border-slate-600 text-center focus:ring-1 focus:ring-[rgb(var(--color-primary-rgb))] shadow-lg hover:bg-slate-700 transition-colors cursor-pointer max-w-[200px] truncate"
                    onClick={e => e.stopPropagation()}
                >
                    <option value="all">Avg (All Tests)</option>
                    {reports.map(r => <option key={r.id} value={r.id}>{r.testName}</option>).reverse()}
                </select>
            </div>
            <div className="flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="55%"
                            innerRadius="55%"
                            outerRadius="75%"
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <Label 
                                value={`${data.reduce((sum, item) => sum + item.value, 0).toFixed(0)}`} 
                                position="center" 
                                className="fill-white text-2xl font-bold" 
                            />
                             <Label 
                                value="Marks" 
                                position="center" 
                                dy={20}
                                className="fill-gray-400 text-xs" 
                            />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ... [SpeedVsAccuracyWidget, MetricScatterWidget, ErrorReasonsBySubjectWidget, InteractiveSankeyNode, InteractiveSankeyLink, SankeyWidget, StatusBadge, PanicAnalysisWidget, GuessingWidget, ScoreSimulatorWidget, DependencyAlertsWidget, AIChiefAnalyst, ErrorReasonPieChart, LostMarksWaterfall, ChartCard, DrillDownModal are unchanged but re-included logic for brevity if needed]
// ... (For full file replacement, these components would need to be present)

const SpeedVsAccuracyWidget: React.FC<{ logs: QuestionLog[] }> = ({ logs }) => {
    const data = useMemo(() => {
        const topicStats = new Map<string, { correct: number, attempts: number, time: number }>();
        
        logs.forEach(log => {
            if (!log.topic || log.topic === 'N/A') return;
            const existing = topicStats.get(log.topic) || { correct: 0, attempts: 0, time: 0 };
            existing.attempts++;
            if (log.status === QuestionStatus.FullyCorrect) existing.correct++;
            const estimatedTime = log.timeSpent || (log.questionType.includes("Single Correct") ? 120 : 180); 
            existing.time += estimatedTime;
            topicStats.set(log.topic, existing);
        });

        return Array.from(topicStats.entries()).map(([topic, stats]) => ({
            topic,
            accuracy: (stats.correct / stats.attempts) * 100,
            avgTime: stats.time / stats.attempts,
            attempts: stats.attempts
        })).filter(d => d.attempts >= 2);
    }, [logs]);

    const avgAcc = data.reduce((acc, d) => acc + d.accuracy, 0) / (data.length || 1);
    const avgTime = data.reduce((acc, d) => acc + d.avgTime, 0) / (data.length || 1);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center px-4 text-xs text-gray-400">
                <div>X: Time Spent (s) | Y: Accuracy (%)</div>
                <div className="flex gap-2">
                    <span className="text-green-400">Top-Left: Mastery</span>
                    <span className="text-red-400">Bottom-Right: Gap</span>
                </div>
            </div>
            <div className="flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" dataKey="avgTime" name="Time" unit="s" stroke="#9CA3AF" domain={['auto', 'auto']} label={{ value: 'Avg Time (sec)', position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 10 }}/>
                        <YAxis type="number" dataKey="accuracy" name="Accuracy" unit="%" stroke="#9CA3AF" domain={[0, 100]} label={{ value: 'Accuracy', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }}/>
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-slate-900/90 border border-slate-600 p-2 rounded shadow text-xs z-50">
                                        <p className="font-bold text-white">{d.topic}</p>
                                        <p>Accuracy: {d.accuracy.toFixed(1)}%</p>
                                        <p>Time: {d.avgTime.toFixed(0)}s</p>
                                        <p className="text-gray-400 mt-1">({d.attempts} attempts)</p>
                                    </div>
                                );
                            }
                            return null;
                        }}/>
                        <ReferenceLine x={avgTime} stroke="#64748B" strokeDasharray="3 3" />
                        <ReferenceLine y={avgAcc} stroke="#64748B" strokeDasharray="3 3" />
                        <Scatter name="Topics" data={data} fill="#8884d8">
                            {data.map((entry, index) => {
                                let fill = '#9CA3AF';
                                if (entry.accuracy > avgAcc && entry.avgTime < avgTime) fill = '#10B981';
                                else if (entry.accuracy > avgAcc && entry.avgTime >= avgTime) fill = '#FBBF24';
                                else if (entry.accuracy <= avgAcc && entry.avgTime < avgTime) fill = '#F87171';
                                else fill = '#EF4444';
                                return <Cell key={`cell-${index}`} fill={fill} />;
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const MetricScatterWidget: React.FC<{ reports: TestReport[] }> = ({ reports }) => {
    const [xAxis, setXAxis] = useState('accuracy');
    const [yAxis, setYAxis] = useState('marks');
    const [visibleSubjects, setVisibleSubjects] = useState<Set<string>>(new Set(['Physics', 'Chemistry', 'Maths']));

    const metrics = [
        { value: 'marks', label: 'Marks' },
        { value: 'rank', label: 'Rank' },
        { value: 'accuracy', label: 'Accuracy (%)' },
        { value: 'attemptRate', label: 'Attempt Rate (%)' },
        { value: 'negative', label: 'Negative Marks' },
        { value: 'cwRatio', label: 'Correct/Wrong Ratio' },
        { value: 'spaq', label: 'Score per Attempted Q' },
        { value: 'unattemptedPercent', label: 'Unattempted (%)' },
        { value: 'scorePotentialRealized', label: 'Score Potential Realized (%)' }
    ];

    const data = useMemo(() => {
        const points: any[] = [];
        reports.forEach(r => {
            ['physics', 'chemistry', 'maths'].forEach(subject => {
                // @ts-ignore
                const metricsData = r[`${subject}Metrics`];
                // @ts-ignore
                const rawData = r[subject];
                let xVal = 0, yVal = 0;
                const getValue = (metricKey: string) => {
                    if (metricKey === 'marks') return rawData.marks;
                    if (metricKey === 'rank') return rawData.rank;
                    if (metricKey === 'negative') return (rawData.wrong * -1);
                    return metricsData?.[metricKey] || 0;
                }
                xVal = getValue(xAxis);
                yVal = getValue(yAxis);
                const subjectCapitalized = subject.charAt(0).toUpperCase() + subject.slice(1);
                if (visibleSubjects.has(subjectCapitalized)) {
                    points.push({ x: xVal, y: yVal, subject: subjectCapitalized, test: r.testName });
                }
            });
        });
        return points;
    }, [reports, xAxis, yAxis, visibleSubjects]);

    const toggleSubject = (subject: string) => {
        setVisibleSubjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(subject)) newSet.delete(subject); else newSet.add(subject);
            return newSet;
        });
    };

    const { trendData, correlation } = useMemo(() => {
        if (data.length < 2) return { trendData: [], correlation: 0 };
        const n = data.length;
        const sumX = data.reduce((a, b) => a + b.x, 0);
        const sumY = data.reduce((a, b) => a + b.y, 0);
        const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
        const sumXX = data.reduce((a, b) => a + b.x * b.x, 0);
        const sumYY = data.reduce((a, b) => a + b.y * b.y, 0);
        const denominatorSlope = (n * sumXX - sumX * sumX);
        if (denominatorSlope === 0) return { trendData: [], correlation: 0 };
        const slope = (n * sumXY - sumX * sumY) / denominatorSlope;
        const intercept = (sumY - slope * sumX) / n;
        const minX = Math.min(...data.map(d => d.x));
        const maxX = Math.max(...data.map(d => d.x));
        const trendData = [{ x: minX, y: slope * minX + intercept }, { x: maxX, y: slope * maxX + intercept }];
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        return { trendData, correlation };
    }, [data]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-wrap justify-between items-center mb-2 gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-gray-200 max-w-[100px] truncate focus:ring-1 focus:ring-cyan-500">
                        {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <span className="text-gray-500 font-bold">vs</span>
                    <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-gray-200 max-w-[100px] truncate focus:ring-1 focus:ring-cyan-500">
                        {metrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div className="text-gray-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
                    Corr: <span className={`font-bold ${Math.abs(correlation) > 0.7 ? 'text-green-400' : Math.abs(correlation) > 0.4 ? 'text-yellow-400' : 'text-gray-200'}`}>{correlation.toFixed(2)}</span>
                </div>
            </div>
            <div className="flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" dataKey="x" name={xAxis} stroke="#9CA3AF" tick={{fontSize: 10}} domain={['auto', 'auto']} />
                        <YAxis type="number" dataKey="y" name={yAxis} stroke="#9CA3AF" tick={{fontSize: 10}} domain={['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-slate-900 border border-slate-600 p-2 rounded shadow text-xs z-50">
                                        <p className="font-bold text-white">{d.test}</p>
                                        <p style={{ color: SUBJECT_COLORS[d.subject.toLowerCase()] }}>{d.subject}</p>
                                        <p>X: {d.x.toFixed(1)}</p>
                                        <p>Y: {d.y.toFixed(1)}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}/>
                        <Scatter name="Physics" data={data.filter(d => d.subject === 'Physics')} fill={SUBJECT_COLORS.physics} shape="circle" />
                        <Scatter name="Chemistry" data={data.filter(d => d.subject === 'Chemistry')} fill={SUBJECT_COLORS.chemistry} shape="square" />
                        <Scatter name="Maths" data={data.filter(d => d.subject === 'Maths')} fill={SUBJECT_COLORS.maths} shape="triangle" />
                        {data.length > 1 && <Line dataKey="y" data={trendData} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} name="Trend" isAnimationActive={false} />}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-2 mt-2 pb-1">
                {['Physics', 'Chemistry', 'Maths'].map(subject => (
                    <button
                        key={subject}
                        onClick={() => toggleSubject(subject)}
                        className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border transition-all ${
                            visibleSubjects.has(subject) 
                            ? `bg-${subject === 'Physics' ? 'blue' : subject === 'Chemistry' ? 'green' : 'red'}-500/20 border-${subject === 'Physics' ? 'blue' : subject === 'Chemistry' ? 'green' : 'red'}-500 text-white shadow-[0_0_10px_rgba(0,0,0,0.3)]` 
                            : 'bg-slate-800 border-slate-700 text-gray-500 hover:bg-slate-700'
                        }`}
                        style={{ borderColor: visibleSubjects.has(subject) ? SUBJECT_COLORS[subject.toLowerCase()] : undefined, color: visibleSubjects.has(subject) ? SUBJECT_COLORS[subject.toLowerCase()] : undefined }}
                    >
                        {subject}
                    </button>
                ))}
            </div>
        </div>
    );
};

const ErrorReasonsBySubjectWidget: React.FC<{ data: any[] }> = ({ data }) => {
    return (
        <div className="flex-grow min-h-0 h-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                    <Bar dataKey="physics" name="Physics" stackId="a" fill={SUBJECT_COLORS.physics} barSize={30} />
                    <Bar dataKey="chemistry" name="Chemistry" stackId="a" fill={SUBJECT_COLORS.chemistry} barSize={30} />
                    <Bar dataKey="maths" name="Maths" stackId="a" fill={SUBJECT_COLORS.maths} barSize={30} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const InteractiveSankeyNode = (props: any) => {
    const { x, y, width, height, payload, containerWidth, setActiveNode } = props;
    const isLeft = x < containerWidth / 2;
    const isRight = x > containerWidth / 2;
    let fill = '#818CF8'; 
    if (payload.name === 'Physics') fill = SUBJECT_COLORS.physics;
    if (payload.name === 'Chemistry') fill = SUBJECT_COLORS.chemistry;
    if (payload.name === 'Maths') fill = SUBJECT_COLORS.maths;
    if (Object.values(ErrorReason).includes(payload.name as ErrorReason)) fill = COLORS_PIE[payload.name as keyof typeof COLORS_PIE] || '#F472B6';

    return (
        <g 
            onMouseEnter={() => setActiveNode(payload.name)} 
            onMouseLeave={() => setActiveNode(null)}
            style={{cursor: 'pointer'}}
        >
            <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} radius={[4, 4, 4, 4]} stroke="#fff" strokeWidth={1} />
            <text x={isLeft ? x + width + 6 : (isRight ? x - 6 : x + width / 2)} y={y + height / 2} dy="0.35em" textAnchor={isLeft ? "start" : (isRight ? "end" : "middle")} fontSize={10} fill="#fff" fontWeight="bold" style={{pointerEvents: 'none'}}>{payload.name}</text>
            <text x={isLeft ? x + width + 6 : (isRight ? x - 6 : x + width / 2)} y={y + height / 2 + 12} dy="0.35em" textAnchor={isLeft ? "start" : (isRight ? "end" : "middle")} fontSize={9} fill="#9CA3AF" style={{pointerEvents: 'none'}}>{payload.value} errors</text>
        </g>
    );
};

const InteractiveSankeyLink = (props: any) => {
    const { sourceX, sourceY, targetX, targetY, linkWidth, activeNode, payload } = props;
    const isActive = activeNode === payload.source.name || activeNode === payload.target.name;
    const opacity = activeNode ? (isActive ? 0.6 : 0.05) : 0.3; // Highlight or Dim
    
    const fill = props.payload.source.name === 'Physics' ? SUBJECT_COLORS.physics : props.payload.source.name === 'Chemistry' ? SUBJECT_COLORS.chemistry : props.payload.source.name === 'Maths' ? SUBJECT_COLORS.maths : '#64748B';
    
    return (
        <path 
            d={`M${sourceX},${sourceY} C${sourceX + linkWidth / 2},${sourceY} ${targetX - linkWidth / 2},${targetY} ${targetX},${targetY}`} 
            stroke={fill} 
            strokeWidth={Math.max(1, linkWidth)} 
            strokeOpacity={opacity} 
            fill="none" 
            style={{transition: 'stroke-opacity 0.3s ease'}}
        />
    );
};

const SankeyWidget: React.FC<{ data: any }> = ({ data }) => {
    const [activeNode, setActiveNode] = useState<string | null>(null);

    return (
        <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                {data.nodes.length > 0 ? (
                        <Sankey
                        data={data}
                        node={<InteractiveSankeyNode containerWidth={800} setActiveNode={setActiveNode} />} 
                        link={<InteractiveSankeyLink activeNode={activeNode} />}
                        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Sankey>
                ) : <div className="flex items-center justify-center h-full text-gray-500">Not enough data to map flows.</div>}
            </ResponsiveContainer>
        </div>
    );
};

const StatusBadge: React.FC<{ status: QuestionStatus }> = ({ status }) => {
    const config = {
        [QuestionStatus.FullyCorrect]: { text: 'Fully Correct', color: 'bg-green-500/20 text-green-300' },
        [QuestionStatus.PartiallyCorrect]: { text: 'Partially Correct', color: 'bg-yellow-500/20 text-yellow-300' },
        [QuestionStatus.Wrong]: { text: 'Wrong', color: 'bg-red-500/20 text-red-300' },
        [QuestionStatus.Unanswered]: { text: 'Unanswered', color: 'bg-gray-500/20 text-gray-300' }
    };
    const { text, color } = config[status] || { text: status, color: 'bg-gray-600' };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${color}`}>{text}</span>;
};

const PanicAnalysisWidget: React.FC<{ events: PanicEvent[] }> = ({ events }) => {
    if (events.length === 0) return <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">No panic cascades detected yet. Good composure!</div>;

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {events.map((event, idx) => (
                    <div key={idx} className="bg-red-900/20 border border-red-800/50 p-3 rounded-lg flex items-center justify-between">
                        <div>
                            <p className="text-xs text-red-300 font-bold uppercase">{event.testName}</p>
                            <p className="text-sm text-white">Q.{event.startQuestion} - Q.{event.endQuestion}</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-xl font-black text-red-500">-{event.lostMarks}</span>
                            <span className="text-[10px] text-red-400">Panic Tax</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const GuessingWidget: React.FC<{ stats: GuessStats }> = ({ stats }) => {
    // Intuition Data for Gauge
    const intuitionData = [
        { name: 'Intuition', value: stats.intuitionScore, fill: '#a855f7' }, // Purple
        { name: 'Gap', value: 100 - stats.intuitionScore, fill: '#334155' },
    ];

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-around h-1/2">
                {/* Metric 1: Net Impact */}
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Net Score Impact</p>
                    <p className={`text-4xl font-black ${stats.netScoreImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.netScoreImpact > 0 ? '+' : ''}{stats.netScoreImpact}
                    </p>
                </div>

                {/* Metric 2: Intuition Gauge */}
                <div className="relative w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={intuitionData}
                                cx="50%" cy="50%"
                                innerRadius={28} outerRadius={40}
                                startAngle={90} endAngle={-270}
                                dataKey="value" stroke="none"
                            >
                                {intuitionData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-bold text-white">{stats.intuitionScore.toFixed(0)}%</span>
                        <span className="text-[8px] text-gray-400 uppercase">Intuition</span>
                    </div>
                </div>
            </div>

            {/* Risk Profile Bar */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <div className="flex justify-between text-[10px] text-gray-400 mb-2 uppercase font-bold tracking-wider">
                    <span>Risk Profile</span>
                    <span>Total Guesses: {stats.totalGuesses}</span>
                </div>
                
                <div className="flex h-4 rounded-full overflow-hidden mb-2">
                    {/* Safe Guesses */}
                    <div className="bg-emerald-500/80 h-full flex items-center justify-center text-[9px] text-white font-bold" style={{width: `${(stats.safeGuesses / (stats.totalGuesses || 1)) * 100}%`}} title="Safe Bets (No Negative Marking)">
                        {stats.safeGuesses > 0 && stats.safeGuesses}
                    </div>
                    {/* Risky Guesses */}
                    <div className="bg-amber-500/80 h-full flex items-center justify-center text-[9px] text-white font-bold" style={{width: `${(stats.riskyGuesses / (stats.totalGuesses || 1)) * 100}%`}} title="Risky Gambles (Negative Marking involved)">
                        {stats.riskyGuesses > 0 && stats.riskyGuesses}
                    </div>
                </div>
                
                <div className="flex justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-500/80 rounded-full"></div>
                        <span className="text-gray-300">Safe Bets ({stats.safeGuesses})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-500/80 rounded-full"></div>
                        <span className="text-gray-300">Risky Gambles ({stats.riskyGuesses})</span>
                    </div>
                </div>
                
                {stats.riskyMisses > 0 && (
                    <p className="text-[10px] text-red-400 mt-2 text-center">
                        ⚠ {stats.riskyMisses} risky gambles failed, causing negative marks.
                    </p>
                )}
            </div>
        </div>
    );
};

const ScoreSimulatorWidget: React.FC<{ initialScore: number, errorProfile: { name: string, value: number }[], logs: QuestionLog[], totalTests: number }> = ({ initialScore, errorProfile, logs, totalTests }) => {
    const [reduction, setReduction] = useState<Record<string, number>>({ 'Silly Mistake': 0, 'Conceptual Gap': 0, 'Time Pressure': 0 });
    const [examType, setExamType] = useState<'Mains' | 'Advanced'>('Mains');
    
    const avgAdvancedMarks = useMemo(() => {
        const correctLogs = logs.filter(l => l.marksAwarded > 0);
        if (correctLogs.length === 0) return 3.5; 
        
        const totalPositive = correctLogs.reduce((sum, l) => sum + l.marksAwarded, 0);
        return totalPositive / correctLogs.length;
    }, [logs]);

    const projectedGain = useMemo(() => {
        let gain = 0;
        const marksPerError = examType === 'Mains' ? 4 : avgAdvancedMarks;
        const testsCount = totalTests > 0 ? totalTests : 1;

        errorProfile.forEach(err => {
            const factor = (reduction[err.name] || 0) / 100;
            const avgErrorsPerTest = err.value / testsCount;
            gain += (avgErrorsPerTest * marksPerError) * factor; 
        });
        
        const maxPossibleScore = examType === 'Mains' ? 300 : 360; 
        const rawProjected = initialScore + gain;
        
        if (rawProjected > maxPossibleScore) {
            return Math.max(0, maxPossibleScore - initialScore);
        }

        return Math.round(gain);
    }, [reduction, errorProfile, examType, avgAdvancedMarks, totalTests, initialScore]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <div className="flex flex-col gap-2">
                    <div>
                        <p className="text-xs text-gray-400">Current Avg</p>
                        <p className="text-xl font-bold text-white">{Math.round(initialScore)}</p>
                    </div>
                    <div className="flex bg-slate-800 rounded p-0.5 border border-slate-600">
                        <button 
                            onClick={() => setExamType('Mains')} 
                            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${examType === 'Mains' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Mains (+4)
                        </button>
                        <button 
                            onClick={() => setExamType('Advanced')} 
                            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${examType === 'Advanced' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Adv (~{avgAdvancedMarks.toFixed(1)})
                        </button>
                    </div>
                </div>
                <div className="text-center self-center pt-4">
                    <span className="text-2xl text-gray-600">➜</span>
                </div>
                <div className="text-right">
                    <p className="text-xs text-green-400">Projected</p>
                    <p className="text-2xl font-bold text-green-400">{Math.round(initialScore + projectedGain)} <span className="text-sm text-green-600">(+{projectedGain})</span></p>
                </div>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-grow">
                {errorProfile.slice(0, 3).map(err => (
                    <div key={err.name}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300">Fix {err.name}s</span>
                            <span className="text-cyan-400">{reduction[err.name] || 0}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" step="10" 
                            value={reduction[err.name] || 0} 
                            onChange={(e) => setReduction(prev => ({...prev, [err.name]: parseInt(e.target.value)}))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

const DependencyAlertsWidget: React.FC<{ alerts: DependencyAlert[] }> = ({ alerts }) => {
    if (alerts.length === 0) return <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">No structural dependencies found.</div>;

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {alerts.map((alert, idx) => (
                    <div key={idx} className="bg-amber-900/20 border border-amber-700/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">⚠️</span>
                            <span className="text-xs text-amber-200 font-bold uppercase tracking-wider">Root Cause Detected</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-snug">
                            Failures in <strong className="text-white">{alert.topic}</strong> are likely caused by weakness in <strong className="text-amber-400 underline decoration-dotted">{alert.rootCauseTopic}</strong>.
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AIChiefAnalyst: React.FC<{
  weakTopics: { topic: string; count: number }[];
  errorReasons: { name: string; value: number }[];
  correlationData: any;
  apiKey: string;
  model?: string;
}> = ({ weakTopics, errorReasons, correlationData, apiKey, model }) => {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const stringifiedData = JSON.stringify({ weakTopics, errorReasons, correlationData });

  const generateSummary = useCallback(async (improvise = false) => {
    setIsLoading(true);
    setError('');
    setSummary('');
    try {
      const result = await getAIChiefAnalystSummary(weakTopics, errorReasons, correlationData, apiKey, improvise, model);
      setSummary(result);
    } catch (e: any) {
      setError(e.message || 'Failed to generate summary.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, weakTopics, errorReasons, correlationData, model]);
  
  useEffect(() => {
      setSummary('');
      setError('');
      setIsLoading(false);
  }, [stringifiedData]);

  return (
    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex items-center gap-4 mb-4 border-b border-slate-700 pb-4">
        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-300 text-2xl border border-indigo-500/30 flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.2)]">💡</div>
        <div>
            <h3 className="text-xl font-bold text-white tracking-tight">AI Chief Analyst Report</h3>
            <p className="text-xs text-slate-400">Automated synthesis of your performance data.</p>
        </div>
      </div>
      
      <div className="min-h-[100px]">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-pulse">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-sm text-indigo-300 font-medium">Synthesizing insights from your data...</p>
            </div>
        ) : error ? (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm">
                <strong className="block mb-1">Analysis Failed</strong>
                {error}
            </div>
        ) : summary ? (
            <div className="bg-slate-900/30 rounded-lg border border-slate-700/50 p-5">
                <MarkdownRenderer content={summary} />
            </div>
        ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">
                <p>Ready to analyze your weak topics and error patterns.</p>
            </div>
        )}
        
        {!isLoading && (
             <div className="mt-6 flex flex-wrap gap-3 justify-end">
                <button 
                    onClick={() => generateSummary(false)} 
                    disabled={isLoading} 
                    className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                    <span>📊</span> {summary ? 'Re-run Analysis' : 'Run Full Analysis'}
                </button>
                 <button 
                    onClick={() => generateSummary(true)} 
                    disabled={isLoading} 
                    className="text-sm bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-5 rounded-lg transition-all border border-slate-600 flex items-center gap-2" 
                    title="Generate summary with a fresh, counter-intuitive perspective"
                >
                    <span>🎲</span> {summary ? 'Improvise' : 'Run & Improvise'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

const ErrorReasonPieChart: React.FC<{ data: any[], totalErrors: number, onSliceClick: (name: string) => void }> = ({ data, totalErrors, onSliceClick }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const onPieEnter = useCallback((_: any, index: number) => { setActiveIndex(index); }, []);

    const renderActiveShape = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
        return (
            <g>
                <text x={cx} y={cy - 5} textAnchor="middle" fill="#E5E7EB" fontSize={16} fontWeight="bold">{payload.name}</text>
                <text x={cx} y={cy + 15} textAnchor="middle" fill="#9CA3AF" fontSize={14}>{value} count</text>
                <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="#1f2937" strokeWidth={3} />
            </g>
        );
    };
    const PieComponent = Pie as any;
    return (
        <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                    <PieComponent activeIndex={activeIndex} activeShape={renderActiveShape} data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={'60%'} outerRadius={'80%'} onMouseEnter={onPieEnter} onClick={(d: any) => onSliceClick(d.name)} cursor="pointer" stroke="#1f2937" strokeWidth={2}>
                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[entry.name as keyof typeof COLORS_PIE] || '#8884d8'} />)}
                    </PieComponent>
                    <Tooltip content={<CustomTooltip totalErrors={totalErrors}/>} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

const LostMarksWaterfall: React.FC<{ logs: QuestionLog[], reports: TestReport[] }> = ({ logs, reports }) => {
    const chartData = useMemo(() => {
        if (logs.length === 0) return [];
        
        const actualScore = logs.reduce((acc, log) => acc + log.marksAwarded, 0);
        const deductions: Record<string, number> = { 'Unattempted': 0, [ErrorReason.SillyMistake]: 0, [ErrorReason.ConceptualGap]: 0, [ErrorReason.TimePressure]: 0, [ErrorReason.MisreadQuestion]: 0, [ErrorReason.Guess]: 0, 'Partial Loss': 0 };

        logs.forEach(log => {
             const { correct: maxMarks, wrong: negMarks } = getMarkingScheme(log.questionType);
             if (log.status === QuestionStatus.Unanswered) { deductions['Unattempted'] += maxMarks; } 
             else if (log.status === QuestionStatus.Wrong) {
                 const lost = maxMarks + Math.abs(negMarks);
                 const reason = log.reasonForError || ErrorReason.Guess;
                 deductions[reason] = (deductions[reason] || 0) + lost;
             } else if (log.status === QuestionStatus.PartiallyCorrect) {
                 const lost = maxMarks - log.marksAwarded;
                 deductions['Partial Loss'] += lost;
             }
        });

        const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
        const potentialScore = actualScore + totalDeductions;
        const data = [];
        
        data.push({ name: 'Potential', value: [0, potentialScore], fill: PASTEL_COLORS['Potential'], isTotal: true, displayValue: potentialScore });

        let currentHeight = potentialScore;
        const deductionEntries = Object.entries(deductions)
            .filter(([, val]) => val > 0)
            .sort(([, a], [, b]) => b - a);

        deductionEntries.forEach(([reason, loss], index) => {
            const nextHeight = currentHeight - loss;
            const color = PASTEL_COLORS[reason] || '#f472b6'; // Fallback
            data.push({ 
                name: reason, 
                value: [nextHeight, currentHeight], 
                fill: color, 
                isTotal: false, 
                displayValue: -loss 
            });
            currentHeight = nextHeight;
        });

        data.push({ name: 'Actual', value: [0, Math.max(0, currentHeight)], fill: PASTEL_COLORS['Actual'], isTotal: true, displayValue: currentHeight }); 
        return data;
    }, [logs]);

    return (
        <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }) => { if (active && payload && payload.length) { const d = payload[0].payload; return ( <div className="p-2 bg-slate-900/90 border border-slate-600 rounded shadow text-xs"> <p className="font-bold text-white">{d.name}</p> <p className={`${d.displayValue < 0 ? 'text-red-400' : 'text-green-400'}`}>{d.isTotal ? 'Score: ' : 'Lost: '} {Math.abs(d.displayValue).toFixed(0)}</p> </div> ); } return null; }} />
                    <Bar dataKey="value" shape={(props: any) => { 
                        const { fill, x, y, width, height, payload } = props;
                        let connector = null;
                        const index = chartData.indexOf(payload);
                        if (index < chartData.length - 1) {
                            const lineY = payload.isTotal ? y : y + height;
                            connector = <line x1={x + width} y1={lineY} x2={x + width + 30} y2={lineY} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />;
                        }
                        return ( <g> <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} /> {connector}</g> ); 
                    }}>
                        <LabelList dataKey="value" position="top" content={(props: any) => { const { x, y, width, value, index } = props; const d = chartData[index]; const val = d ? d.displayValue : 0; if (Math.abs(val) < 1) return null; const color = val > 0 ? '#10b981' : '#f87171'; const displayTxt = val > 0 && !d?.isTotal ? `+${val.toFixed(0)}` : val.toFixed(0); return ( <text x={x + width / 2} y={y - 5} fill={d?.isTotal ? '#fff' : color} textAnchor="middle" fontSize={10} fontWeight="bold">{displayTxt}</text> ) }}/>
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const ChartCard: React.FC<{ 
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
}> = ({ title, children, isEditing, isDragging, onChartClick, actionButton, onInfoClick, headerControls, onHide, onResize, className }) => (
    <div
        className={`bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col h-full transition-all duration-300 relative ${isDragging ? 'shadow-[rgba(var(--color-primary-rgb),0.5)] opacity-50' : ''} ${!isEditing && onChartClick ? 'cursor-pointer hover:shadow-[rgba(var(--color-primary-rgb),0.2)] hover:-translate-y-1' : ''} ${isEditing ? 'ring-2 ring-dashed ring-slate-500 cursor-move' : ''} ${className || ''}`}
        onClick={() => { if (!isEditing && onChartClick) onChartClick(); }}
    >
         {isEditing && (
            <div className="absolute inset-0 z-20 bg-slate-900/60 flex flex-col items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg backdrop-blur-sm">
                <div className="flex gap-2">
                        {onResize && (
                        <button onClick={(e) => { e.stopPropagation(); onResize(); }} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full shadow-lg" title="Toggle Size">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg>
                        </button>
                    )}
                    {onHide && (
                        <button onClick={(e) => { e.stopPropagation(); onHide(); }} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg" title="Hide Widget">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                        </button>
                    )}
                </div>
                <span className="text-white font-semibold bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-600">Drag to Move</span>
            </div>
        )}

        <div className="flex justify-between items-start gap-2 mb-2">
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[rgb(var(--color-primary))]">{title}</h3>
                {onInfoClick && !isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onInfoClick(); }} className="text-gray-400 hover:text-white" title="What is this?">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                {headerControls && !isEditing && <div onClick={e => e.stopPropagation()}>{headerControls}</div>}
                {actionButton && !isEditing && <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>{actionButton}</div>}
            </div>
        </div>
        <div className="flex-grow h-full relative min-h-0 flex flex-col" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
);

// Updated DrillDownModal with 5 Whys and Exam Details
const DrillDownModal: React.FC<{ data: ModalData, logs: QuestionLog[], reports: TestReport[] }> = ({ data, logs, reports }) => {
    const { drillDownKey } = data;
    const [fiveWhysStep, setFiveWhysStep] = useState<number | null>(null);
    
    const relevantLogs = useMemo(() => {
        if (!drillDownKey) return [];
        if (data.type === 'errorReasonDetail') {
            return logs.filter(log => log.reasonForError === drillDownKey);
        }
        if (data.type === 'topicDetail') {
            return logs.filter(log => log.topic === drillDownKey && (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect));
        }
        return [];
    }, [drillDownKey, data.type, logs]);

    const handleFiveWhysStart = () => setFiveWhysStep(1);
    const handleNextWhy = () => setFiveWhysStep(p => (p ? p + 1 : 1));
    const handleResetWhy = () => setFiveWhysStep(null);

    const getTestInfo = (testId: string) => {
        const report = reports.find(r => r.id === testId);
        return report ? { name: report.testName, date: report.testDate } : { name: testId, date: 'N/A' };
    };

    if (relevantLogs.length === 0) {
        return <p>No detailed logs found for this selection.</p>;
    }

    const whys = [
        "Why did you make this mistake?",
        "Why did that happen?",
        "And why was that the case?",
        "What is the root cause of that?",
        "So, what is the fundamental issue?"
    ];

    return (
        <div className="flex flex-col h-full">
            {data.type === 'errorReasonDetail' && (
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-4 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-indigo-300">Root Cause Investigator</h4>
                        <p className="text-xs text-gray-400">Use the "5 Whys" technique to find the real problem.</p>
                    </div>
                    {!fiveWhysStep ? (
                        <Button variant="primary" size="sm" onClick={handleFiveWhysStart}>Start 5 Whys</Button>
                    ) : (
                        <Button variant="ghost" size="sm" onClick={handleResetWhy}>Close Investigator</Button>
                    )}
                </div>
            )}

            {fiveWhysStep && (
                <div className="bg-indigo-900/20 p-6 rounded-lg border border-indigo-500/30 mb-6 animate-scale-in">
                    <h3 className="text-xl font-bold text-white mb-4">The 5 Whys: Step {fiveWhysStep}/5</h3>
                    <p className="text-lg text-indigo-200 mb-6 font-medium">{whys[Math.min(fiveWhysStep - 1, 4)]}</p>
                    
                    <div className="space-y-3">
                        <textarea className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white h-24 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Type your answer honestly..."></textarea>
                        <div className="flex justify-end gap-2">
                            {fiveWhysStep < 5 ? (
                                <Button variant="primary" onClick={handleNextWhy}>Next Why →</Button>
                            ) : (
                                <Button variant="primary" className="bg-green-600 hover:bg-green-500" onClick={handleResetWhy}>Finish & Log Action</Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-y-auto flex-grow">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-700/50 sticky top-0">
                        <tr>
                            <th className="p-2 text-left text-gray-300 font-semibold">Date</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Exam</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Q.No</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Subject</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Status</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Topic</th>
                            <th className="p-2 text-left text-gray-300 font-semibold">Error Reason</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {relevantLogs.map((log, index) => {
                            const { name, date } = getTestInfo(log.testId);
                            return (
                                <tr key={index} className="hover:bg-slate-700/40">
                                    <td className="p-2 text-gray-400 text-xs">{new Date(date).toLocaleDateString()}</td>
                                    <td className="p-2 font-medium text-cyan-300">{name}</td>
                                    <td className="p-2">{log.questionNumber}</td>
                                    <td className="p-2 capitalize">{log.subject}</td>
                                    <td className="p-2"><StatusBadge status={log.status} /></td>
                                    <td className="p-2">{log.topic}</td>
                                    <td className="p-2">{log.reasonForError}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Main RootCause Component ---

export const RootCause: React.FC<RootCauseProps> = ({ logs, reports, rootCauseFilter, setRootCauseFilter, apiKey, modelName, onAddTask }) => {
    const [viewMode, setViewMode] = useState<'dashboard' | 'briefing'>('dashboard');
    
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [selectedTest, setSelectedTest] = useState('all');
    const [modalData, setModalData] = useState<ModalData | null>(null);
    
    // Drag and Drop State
    const dragItem = useRef<WidgetId | null>(null);
    const dragOverItem = useRef<WidgetId | null>(null);
    const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
    const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);
    
    const [qTypeMetric, setQTypeMetric] = useState<'errors' | 'totalAttempts' | 'errorRate' | 'avgMarks'>('errors');
    const [errorTrendMode, setErrorTrendMode] = useState<'absolute' | 'percent'>('percent');

    // Robust State Initialization
    const [layout, setLayout] = useState<WidgetLayout[]>(() => {
        try {
            const savedLayoutString = localStorage.getItem('rootCauseWidgetLayout_v7');
            if (savedLayoutString) {
                const parsedLayout = JSON.parse(savedLayoutString);
                if (Array.isArray(parsedLayout)) {
                    // Create a map of saved widgets
                    const savedMap = new Map(parsedLayout.map((w: any) => [w.id, w]));
                    
                    // Merge saved state with defaults
                    const merged = DEFAULT_ROOT_CAUSE_LAYOUT.map(defaultWidget => {
                        const savedWidget = savedMap.get(defaultWidget.id);
                        return savedWidget ? { ...defaultWidget, ...savedWidget } : defaultWidget;
                    });
                    
                    return merged;
                }
            }
        } catch (e) { 
            console.error("Failed to load root cause layout", e); 
        }
        return DEFAULT_ROOT_CAUSE_LAYOUT;
    });
    
    useEffect(() => { try { localStorage.setItem('rootCauseWidgetLayout_v7', JSON.stringify(layout)); } catch (e) { console.error("Failed to save layout to localStorage", e); } }, [layout]);

    // ... (Remaining component logic remains unchanged)
    // Re-declaring functions for context
    const openModal = (type: ModalType, title: string, drillDownKey?: string, widgetId?: WidgetId, simulatorData?: any, infoContent?: React.ReactNode) => {
        setModalData({ type, title, drillDownKey, widgetId, simulatorData, infoContent });
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: WidgetId) => { dragItem.current = id; setDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: WidgetId) => { if (dragItem.current !== id) { dragOverItem.current = id; setDragOverId(id); } };
    const handleDragEnd = () => {
        if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
            setLayout(prevLayout => {
                const newLayout = [...prevLayout];
                const dragItemIndex = newLayout.findIndex(w => w.id === dragItem.current);
                const dragOverItemIndex = newLayout.findIndex(w => w.id === dragOverItem.current);
                if (dragItemIndex === -1 || dragOverItemIndex === -1) return prevLayout;

                const dragItemContent = newLayout[dragItemIndex];
                newLayout.splice(dragItemIndex, 1);
                newLayout.splice(dragOverItemIndex, 0, dragItemContent);
                return newLayout;
            });
        }
        dragItem.current = null; dragOverItem.current = null; setDraggingId(null); setDragOverId(null);
    };
    
    const toggleWidgetVisibility = useCallback((widgetId: WidgetId, visible: boolean) => { setLayout(prevLayout => prevLayout.map(w => w.id === widgetId ? { ...w, visible } : w)); }, []);
    const handleToggleWidgetSize = useCallback((widgetId: WidgetId) => { setLayout(prevLayout => prevLayout.map(w => w.id === widgetId ? { ...w, size: w.size === 'normal' ? 'wide' : 'normal' } : w)); }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const subjectMatch = !rootCauseFilter.subject || log.subject === rootCauseFilter.subject;
            const testMatch = selectedTest === 'all' || log.testId === selectedTest;
            return subjectMatch && testMatch;
        });
    }, [logs, rootCauseFilter, selectedTest]);

    const filteredReportsForCharts = useMemo(() => {
        return reports.filter(report => selectedTest === 'all' || report.id === selectedTest);
    }, [reports, selectedTest]);

    const analysisData = useRootCauseAnalytics(filteredLogs, reports);
    
    const WIDGETS = useMemo(() => {
        const widgets: Partial<Record<WidgetId, { title: React.ReactNode; component: React.ReactNode; actionButton?: React.ReactNode; info: React.ReactNode; headerControls?: React.ReactNode }>> = {
            conceptualKnowledgeGraph: {
                title: "Dynamic Knowledge Graph",
                info: "This graph dynamically maps your weak topics (glowing nodes) against the JEE syllabus dependencies. It uses a physics simulation to layout nodes. Pulse indicates high error count. Drag nodes to reorganize.",
                component: <DynamicKnowledgeGraph logs={filteredLogs} onNodeClick={(topic) => openModal('topicDetail', `Topic Details: ${topic}`, topic)} />
            },
            speedVsAccuracy: {
                title: "Speed vs. Accuracy Quadrant",
                info: "Analyze if you are rushing or struggling with concepts. Top-Left: Mastery (Fast & Accurate). Bottom-Right: Conceptual Gaps (Slow & Wrong). Top-Right: Needs Speed (Slow & Accurate). Bottom-Left: Careless/Guessing (Fast & Wrong).",
                component: <SpeedVsAccuracyWidget logs={filteredLogs} />
            },
            errorFlowSankey: {
                title: "Flow of Failure (Root Cause)",
                info: "A Sankey Diagram connecting Subject -> Weak Topics -> Error Reason. This reveals the 'Path of Failure'. For instance, if Physics flows heavily into 'Rotational Motion' and then 'Conceptual Gap', you know exactly where to focus. Hover on nodes to highlight paths.",
                component: <SankeyWidget data={analysisData.sankeyData} />
            },
            paretoAnalysis: {
                title: "80/20 Rule (Pareto)",
                info: "The Pareto Principle states that 80% of consequences come from 20% of causes. This chart shows your error count by topic (bars) and the cumulative impact (line). Fixing the few topics on the left will resolve the majority of your errors.",
                component: (
                    <div className="flex-grow min-h-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <ComposedChart data={analysisData.paretoData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="topic" angle={-45} textAnchor="end" interval={0} stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="left" stroke="#9CA3AF" label={{ value: 'Error Count', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10B981" unit="%" domain={[0, 100]} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ bottom: 0 }} />
                                <Bar yAxisId="left" dataKey="count" name="Errors" fill="#6366F1" barSize={20} />
                                <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative Impact" stroke="#10B981" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )
            },
            lostMarksWaterfall: {
                title: "Lost Marks Breakdown",
                info: "This waterfall chart visualizes the gap between your Potential Score (if all questions were correct) and your Actual Score. It breaks down exactly where you lost marks, sorted by biggest loss.",
                component: <LostMarksWaterfall logs={filteredLogs} reports={filteredReportsForCharts} />
            },
            weakestTopics: {
                title: "Weakest Topics Analysis",
                info: "This chart ranks topics by the total number of incorrect or partially correct questions. Click to see details.",
                component: <WeakestTopicsChart data={analysisData.weakestTopics} onClick={(data) => openModal('topicDetail', `Topic Details: ${data.topic}`, data.topic)} totalErrorCount={analysisData.totalErrors} logs={filteredLogs} fitContainer={true} />,
            },
            errorTrend: {
                title: "Error Evolution (Temporal)",
                info: "See how your error types change over time. Ideally, 'Conceptual Gaps' and 'Silly Mistakes' should shrink. A widening band indicates a worsening problem.",
                headerControls: (
                    <div className="flex bg-slate-700 rounded p-0.5 border border-slate-600 mr-2">
                        <button onClick={() => setErrorTrendMode('absolute')} className={`px-2 py-0.5 text-[10px] rounded ${errorTrendMode === 'absolute' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>Count</button>
                        <button onClick={() => setErrorTrendMode('percent')} className={`px-2 py-0.5 text-[10px] rounded ${errorTrendMode === 'percent' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>%</button>
                    </div>
                ),
                component: (
                    <div className="flex-grow min-h-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={analysisData.errorTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    {Object.keys(COLORS_PIE).map(reason => (
                                        <linearGradient key={reason} id={`color${reason.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS_PIE[reason]} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={COLORS_PIE[reason]} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <XAxis dataKey="date" stroke="#9CA3AF" tick={{fontSize: 10}} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
                                <YAxis stroke="#9CA3AF" unit={errorTrendMode === 'percent' ? '%' : ''} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                {Object.keys(COLORS_PIE).map(reason => (
                                    <Area 
                                        key={reason}
                                        type="monotone" 
                                        dataKey={errorTrendMode === 'percent' ? `${reason}%` : reason} 
                                        name={reason}
                                        stackId="1" 
                                        stroke={COLORS_PIE[reason]} 
                                        fill={`url(#color${reason.replace(/\s/g, '')})`} 
                                    />
                                ))}
                                <Brush dataKey="date" height={30} stroke="#475569" fill="#1e293b" tickFormatter={() => ''} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )
            },
            fatigueAnalysis: {
                title: "Exam Fatigue Analysis",
                info: "Correlates question position (1-10, 11-20...) with Error Rate. A rising trend indicates fatigue or loss of focus towards the end of the paper.",
                component: (
                    <div className="flex-grow min-h-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <ComposedChart data={analysisData.fatigueData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="#374151" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="range" stroke="#9CA3AF" label={{ value: 'Question Range', position: 'insideBottom', offset: -10, fill: '#9CA3AF', fontSize: 10 }} />
                                <YAxis yAxisId="left" stroke="#F87171" unit="%" label={{ value: 'Error Rate', angle: -90, position: 'insideLeft', fill: '#F87171' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" label={{ value: 'Attempts', angle: 90, position: 'insideRight', fill: '#6B7280' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar yAxisId="right" dataKey="attempts" name="Attempts" fill="#374151" barSize={20} />
                                <Line yAxisId="left" type="monotone" dataKey="errorRate" name="Error Rate" stroke="#F87171" strokeWidth={3} dot={{r: 4, fill: '#F87171'}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )
            },
            errorReason: {
                title: "Error Reason Distribution",
                info: "This pie chart shows the breakdown of why you are making mistakes (e.g., conceptual gaps, silly mistakes). Understanding this helps you focus on strategy (e.g., more careful work) vs. just studying more.",
                component: <ErrorReasonPieChart data={analysisData.errorReasonDistribution} totalErrors={analysisData.totalErrors} onSliceClick={(name) => openModal('errorReasonDetail', `Error Reason: ${name}`, name)} />,
                actionButton: <button onClick={() => openModal('simulator', 'Performance Simulator', undefined, undefined, {type: 'reason', data: analysisData.errorReasonDistribution})} className="text-xs bg-indigo-600/50 hover:bg-indigo-600 text-white font-semibold py-1 px-3 rounded-full transition-colors">Simulate</button>
            },
            metricScatterPlot: { 
                title: "Metric Scatter Plot",
                info: "Compare any two metrics for every subject in every test. Helps identify correlations (e.g., does higher attempt rate lead to lower accuracy?).",
                component: <MetricScatterWidget reports={reports} />
            },
            questionType: {
                title: "Performance by Question Type",
                info: "This chart analyzes your performance based on the type of question (e.g., Single Correct, Integer).",
                headerControls: (
                    <select 
                        value={qTypeMetric} 
                        onChange={(e) => setQTypeMetric(e.target.value as any)} 
                        className="bg-slate-700 text-xs p-1 rounded border border-slate-600 focus:ring-1 focus:ring-cyan-500"
                        onClick={e => e.stopPropagation()}
                    >
                        <option value="errors">Error Count</option>
                        <option value="totalAttempts">Total Attempts</option>
                        <option value="errorRate">Error Rate (%)</option>
                        <option value="avgMarks">Average Marks</option>
                    </select>
                ),
                component: (
                     <div className="flex flex-col h-full">
                         <div className="flex-grow min-h-0">
                             <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={analysisData.performanceByQuestionType} margin={{ top: 5, right: 20, left: -10, bottom: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="name" stroke="#9CA3AF" angle={-40} textAnchor="end" interval={0} height={80} tick={{ fontSize: 10 }}/>
                                        <YAxis stroke="#9CA3AF" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey={qTypeMetric} fill={qTypeMetric === 'errorRate' ? '#EF4444' : qTypeMetric === 'avgMarks' ? '#10B981' : '#FBBF24'} />
                                    </BarChart>
                                </ResponsiveContainer>
                        </div>
                    </div>
                ),
            },
            scoreContribution: {
                title: "Score Contribution by %",
                info: "Shows the percentage of total marks contributed by each subject. Useful to see if you are over-relying on one strong subject.",
                component: <ScoreContributionWidget reports={reports} />,
            },
            errorReasonsBySubject: {
                title: "Error Reasons by Subject",
                info: "A stacked column chart showing the breakdown of error reasons for each subject. Helps identify if certain subjects are more prone to specific types of errors (e.g., Calculation errors in Maths vs Conceptual in Physics).",
                component: <ErrorReasonsBySubjectWidget data={analysisData.flippedStackedErrorData} />
            },
            // --- NEW WIDGETS ---
            panicAnalysis: {
                title: "Panic Cascades (Death Spirals)",
                info: "Detects sequences where you got 3+ questions wrong/unanswered in a row. These 'spirals' indicate psychological panic or stamina loss.",
                component: <PanicAnalysisWidget events={analysisData.panicEvents} />
            },
            guessingGame: {
                title: "Guessing Efficiency",
                info: "Analyzes your 'Luck vs. Intuition'. 'Safe Bets' are guesses on questions with no negative marking (like Integers). 'Risky Gambles' are guesses that can hurt your score. High Intuition means your gut feeling is often right.",
                component: <GuessingWidget stats={analysisData.guessStats} />
            },
            scoreSimulator: {
                title: "Bayesian Score Simulator",
                info: "An interactive 'What-If' engine. Adjust the sliders to see how reducing specific error types (like Silly Mistakes) would improve your average score. Toggles for Mains (+4) vs Advanced (+3) assumptions.",
                component: <ScoreSimulatorWidget initialScore={reports.length > 0 ? reports.reduce((a,b)=>a+b.total.marks,0)/reports.length : 0} errorProfile={analysisData.errorReasonDistribution} logs={filteredLogs} totalTests={reports.length} />
            },
            dependencyAlerts: {
                title: "Dependency Alerts",
                info: "Uses graph theory to find hidden root causes. It flags weak topics whose prerequisites are also weak (e.g., failing Rotational Motion due to weak Vectors).",
                component: <DependencyAlertsWidget alerts={analysisData.dependencyAlerts} />
            }
        };
        
        // Dynamic expanded widget logic
        if (modalData?.widgetId === 'weakestTopics_full') {
             widgets['weakestTopics_full'] = {
                title: "All Weak Topics",
                component: <WeakestTopicsChart data={analysisData.weakestTopics} onClick={(data) => openModal('topicDetail', `Topic Details: ${data.topic}`, data.topic)} totalErrorCount={analysisData.totalErrors} logs={filteredLogs} fitContainer={false} />, 
                info: "Full list of all weak topics."
             };
        }

        return widgets;
    }, [filteredLogs, filteredReportsForCharts, analysisData, qTypeMetric, errorTrendMode, reports, modalData?.widgetId]);

    const hiddenWidgets = DEFAULT_ROOT_CAUSE_LAYOUT.filter(w => !layout.find(l => l.id === w.id)?.visible);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--color-primary-accent-rgb))]">Root Cause Analysis</h2>
                <div className="flex items-center gap-4 flex-wrap">
                    {/* View Toggle */}
                    <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex">
                        <button 
                            onClick={() => setViewMode('dashboard')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span>📊</span> Analytics
                        </button>
                        <button 
                            onClick={() => setViewMode('briefing')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-2 ${viewMode === 'briefing' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span>🎬</span> Briefing
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                         <label className="text-sm text-gray-400">Filter by Test:</label>
                         <select value={selectedTest} onChange={e => setSelectedTest(e.target.value)} className="bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-1 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none max-w-[150px] truncate">
                            <option value="all">All Tests</option>
                            {reports.map(r => <option key={r.id} value={r.id}>{r.testName}</option>).reverse()}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">Subject:</label>
                        <select value={rootCauseFilter.subject || ''} onChange={e => setRootCauseFilter({ subject: e.target.value || null })} className="bg-slate-700 p-2 rounded-md border border-slate-600 focus:ring-1 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none">
                            <option value="">All Subjects</option>
                            {Array.from(new Set(logs.map(l => l.subject))).map((s: string) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                    </div>
                    {viewMode === 'dashboard' && (
                        <Button variant={isCustomizing ? 'primary' : 'secondary'} onClick={() => setIsCustomizing(!isCustomizing)}>{isCustomizing ? 'Done' : 'Customize'}</Button>
                    )}
                </div>
            </div>

            {viewMode === 'briefing' ? (
                <ExecutiveBriefing reports={filteredReportsForCharts} logs={filteredLogs} />
            ) : (
                <>
                    <AIChiefAnalyst
                        weakTopics={analysisData.weakestTopics}
                        errorReasons={analysisData.errorReasonDistribution}
                        correlationData={{ data: [] }}
                        apiKey={apiKey}
                        model={modelName}
                    />
                    
                    <div className="flex gap-6 relative">
                        <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6" onDragOver={(e) => e.preventDefault()}>
                            {layout.filter(w => w.visible).map((widget) => {
                                const widgetConfig = WIDGETS[widget.id];
                                if (!widgetConfig) return null;
                                const isDraggable = isCustomizing;
                                
                                // Special Logic: Weakest Topics should open full view on click
                                const targetWidgetId = widget.id === 'weakestTopics' ? 'weakestTopics_full' : widget.id;

                                return (
                                    <div key={widget.id} className={`${widget.size === 'wide' ? 'lg:col-span-2' : ''} h-[28rem] ${isDraggable ? 'cursor-move' : ''} ${dragOverId === widget.id && draggingId ? 'drag-over-indicator' : ''}`} draggable={isDraggable} onDragStart={(e) => handleDragStart(e, widget.id)} onDragEnter={(e) => handleDragEnter(e, widget.id)} onDragEnd={handleDragEnd} onDragLeave={() => setDragOverId(null)}>
                                        <ChartCard 
                                            title={widgetConfig.title} 
                                            isEditing={isCustomizing} 
                                            isDragging={draggingId === widget.id} 
                                            onChartClick={() => openModal('widget', typeof widgetConfig.title === 'string' ? widgetConfig.title : 'Expanded View', undefined, targetWidgetId)} 
                                            actionButton={widgetConfig.actionButton} 
                                            onInfoClick={() => openModal('info', typeof widgetConfig.title === 'string' ? widgetConfig.title : 'About this chart', undefined, undefined, undefined, widgetConfig.info)}
                                            headerControls={widgetConfig.headerControls}
                                            onHide={() => toggleWidgetVisibility(widget.id, false)}
                                            onResize={() => handleToggleWidgetSize(widget.id)}
                                        >
                                            {widgetConfig.component}
                                        </ChartCard>
                                    </div>
                                );
                            })}
                        </main>
                        
                        {isCustomizing && (
                             <aside className="hidden lg:block w-64 flex-shrink-0 animate-fade-in sticky top-6 h-fit">
                                 <div className="bg-slate-800/90 border-dashed border-2 border-slate-600 p-4 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Hidden Widgets</h3>
                                    <div className="space-y-3 min-h-[100px]">
                                        {hiddenWidgets.length === 0 ? <p className="text-sm text-gray-500 text-center italic">All widgets visible</p> : null}
                                        {hiddenWidgets.map(defaultWidget => {
                                            const widgetConfig = WIDGETS[defaultWidget.id];
                                            return (
                                                <div key={defaultWidget.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-md border border-slate-700 shadow-sm">
                                                    <span className="text-sm text-gray-300 font-medium">{typeof widgetConfig?.title === 'string' ? widgetConfig.title : 'Widget'}</span>
                                                    <Button variant="secondary" size="sm" onClick={() => toggleWidgetVisibility(defaultWidget.id, true)}>Show</Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                 <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-800/50 text-sm text-blue-200">
                                    <p className="flex items-start gap-2">
                                        <span className="text-lg">💡</span>
                                        <span>Drag widgets to reorder. Use the buttons on widgets to resize or hide them.</span>
                                    </p>
                                </div>
                            </aside>
                        )}
                    </div>
                </>
            )}
            
             {modalData && (
                <Modal 
                    isOpen={!!modalData} 
                    onClose={() => setModalData(null)} 
                    title={modalData.title}
                    isInfo={modalData.type === 'info'}
                >
                    {modalData.type === 'errorReasonDetail' || modalData.type === 'topicDetail' ? (
                        <DrillDownModal data={modalData} logs={filteredLogs} reports={reports} />
                    ) : modalData.type === 'info' ? (
                        <div className="text-sm text-gray-300 space-y-2 p-1">{modalData.infoContent}</div>
                    ) : modalData.type === 'simulator' ? (
                        <div className="p-4">Simulator Placeholder for {modalData.title}</div>
                    ) : modalData.widgetId ? (
                        <div className="h-full w-full p-2">
                            {WIDGETS[modalData.widgetId]?.component}
                        </div>
                    ) : null}
                </Modal>
            )}
        </div>
    );
};
