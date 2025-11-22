import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// --- Main Component ---
export const ExecutiveBriefing: React.FC<ExecutiveBriefingProps> = ({ reports, logs }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

    const analysis = useMemo(() => {
        if (reports.length === 0) return null;

        const latestReport = reports[reports.length - 1];
        const avgScore = reports.length > 0 ? reports.reduce((sum, r) => sum + r.total.marks, 0) / reports.length : 0;
        const scoreDelta = latestReport.total.marks - avgScore;
        const scoreTrend = reports.map(r => ({ name: r.testName, score: r.total.marks }));
        
        const subjectScores = {
            physics: reports.reduce((sum, r) => sum + r.physics.marks, 0) / reports.length,
            chemistry: reports.reduce((sum, r) => sum + r.chemistry.marks, 0) / reports.length,
            maths: reports.reduce((sum, r) => sum + r.maths.marks, 0) / reports.length,
        };
        const sortedSubjects = Object.entries(subjectScores).sort((a, b) => a[1] - b[1]);
        const weakestSubjectName = sortedSubjects[0][0];
        const strongestSubjectName = sortedSubjects[2][0];
        const scoreGap = sortedSubjects[2][1] - sortedSubjects[0][1];

        const errorLogs = logs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect);
        const errorCounts = errorLogs.reduce((acc, l) => {
            if(l.reasonForError) acc[l.reasonForError] = (acc[l.reasonForError] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const sortedErrors = Object.entries(errorCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        const topError = sortedErrors[0] || { name: 'None', value: 0 };
        
        const topicCounts = errorLogs.reduce((acc, l) => {
            if (l.topic && l.topic !== 'N/A') acc[l.topic] = (acc[l.topic] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const sortedTopics = Object.entries(topicCounts).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
        const topTopic = sortedTopics[0] || { topic: 'None', count: 0 };
        
        // Impact Assessment
        const topTopicLogs = errorLogs.filter(l => l.topic === topTopic.topic);
        const marksLostInTopTopic = topTopicLogs.reduce((sum, l) => {
            // Rough estimation: Potential marks (e.g., +4) + penalty (e.g., -1) = 5 marks lost
            return sum + 5;
        }, 0);

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

    if (!analysis) return <div className="p-8 text-center text-gray-400">Insufficient data for briefing.</div>;

    const steps = [
        {
            title: "Situation Report",
            icon: "📈",
            content: (
                <p>
                    Your latest score is <strong className="text-white text-3xl tabular-nums"><AnimatedNumber value={analysis.latestScore} /></strong>. 
                    This is a <strong className={`text-2xl ${analysis.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>{analysis.scoreDelta >= 0 ? '+' : ''}<AnimatedNumber value={analysis.scoreDelta} /></strong> point deviation from your average, indicating a <strong className="text-white">{analysis.scoreDelta >= 0 ? "positive" : "negative"}</strong> short-term trend.
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
                        <ReferenceLine y={analysis.avgScore} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Avg: ${analysis.avgScore.toFixed(0)}`, fill: "#94a3b8", fontSize: 10, position: 'insideTopLeft' }} />
                    </AreaChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Threat Vector",
            icon: "🎯",
            content: (
                 <p>
                    Your primary performance drag is <strong className="capitalize text-2xl text-red-400">{analysis.weakestSubjectName}</strong>. 
                    The cumulative mark gap between this and your strongest subject, <strong className="capitalize text-green-400">{analysis.strongestSubjectName}</strong>, is <strong className="text-white text-2xl"><AnimatedNumber value={analysis.scoreGap} /></strong> points on average. This imbalance is the key strategic vulnerability.
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.subjectData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="1 4" stroke="#334155" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" hide />
                        <YAxis dataKey="name" type="category" stroke="#fff" tick={{fontSize: 14, fontWeight: 'bold'}} width={90} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                            <LabelList dataKey="value" position="right" fill="#fff" fontSize={14} fontWeight="bold" formatter={(val: number) => val.toFixed(0)} />
                            {analysis.subjectData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Root Cause",
            icon: "🔬",
            content: (
                 <p>
                    Drilling down, the dominant error type is <strong className="text-amber-400 text-2xl">{analysis.topError.name}</strong>, responsible for <strong className="text-white text-2xl"><AnimatedNumber value={analysis.topError.value} /></strong> recorded errors. This signals a systemic issue in your problem-solving process that needs to be addressed.
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={analysis.errorData} cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" paddingAngle={5} dataKey="value">
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
                    The highest concentration of errors is in <strong className="text-cyan-400 text-2xl">{analysis.topTopic.topic}</strong>, with <strong className="text-white text-2xl">{analysis.topTopic.count}</strong> critical failures. This single topic is costing you an estimated <strong className="text-red-400 text-2xl"><AnimatedNumber value={analysis.marksLostInTopTopic} /> marks</strong> when it appears.
                </p>
            ),
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.topicData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="1 4" stroke="#334155" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" hide />
                        <YAxis dataKey="topic" type="category" stroke="#94a3b8" tick={{fontSize: 11}} width={120} interval={0} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
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
                <ul className="space-y-4">
                    <li className="flex items-start gap-4"><strong className="text-cyan-400 font-mono text-xl">01</strong><div><span className="block font-bold text-white">ISOLATE & DESTROY</span><span className="text-sm text-gray-400">Dedicate two full focus sessions to <strong className="text-cyan-300">{analysis.topTopic.topic}</strong>. Do not move on until accuracy hits 80% in practice.</span></div></li>
                    <li className="flex items-start gap-4"><strong className="text-cyan-400 font-mono text-xl">02</strong><div><span className="block font-bold text-white">SHORE UP DEFENSES</span><span className="text-sm text-gray-400">Raise your baseline in <strong className="capitalize text-red-300">{analysis.weakestSubjectName}</strong>. Review your short notes for this subject daily.</span></div></li>
                    <li className="flex items-start gap-4"><strong className="text-cyan-400 font-mono text-xl">03</strong><div><span className="block font-bold text-white">SYSTEM DEBUG</span><span className="text-sm text-gray-400">Implement a final answer verification step in your process to combat <strong className="text-amber-300">{analysis.topError.name}s</strong>.</span></div></li>
                </ul>
            ),
             chart: <div className="h-full w-full flex items-center justify-center p-4"><div className="text-center space-y-4"><div className="text-6xl">🚀</div><h3 className="text-2xl font-bold text-white">Ready to Execute?</h3><p className="text-gray-400 max-w-xs mx-auto">Data is a weapon. Use it.</p></div></div>
        },
        {
            title: "Final Diagnosis",
            icon: "🩺",
            content: (
                <div className="flex flex-col justify-center h-full">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Chief Analyst's Summary</p>
                    <p className="text-lg text-gray-200 leading-relaxed mt-4" dangerouslySetInnerHTML={{ __html: analysis.diagnosis.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }}></p>
                </div>
            ),
            chart: (
                <div className="h-full w-full flex items-center justify-center p-4">
                    <div className="text-center">
                        <svg className="w-24 h-24 mx-auto text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h3 className="text-2xl font-bold text-white mt-4">Mission Parameters Set</h3>
                        <p className="text-gray-400">Your path to improvement is clear.</p>
                    </div>
                </div>
            )
        }
    ];

    const currentStep = steps[activeStep];

    return (
        <div className="flex flex-col h-[640px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex-grow flex flex-col lg:flex-row relative">
                 {/* Background Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_98%,_rgba(var(--color-primary-rgb),0.2)_100%)] bg-[size:100%_3px] animate-[scan_8s_linear_infinite] pointer-events-none z-0"></div>
                <style>{`@keyframes scan { 0% { background-position: 0 0; } 100% { background-position: 0 100vh; } }`}</style>
                
                {/* Left: Narrative */}
                <div className="w-full lg:w-2/5 bg-black/20 border-r border-slate-800/50 p-8 flex flex-col justify-center relative">
                     {steps.map((step, index) => (
                         <div key={index} className={`absolute inset-0 p-8 flex flex-col justify-center transition-all duration-500 ease-in-out ${activeStep === index ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-cyan-900/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg">{step.icon}</div>
                                <h3 className="text-xs uppercase tracking-widest font-bold text-cyan-400">{step.title}</h3>
                            </div>
                            <div className={`text-gray-300 leading-relaxed ${hoveredMetric ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
                                {step.content}
                            </div>
                         </div>
                     ))}
                </div>

                {/* Right: Visual */}
                <div className="w-full lg:w-3/5 relative flex flex-col bg-slate-800/20">
                     <div className="flex-grow relative">
                        {steps.map((step, index) => (
                            <div key={index} className={`absolute inset-0 transition-all duration-500 ease-in-out ${activeStep === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}>
                                {step.chart}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="p-4 flex justify-between items-center border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm h-20 flex-shrink-0">
                <button 
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(p => Math.max(0, p - 1))}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Previous
                </button>
                
                {/* Timeline Navigator */}
                <div className="flex items-center gap-3">
                    {steps.map((step, i) => (
                        <button key={i} onClick={() => setActiveStep(i)} className="group relative">
                             <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${activeStep === i ? 'border-cyan-500 bg-cyan-500/20' : 'border-slate-700 group-hover:border-cyan-500/50'}`}>
                                 {step.icon}
                             </div>
                             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-700 text-white px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap">{step.title}</div>
                        </button>
                    ))}
                </div>

                <button 
                    disabled={activeStep === steps.length - 1}
                    onClick={() => setActiveStep(p => Math.min(steps.length - 1, p + 1))}
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-30 disabled:bg-slate-700 disabled:shadow-none flex items-center gap-2"
                >
                    Next Insight
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
            </div>
        </div>
    );
};