
import React, { useState, useMemo } from 'react';
import { 
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Legend
} from 'recharts';
import { TestReport, QuestionLog, QuestionStatus, ErrorReason } from '../../types';
import { SUBJECT_COLORS, SUBJECT_CONFIG } from '../../constants';
import CustomTooltip from '../common/CustomTooltip';

interface ExecutiveBriefingProps {
    reports: TestReport[];
    logs: QuestionLog[];
}

export const ExecutiveBriefing: React.FC<ExecutiveBriefingProps> = ({ reports, logs }) => {
    const [activeStep, setActiveStep] = useState(0);

    // --- Data Processing ---
    const analysis = useMemo(() => {
        if (reports.length === 0) return null;

        const latestReport = reports[reports.length - 1];
        const totalMarks = reports.reduce((sum, r) => sum + r.total.marks, 0);
        const avgScore = totalMarks / reports.length;
        const scoreTrend = reports.map(r => ({ name: r.testName, score: r.total.marks }));
        
        // Subject contribution
        const subjectScores = {
            physics: reports.reduce((sum, r) => sum + r.physics.marks, 0),
            chemistry: reports.reduce((sum, r) => sum + r.chemistry.marks, 0),
            maths: reports.reduce((sum, r) => sum + r.maths.marks, 0),
        };
        const weakestSubject = Object.entries(subjectScores).sort((a, b) => a[1] - b[1])[0];

        // Error Reasons
        const errorCounts: Record<string, number> = {};
        logs.forEach(l => {
            if ((l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect) && l.reasonForError) {
                errorCounts[l.reasonForError] = (errorCounts[l.reasonForError] || 0) + 1;
            }
        });
        const sortedErrors = Object.entries(errorCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
        const topError = sortedErrors[0] || { name: 'None', value: 0 };

        // Weakest Topic
        const topicCounts: Record<string, number> = {};
        logs.forEach(l => {
            if ((l.status === QuestionStatus.Wrong) && l.topic && l.topic !== 'N/A') {
                topicCounts[l.topic] = (topicCounts[l.topic] || 0) + 1;
            }
        });
        const sortedTopics = Object.entries(topicCounts)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        const topTopic = sortedTopics[0] || { topic: 'None', count: 0 };

        return {
            latestScore: latestReport.total.marks,
            avgScore,
            scoreTrend,
            subjectData: [
                { name: 'Physics', value: subjectScores.physics, fill: SUBJECT_COLORS.physics },
                { name: 'Chemistry', value: subjectScores.chemistry, fill: SUBJECT_COLORS.chemistry },
                { name: 'Maths', value: subjectScores.maths, fill: SUBJECT_COLORS.maths },
            ],
            weakestSubjectName: weakestSubject[0],
            errorData: sortedErrors.slice(0, 4),
            topError,
            topicData: sortedTopics,
            topTopic
        };
    }, [reports, logs]);

    if (!analysis) return <div className="p-8 text-center text-gray-400">Insufficient data for briefing.</div>;

    const steps = [
        {
            title: "The Headline",
            subtitle: "Performance Trajectory",
            content: (
                <div className="space-y-4">
                    <p className="text-lg text-gray-300 leading-relaxed">
                        Your latest score is <strong className="text-white text-2xl">{analysis.latestScore}</strong>. 
                        compared to your average of <span className="text-cyan-400 font-mono">{analysis.avgScore.toFixed(0)}</span>.
                        {analysis.latestScore > analysis.avgScore 
                            ? " You are trending upwards. Momentum is on your side." 
                            : " You are currently dipping below your baseline. Immediate course correction is required."}
                    </p>
                </div>
            ),
            chart: (
                <div className="h-full w-full p-4">
                    <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Total Score Trend</h4>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={analysis.scoreTrend}>
                            <defs>
                                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 10}} />
                            <YAxis stroke="#94a3b8" domain={['dataMin - 10', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={3} fill="url(#scoreGradient)" />
                            <ReferenceLine y={analysis.avgScore} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Avg", fill: "#94a3b8", fontSize: 10 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )
        },
        {
            title: "The Imbalance",
            subtitle: "Subject Distribution",
            content: (
                <div className="space-y-4">
                    <p className="text-lg text-gray-300 leading-relaxed">
                        <strong className="capitalize text-red-400">{analysis.weakestSubjectName}</strong> is currently your primary drag factor.
                        The cumulative mark gap between your strongest and weakest subject is substantial.
                    </p>
                    <p className="text-sm text-gray-400">
                        Balancing this distribution is the fastest mathematical way to improve your total rank.
                    </p>
                </div>
            ),
            chart: (
                <div className="h-full w-full p-4">
                    <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Cumulative Marks by Subject</h4>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={analysis.subjectData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" hide />
                            <YAxis dataKey="name" type="category" stroke="#fff" tick={{fontSize: 12, fontWeight: 'bold'}} width={80} />
                            <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                                <LabelList dataKey="value" position="right" fill="#fff" fontSize={12} fontWeight="bold" />
                                {analysis.subjectData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )
        },
        {
            title: "The Root Cause",
            subtitle: "Error Diagnostics",
            content: (
                <div className="space-y-4">
                    <p className="text-lg text-gray-300 leading-relaxed">
                        Your dominant error type is <strong className="text-amber-400">{analysis.topError.name}</strong> ({analysis.topError.value} instances).
                    </p>
                    <div className="bg-slate-800/50 p-3 rounded-lg border-l-4 border-amber-500 text-sm text-gray-300">
                        {analysis.topError.name === 'Silly Mistake' && "This indicates a lack of focus or rushing. Slow down the last 10% of every problem."}
                        {analysis.topError.name === 'Conceptual Gap' && "You are attempting problems where the fundamental theory is shaky. Review notes before solving."}
                        {analysis.topError.name === 'Time Pressure' && "Speed is an issue. You might be spending too long on 'ego questions'."}
                        {!['Silly Mistake', 'Conceptual Gap', 'Time Pressure'].includes(analysis.topError.name) && "Analyze these errors specifically to find the pattern."}
                    </div>
                </div>
            ),
            chart: (
                <div className="h-full w-full p-4 flex flex-col items-center">
                    <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Error Breakdown</h4>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={analysis.errorData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {analysis.errorData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'][index % 4]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-6">
                        <div className="text-center">
                            <span className="block text-3xl font-bold text-white">{analysis.topError.value}</span>
                            <span className="text-xs text-gray-400">Errors</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "The Money Pit",
            subtitle: "Topic Analysis",
            content: (
                <div className="space-y-4">
                    <p className="text-lg text-gray-300 leading-relaxed">
                        If you fix only one thing this week, fix <strong className="text-cyan-400">{analysis.topTopic.topic}</strong>.
                    </p>
                    <p className="text-gray-400">
                        This single topic is responsible for <span className="text-white font-bold">{analysis.topTopic.count}</span> recorded errors.
                        Mastering this will provide the highest Return on Time Invested (ROTI).
                    </p>
                </div>
            ),
            chart: (
                <div className="h-full w-full p-4">
                    <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Top 5 Pain Points</h4>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={analysis.topicData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" hide />
                            <YAxis dataKey="topic" type="category" stroke="#94a3b8" tick={{fontSize: 11}} width={100} interval={0} />
                            <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                                <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )
        },
        {
            title: "The Prescription",
            subtitle: "Executive Orders",
            content: (
                <div className="space-y-6">
                    <p className="text-lg text-gray-300">Based on this data, here is your strategic plan for the next cycle:</p>
                    
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <span className="text-xl">🎯</span>
                            <div>
                                <span className="block text-sm font-bold text-white">Focus Session</span>
                                <span className="text-xs text-gray-400">Schedule 2 hours specifically for <strong className="text-cyan-400">{analysis.topTopic.topic}</strong>.</span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <span className="text-xl">🚫</span>
                            <div>
                                <span className="block text-sm font-bold text-white">Stop The Bleeding</span>
                                <span className="text-xs text-gray-400">Before the next test, review your notes on <strong className="text-red-300 capitalize">{analysis.weakestSubjectName}</strong> to prevent easy mark loss.</span>
                            </div>
                        </li>
                        <li className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <span className="text-xl">🧠</span>
                            <div>
                                <span className="block text-sm font-bold text-white">Mindset Check</span>
                                <span className="text-xs text-gray-400">Address <strong>{analysis.topError.name}s</strong> by adding a 10-second "sanity check" before marking answers.</span>
                            </div>
                        </li>
                    </ul>
                </div>
            ),
            chart: (
                <div className="h-full w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
                    <div className="text-center space-y-4">
                        <div className="text-6xl">🚀</div>
                        <h3 className="text-2xl font-bold text-white">Ready to Execute?</h3>
                        <p className="text-gray-400 max-w-xs mx-auto">Data is only useful if acted upon. Switch to the Daily Planner to schedule these tasks.</p>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col lg:flex-row h-[600px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* Left: Narrative Stepper */}
            <div className="w-full lg:w-1/3 bg-slate-900 border-r border-slate-800 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-2">
                {steps.map((step, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveStep(index)}
                        className={`text-left p-4 rounded-xl transition-all duration-300 group border ${
                            activeStep === index 
                                ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-900/20' 
                                : 'bg-transparent border-transparent hover:bg-slate-800/50'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-1">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                                activeStep === index ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-gray-400'
                            }`}>
                                {index + 1}
                            </span>
                            <span className={`text-xs uppercase tracking-wider font-bold ${
                                activeStep === index ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-400'
                            }`}>
                                {step.subtitle}
                            </span>
                        </div>
                        <h3 className={`text-xl font-bold mb-2 ${activeStep === index ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                            {step.title}
                        </h3>
                        <div className={`overflow-hidden transition-all duration-500 ${activeStep === index ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                            {step.content}
                        </div>
                    </button>
                ))}
            </div>

            {/* Right: Visual Focus */}
            <div className="w-full lg:w-2/3 bg-slate-900/50 relative flex flex-col">
                <div className="absolute top-0 right-0 p-4 z-10">
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1 w-8 rounded-full transition-colors duration-300 ${i === activeStep ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
                        ))}
                    </div>
                </div>
                
                <div className="flex-grow relative">
                    {steps.map((step, index) => (
                        <div 
                            key={index}
                            className={`absolute inset-0 p-6 transition-all duration-500 transform ${
                                activeStep === index 
                                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
                                    : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                            }`}
                        >
                            <div className="h-full w-full bg-slate-800/40 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-sm overflow-hidden">
                                {step.chart}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-4 flex justify-between items-center border-t border-slate-800 bg-slate-900/80 backdrop-blur">
                    <button 
                        disabled={activeStep === 0}
                        onClick={() => setActiveStep(p => Math.max(0, p - 1))}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30"
                    >
                        ← Previous
                    </button>
                    <button 
                        disabled={activeStep === steps.length - 1}
                        onClick={() => setActiveStep(p => Math.min(steps.length - 1, p + 1))}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-30 disabled:bg-slate-700 disabled:shadow-none"
                    >
                        Next Insight →
                    </button>
                </div>
            </div>
        </div>
    );
};
