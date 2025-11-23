
import React, { useState, useMemo, useEffect } from 'react';
import { 
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Legend
} from 'recharts';
import { TestReport, QuestionLog, QuestionStatus, ErrorReason } from '../../types';
import { SUBJECT_COLORS } from '../../constants';
import CustomTooltip from '../common/CustomTooltip';

interface ExecutiveBriefingProps {
    reports: TestReport[];
    logs: QuestionLog[];
    onDrillDown?: (type: 'subject' | 'errorReason', value: string) => void;
}

// --- Helper Hooks & Components ---

const useCountUp = (endValue: number, duration: number = 1500) => {
    const [count, setCount] = useState(0);
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);
    
    useEffect(() => {
        let frame = 0;
        const counter = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;
            // Ease-out cubic interpolation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            setCount(endValue * easedProgress);

            if (frame === totalFrames) {
                clearInterval(counter);
                setCount(endValue);
            }
        }, frameRate);
        return () => clearInterval(counter);
    }, [endValue, duration, totalFrames]);
    
    return endValue % 1 !== 0 ? count.toFixed(1) : Math.round(count).toLocaleString();
};

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
    const displayValue = useCountUp(value);
    return <span className="tabular-nums">{displayValue}</span>;
};

const InsightCard: React.FC<{ title: string; icon: string; content: React.ReactNode; chart: React.ReactNode; onClick?: () => void }> = ({ title, icon, content, chart, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col h-[400px] transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:border-slate-600 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
    >
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-900/30 border border-cyan-500/20 flex items-center justify-center text-lg">
                {icon}
            </div>
            <h3 className="font-bold text-cyan-100 text-sm uppercase tracking-wider">{title}</h3>
        </div>
        <div className="flex-grow relative bg-slate-900/20 p-4 min-h-0">
            {chart}
        </div>
        <div className="p-4 bg-slate-800/80 border-t border-slate-700/50 text-sm text-gray-300 leading-relaxed">
            {content}
        </div>
    </div>
);

// --- Main Component ---
export const ExecutiveBriefing: React.FC<ExecutiveBriefingProps> = ({ reports, logs, onDrillDown }) => {
    const analysis = useMemo(() => {
        if (!reports || reports.length === 0) return null;

        const latestReport = reports[reports.length - 1];
        const avgScore = reports.length > 0 ? reports.reduce((sum: number, r) => sum + r.total.marks, 0) / reports.length : 0;
        const scoreDelta = latestReport.total.marks - avgScore;
        const scoreTrend = reports.map(r => ({ name: r.testName, score: r.total.marks }));
        
        const subjectScores: Record<string, number> = {
            physics: reports.reduce((sum: number, r) => sum + r.physics.marks, 0) / reports.length,
            chemistry: reports.reduce((sum: number, r) => sum + r.chemistry.marks, 0) / reports.length,
            maths: reports.reduce((sum: number, r) => sum + r.maths.marks, 0) / reports.length,
        };
        const sortedSubjects = Object.entries(subjectScores).sort((a, b) => (a[1] as number) - (b[1] as number));
        const weakestSubjectName = sortedSubjects[0][0];
        const strongestSubjectName = sortedSubjects[2][0];
        const scoreGap = (sortedSubjects[2][1] as number) - (sortedSubjects[0][1] as number);

        const errorLogs = logs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect);
        const errorCounts = errorLogs.reduce((acc: Record<string, number>, l) => {
            if(l.reasonForError) acc[l.reasonForError] = (acc[l.reasonForError] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const sortedErrors = Object.entries(errorCounts).map(([name, value]) => ({ name, value })).sort((a, b) => (b.value as number) - (a.value as number));
        const topError = sortedErrors[0] || { name: 'None', value: 0 };
        
        const topicCounts = errorLogs.reduce((acc: Record<string, number>, l) => {
            if (l.topic && l.topic !== 'N/A') acc[l.topic] = (acc[l.topic] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const sortedTopics = Object.entries(topicCounts).map(([topic, count]) => ({ topic, count })).sort((a, b) => (b.count as number) - (a.count as number));
        const topTopic = sortedTopics[0] || { topic: 'None', count: 0 };
        
        // Impact Assessment
        const topTopicLogs = errorLogs.filter(l => l.topic === topTopic.topic);
        const marksLostInTopTopic = topTopicLogs.reduce((sum: number, l) => sum + 5, 0); // Estimate

        const diagnosis = `Primary performance blocker is a **Conceptual Gap** in **${topTopic.topic}**, within your weakest subject, **${weakestSubjectName}**. This is costing you an estimated **${marksLostInTopTopic} marks** per test where this topic appears.`;

        return {
            latestScore: latestReport.total.marks,
            avgScore,
            scoreDelta,
            scoreTrend,
            subjectData: [
                { name: 'Physics', value: subjectScores.physics, fill: SUBJECT_COLORS.physics },
                { name: 'Chemistry', value: subjectScores.chemistry, fill: SUBJECT_COLORS.chemistry },
                { name: 'Maths', value: subjectScores.maths, fill: SUBJECT_COLORS.maths },
            ],
            weakestSubjectName,
            strongestSubjectName,
            scoreGap,
            errorData: sortedErrors.slice(0, 4),
            topError,
            topicData: sortedTopics.slice(0, 5),
            topTopic,
            marksLostInTopTopic,
            diagnosis
        };
    }, [reports, logs]);

    if (!analysis) return <div className="p-8 text-center text-gray-400">Insufficient data for briefing. Add more test reports.</div>;

    const steps = [
        {
            title: "Situation Report",
            icon: "📈",
            content: (
                <p>
                    Latest score: <strong className="text-white"><AnimatedNumber value={analysis.latestScore} /></strong>. 
                    Deviation: <strong className={analysis.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}>{analysis.scoreDelta >= 0 ? '+' : ''}<AnimatedNumber value={analysis.scoreDelta} /></strong> points.
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analysis.scoreTrend}>
                        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="1 4" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 10}} />
                        <YAxis stroke="#64748b" domain={['dataMin - 10', 'auto']} tick={{fontSize: 10}} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={3} fill="url(#g)" />
                        <ReferenceLine y={analysis.avgScore} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Avg`, fill: "#94a3b8", fontSize: 10 }} />
                    </AreaChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Threat Vector",
            icon: "🎯",
            onClick: () => onDrillDown?.('subject', analysis.weakestSubjectName),
            content: (
                 <p>
                    Weakest Subject: <strong className="capitalize text-red-400">{analysis.weakestSubjectName}</strong>. 
                    Gap to Strongest: <strong className="text-white"><AnimatedNumber value={analysis.scoreGap} /></strong> points.
                    <br/><span className="text-[10px] text-gray-500 italic">Click to drill down</span>
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.subjectData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="1 4" stroke="#334155" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" hide />
                        <YAxis dataKey="name" type="category" stroke="#fff" tick={{fontSize: 12, fontWeight: 'bold'}} width={80} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                            <LabelList dataKey="value" position="right" fill="#fff" fontSize={12} fontWeight="bold" formatter={(val: number) => val.toFixed(0)} />
                            {analysis.subjectData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Root Cause",
            icon: "🔬",
            onClick: () => onDrillDown?.('errorReason', analysis.topError.name),
            content: (
                 <p>
                    Dominant Error: <strong className="text-amber-400">{analysis.topError.name}</strong> (<AnimatedNumber value={analysis.topError.value} /> errors).
                    <br/><span className="text-[10px] text-gray-500 italic">Click to investigate</span>
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={analysis.errorData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value">
                            {analysis.errorData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'][index % 4]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Impact Assessment",
            icon: "💥",
             content: (
                 <p>
                    Top Problem Topic: <strong className="text-cyan-400">{analysis.topTopic.topic}</strong>. Estimated Loss: <strong className="text-red-400"><AnimatedNumber value={analysis.marksLostInTopTopic} /> marks</strong>.
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.topicData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="1 4" stroke="#334155" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" hide />
                        <YAxis dataKey="topic" type="category" stroke="#94a3b8" tick={{fontSize: 10}} width={100} interval={0} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16}>
                            <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Strategic Directive",
            icon: "🧭",
            content: (
                <ul className="space-y-2 text-xs">
                    <li className="flex items-start gap-2"><strong className="text-cyan-400">01</strong><span>Focus on <strong className="text-cyan-300">{analysis.topTopic.topic}</strong> until 80% accuracy.</span></li>
                    <li className="flex items-start gap-2"><strong className="text-cyan-400">02</strong><span>Daily short notes for <strong className="capitalize text-red-300">{analysis.weakestSubjectName}</strong>.</span></li>
                    <li className="flex items-start gap-2"><strong className="text-cyan-400">03</strong><span>Verify answers to reduce <strong className="text-amber-300">{analysis.topError.name}s</strong>.</span></li>
                </ul>
            ),
             chart: <div className="h-full w-full flex items-center justify-center p-4"><div className="text-center space-y-2"><div className="text-5xl">🚀</div><h3 className="text-lg font-bold text-white">Execute Plan</h3></div></div>
        },
        {
            title: "Final Diagnosis",
            icon: "🩺",
            content: (
                <div className="flex flex-col justify-center h-full">
                    <p className="text-sm text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: analysis.diagnosis.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }}></p>
                </div>
            ),
            chart: (
                <div className="h-full w-full flex items-center justify-center p-4">
                    <div className="text-center">
                        <svg className="w-16 h-16 mx-auto text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h3 className="text-lg font-bold text-white mt-2">Parameters Set</h3>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="p-2 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                {steps.map((step, index) => (
                    <InsightCard 
                        key={index}
                        title={step.title}
                        icon={step.icon}
                        content={step.content}
                        chart={step.chart}
                        onClick={step.onClick}
                    />
                ))}
            </div>
        </div>
    );
};
