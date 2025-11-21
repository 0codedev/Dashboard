
import React, { useState, useMemo, useCallback } from 'react';
import type { UserProfile, QuestionLog, ChapterProgress, TestReport } from '../types';
import { TargetExam, SyllabusStatus, QuestionStatus, ErrorReason, TestType } from '../types';
import { JEE_SYLLABUS, SUBJECT_CONFIG, TOPIC_WEIGHTAGE, TOPIC_DEPENDENCIES, SUBJECT_COLORS } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import Modal from './common/Modal';
import { explainTopic } from '../services/geminiService';
import { SyllabusSunburst } from './visualizations/SyllabusSunburst';

interface SyllabusProps {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    questionLogs: QuestionLog[];
    reports: TestReport[];
    apiKey: string;
    onStartFocusSession: (topic: string) => void;
    setView: (view: any) => void;
    addTasksToPlanner?: (tasks: { task: string, time: number, topic: string }[]) => void; 
}

const COLORS_PIE: Record<string, string> = {
    [ErrorReason.ConceptualGap]: '#FBBF24', // amber-400
    [ErrorReason.MisreadQuestion]: '#34D399', // emerald-400
    [ErrorReason.SillyMistake]: '#F87171', // red-400
    [ErrorReason.TimePressure]: '#818CF8', // indigo-400
    [ErrorReason.Guess]: '#A78BFA', // violet-400
};

interface ChapterCardProps {
    chapter: { name: string, topics: string[] };
    progress: ChapterProgress;
    onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void;
    questionLogs: QuestionLog[];
    reports: TestReport[];
    onStartFocusSession: (topic: string) => void;
    pyqAttemptedCount: number;
    onExplainTopic: (topic: string) => void;
    userProfile: UserProfile; // needed for dependency checks
}

const statusColors: Record<SyllabusStatus, string> = {
    [SyllabusStatus.Completed]: "bg-green-500/10 border-green-500/30",
    [SyllabusStatus.Revising]: "bg-blue-500/10 border-blue-500/30",
    [SyllabusStatus.InProgress]: "bg-yellow-500/10 border-yellow-500/30",
    [SyllabusStatus.NotStarted]: "bg-slate-700/50 border-slate-700/80",
};

const SubjectDonutCard: React.FC<{ 
    subject: string; 
    chapters: string[]; 
    userProfile: UserProfile; 
    questionLogs: QuestionLog[] 
}> = ({ subject, chapters, userProfile, questionLogs }) => {
    
    const { data, totalChapters, completion } = useMemo(() => {
        const innerRingData = { strength: 0, weakness: 0, completed: 0, inProgress: 0, notStarted: 0 };
        const outerRingData = { highAcc: 0, midAcc: 0, lowAcc: 0, noData: 0 };
        
        const chapterAccuracies = new Map<string, number>();
        const chapterLogs = new Map<string, QuestionLog[]>();

        // Pre-process logs for this subject's chapters
        questionLogs.forEach(log => {
            if (log.topic && log.topic !== 'N/A' && chapters.includes(log.topic)) {
                if (!chapterLogs.has(log.topic)) chapterLogs.set(log.topic, []);
                chapterLogs.get(log.topic)!.push(log);
            }
        });

        chapterLogs.forEach((logs, topic) => {
            const correct = logs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
            const totalAttempted = logs.filter(l => l.status === QuestionStatus.FullyCorrect || l.status === QuestionStatus.Wrong).length;
            if (totalAttempted > 0) {
                chapterAccuracies.set(topic, (correct / totalAttempted) * 100);
            }
        });

        chapters.forEach(chapter => {
            const progress = userProfile.syllabus[chapter];

            // Inner Ring (Status)
            if (progress?.strength === 'strength') innerRingData.strength++;
            else if (progress?.strength === 'weakness') innerRingData.weakness++;
            else if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) innerRingData.completed++;
            else if (progress?.status === SyllabusStatus.InProgress) innerRingData.inProgress++;
            else innerRingData.notStarted++;

            // Outer Ring (Performance)
            const accuracy = chapterAccuracies.get(chapter);
            if (accuracy === undefined) outerRingData.noData++;
            else if (accuracy >= 80) outerRingData.highAcc++;
            else if (accuracy >= 50) outerRingData.midAcc++;
            else outerRingData.lowAcc++;
        });

        const weightedCompletion = ( (innerRingData.strength + innerRingData.weakness + innerRingData.completed) + (innerRingData.inProgress * 0.5) ) / chapters.length * 100;

        return {
            data: {
                inner: [
                    { name: 'Strength', value: innerRingData.strength, color: '#22c55e' },
                    { name: 'Weakness', value: innerRingData.weakness, color: '#ef4444' },
                    { name: 'Done', value: innerRingData.completed, color: '#3b82f6' },
                    { name: 'In Progress', value: innerRingData.inProgress, color: '#eab308' },
                    { name: 'Not Started', value: innerRingData.notStarted, color: '#334155' },
                ].filter(d => d.value > 0),
                outer: [
                    { name: 'High Acc (>80%)', value: outerRingData.highAcc, color: '#10b981' },
                    { name: 'Med Acc (50-80%)', value: outerRingData.midAcc, color: '#f59e0b' },
                    { name: 'Low Acc (<50%)', value: outerRingData.lowAcc, color: '#f43f5e' },
                    { name: 'No Data', value: outerRingData.noData, color: '#1e293b' },
                ].filter(d => d.value > 0)
            },
            totalChapters: chapters.length,
            completion: weightedCompletion
        };
    }, [subject, chapters, userProfile, questionLogs]);

    return (
        <div className="bg-slate-800 border border-slate-600 shadow-lg rounded-xl p-4 flex flex-col h-full">
            <h4 className="text-lg font-bold text-center mb-2 capitalize" style={{ color: SUBJECT_CONFIG[subject]?.color || 'white' }}>{subject}</h4>
            
            <div className="flex-grow relative min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <RechartsTooltip 
                            wrapperStyle={{ zIndex: 1000 }}
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px', padding: '8px' }}
                            itemStyle={{ color: '#e2e8f0' }}
                        />
                        {/* Inner Ring */}
                        <Pie 
                            data={data.inner} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            outerRadius={50} 
                            innerRadius={35} 
                            stroke="none"
                        >
                            {data.inner.map((entry, index) => <Cell key={`inner-${index}`} fill={entry.color} />)}
                        </Pie>
                        {/* Outer Ring */}
                        <Pie 
                            data={data.outer} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            innerRadius={55} 
                            outerRadius={75} 
                            stroke="none"
                        >
                            {data.outer.map((entry, index) => <Cell key={`outer-${index}`} fill={entry.color} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                {/* Central Completion Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-gray-300">{completion.toFixed(0)}%</span>
                </div>
            </div>

            <div className="mt-3">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <span>Completion</span>
                    <span>{completion.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${completion}%`, backgroundColor: SUBJECT_CONFIG[subject]?.color || 'white' }}
                    ></div>
                </div>
            </div>
            
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] text-gray-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Strength</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Weakness</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Done</div>
            </div>
        </div>
    );
};

const SyllabusOverviewWidget: React.FC<{ userProfile: UserProfile; questionLogs: QuestionLog[] }> = ({ userProfile, questionLogs }) => {
    const subjects = ['physics', 'chemistry', 'maths'];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subjects.map(subject => {
                    // @ts-ignore
                    const chapters = JEE_SYLLABUS[subject].flatMap(unit => unit.chapters.map(c => c.name));
                    return (
                        <SubjectDonutCard 
                            key={subject}
                            subject={subject}
                            chapters={chapters}
                            userProfile={userProfile}
                            questionLogs={questionLogs}
                        />
                    );
                })}
            </div>
        </div>
    );
};


// --- Memory Battery Icon Component ---
const MemoryBattery: React.FC<{ percentage: number; status: 'good' | 'fading' | 'critical' | 'dormant' | 'fresh'; daysAgo: number }> = ({ percentage, status, daysAgo }) => {
    let color = 'bg-slate-600';
    if (status === 'good' || status === 'fresh') color = 'bg-green-500';
    else if (status === 'fading') color = 'bg-yellow-400';
    else if (status === 'critical') color = 'bg-red-500';
    
    const blocks = Math.ceil(percentage / 25); // 1 to 4 blocks

    return (
        <div className="group relative flex items-center gap-1 cursor-help">
            <div className="w-6 h-3 border border-slate-500 rounded-sm p-[1px] flex gap-[1px]">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-full flex-1 rounded-[1px] ${i <= blocks ? color : 'bg-transparent'}`}></div>
                ))}
            </div>
            <div className="w-[2px] h-1.5 bg-slate-500 rounded-r-sm"></div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-xs text-white p-3 rounded-lg shadow-xl z-50 w-40 border border-slate-600 pointer-events-none">
                <p className="font-bold mb-1 flex justify-between items-center">
                    <span>Retention</span>
                    <span className={(status === 'good' || status === 'fresh') ? 'text-green-400' : status === 'fading' ? 'text-yellow-400' : status === 'critical' ? 'text-red-400' : 'text-gray-400'}>{percentage}%</span>
                </p>
                <p className="text-gray-400 text-[10px] mb-1">Last reviewed: <span className="text-white">{daysAgo === 0 ? 'Today' : daysAgo === -1 ? 'Never' : `${daysAgo} days ago`}</span></p>
                {status !== 'good' && status !== 'fresh' && status !== 'dormant' && <p className="text-cyan-400 text-[10px] font-semibold mt-1">Revision Recommended</p>}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-600 rotate-45"></div>
            </div>
        </div>
    );
};

const DependencyIndicator: React.FC<{ topic: string, userProfile: UserProfile }> = ({ topic, userProfile }) => {
    const prereqs = TOPIC_DEPENDENCIES[topic];
    if (!prereqs || prereqs.length === 0) return null;

    const incompletePrereqs = prereqs.filter(p => {
        const progress = userProfile.syllabus[p];
        return !progress || progress.status === SyllabusStatus.NotStarted;
    });

    const isBlocked = incompletePrereqs.length > 0;

    return (
        <div className="group relative">
            <span className={`text-xs px-1.5 py-0.5 rounded border cursor-help ${isBlocked ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isBlocked ? '⚠️ Prereq Missing' : '🔗 Prereqs OK'}
            </span>
            
             <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-slate-900 text-xs text-white p-3 rounded-lg shadow-xl z-50 w-48 border border-slate-600 pointer-events-none">
                <p className="font-bold mb-2 text-gray-300">Prerequisites:</p>
                <ul className="space-y-1">
                    {prereqs.map(p => {
                         const pProg = userProfile.syllabus[p];
                         const pDone = pProg && (pProg.status === SyllabusStatus.Completed || pProg.status === SyllabusStatus.Revising);
                         return (
                             <li key={p} className="flex justify-between items-center">
                                 <span>{p}</span>
                                 <span className={pDone ? 'text-green-400' : 'text-red-400'}>{pDone ? '✓' : '✗'}</span>
                             </li>
                         )
                    })}
                </ul>
                 <div className="absolute -bottom-1 left-4 w-2 h-2 bg-slate-900 border-b border-r border-slate-600 rotate-45"></div>
            </div>
        </div>
    );
}

const ChapterCard: React.FC<ChapterCardProps> = ({ chapter, progress, onSyllabusChange, questionLogs, reports, onStartFocusSession, pyqAttemptedCount, onExplainTopic, userProfile }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const weightage = TOPIC_WEIGHTAGE[chapter.name] || 'Low';
    const isHighYield = weightage === 'High';

    const memoryHealth = useMemo(() => {
        let lastInteractionDate = new Date('2000-01-01');
        let hasInteraction = false;

        questionLogs.forEach(log => {
            if (log.topic === chapter.name) {
                const report = reports.find(r => r.id === log.testId);
                if (report) {
                    const date = new Date(report.testDate);
                    if (date > lastInteractionDate) {
                        lastInteractionDate = date;
                        hasInteraction = true;
                    }
                }
            }
        });

        if (!hasInteraction && progress.status === SyllabusStatus.NotStarted) return { percentage: 0, status: 'dormant' as const, daysAgo: -1 };
        if (!hasInteraction) return { percentage: 100, status: 'fresh' as const, daysAgo: 0 };

        const today = new Date();
        const diffTime = Math.abs(today.getTime() - lastInteractionDate.getTime());
        const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        const stability = 7 * (1 + (progress.revisionCount || 0) * 0.5); 
        const retention = Math.exp(-daysAgo / stability);
        const retentionPercentage = Math.round(retention * 100);

        let status: 'good' | 'fading' | 'critical' = 'good';
        if (retentionPercentage < 50) status = 'critical';
        else if (retentionPercentage < 80) status = 'fading';

        return { percentage: retentionPercentage, status, daysAgo };

    }, [questionLogs, reports, chapter.name, progress.revisionCount, progress.status]);


    const chapterStats = useMemo(() => {
        const logs = questionLogs.filter(l => l.topic === chapter.name);
        const errors = logs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect);
        const errorReasons = errors.reduce((acc, log) => {
            if (log.reasonForError) {
                acc[log.reasonForError] = (acc[log.reasonForError] || 0) + 1;
            }
            return acc;
        }, {} as Record<ErrorReason, number>);
        const errorReasonData = Object.entries(errorReasons).map(([name, value]) => ({ name, value }));
        
        const attemptedLogs = logs.filter(l => l.status !== QuestionStatus.Unanswered);
        const correctLogs = logs.filter(l => l.status === QuestionStatus.FullyCorrect);

        const accuracy = (correctLogs.length + errors.length) > 0 ? (correctLogs.length / (correctLogs.length + errors.length)) * 100 : 0;
        const attemptRate = logs.length > 0 ? (attemptedLogs.length / logs.length) * 100 : 0;
        const totalMarksForAttempted = attemptedLogs.reduce((sum, l) => sum + l.marksAwarded, 0);
        const spaq = attemptedLogs.length > 0 ? (totalMarksForAttempted / attemptedLogs.length) : 0;

        const accuracyTrend = reports
            .map(report => {
                const reportLogs = questionLogs.filter(l => l.testId === report.id && l.topic === chapter.name);
                if (reportLogs.length === 0) return null;
                const reportCorrect = reportLogs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
                const reportErrors = reportLogs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect).length;
                if (reportCorrect + reportErrors === 0) return null;
                const acc = (reportCorrect / (reportCorrect + reportErrors)) * 100;
                return { name: report.testName, accuracy: acc };
            })
            .filter((item): item is { name: string; accuracy: number } => item !== null)
            .slice(-5);

        return { totalQuestions: logs.length, errorCount: errors.length, errorReasons: errorReasonData, accuracy, attemptRate, spaq, accuracyTrend };
    }, [questionLogs, reports, chapter.name]);

    const handleUpdate = <K extends keyof ChapterProgress>(key: K, value: ChapterProgress[K]) => {
        onSyllabusChange(chapter.name, { [key]: value });
    };

    const weightedProgress = useMemo(() => {
        let weight = 0;
        if (progress.lectureCompleted) weight += 0.25;
        if (progress.practiceCompleted) weight += 0.25;
        if (pyqAttemptedCount > 0) weight += 0.3 * Math.min(1, pyqAttemptedCount / 10);
        if (Number(progress.revisionCount || 0) > 0) weight += 0.2 * Math.min(1, Number(progress.revisionCount || 0) / 2);
        return Math.min(1, weight) * 100;
    }, [progress, pyqAttemptedCount]);

    return (
        <div className={`relative rounded-lg border transition-all duration-300 ${statusColors[progress.status]} ${isHighYield ? 'shadow-[0_0_15px_rgba(245,158,11,0.15)] border-amber-500/40' : ''}`}>
             <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                 {isHighYield && (
                    <div className="absolute -right-6 top-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-bold px-8 py-1 rotate-45 shadow-md z-10">
                        HIGH YIELD
                    </div>
                )}
             </div>

            <div className="p-3 relative z-10">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    {progress.strength === 'strength' && <span title="Strength" className="text-lg">💪</span>}
                    {progress.strength === 'weakness' && <span title="Weakness" className="text-lg text-red-400">⚠️</span>}
                    
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold truncate ${isHighYield ? 'text-amber-100' : 'text-gray-200'}`}>{chapter.name}</p>
                            <MemoryBattery percentage={memoryHealth.percentage} status={memoryHealth.status} daysAgo={memoryHealth.daysAgo} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 bg-slate-700/50 rounded-full h-1.5 flex-shrink-0">
                                <div className="bg-[rgb(var(--color-primary-rgb))] h-1.5 rounded-full" style={{ width: `${weightedProgress}%` }}></div>
                            </div>
                            <p className="text-[10px] text-gray-400 uppercase">{progress.status.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                    {chapterStats.errorCount > 0 && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-semibold flex-shrink-0 hidden sm:inline-block">{chapterStats.errorCount} Errors</span>}
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center">
                             <DependencyIndicator topic={chapter.name} userProfile={userProfile} />
                             <span className="text-[10px] text-gray-500">Weightage: {weightage}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Status</label>
                                <select value={progress.status} onChange={e => handleUpdate('status', e.target.value as SyllabusStatus)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md">
                                    {Object.values(SyllabusStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Strength/Weakness</label>
                                <select value={progress.strength || ''} onChange={e => handleUpdate('strength', e.target.value as 'strength' | 'weakness' || null)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md">
                                    <option value="">Not Tagged</option>
                                    <option value="strength">Strength</option>
                                    <option value="weakness">Weakness</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.lectureCompleted} onChange={e => handleUpdate('lectureCompleted', e.target.checked)} className="form-checkbox h-4 w-4 bg-slate-600 text-cyan-500 rounded"/> Lectures Done</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.practiceCompleted} onChange={e => handleUpdate('practiceCompleted', e.target.checked)} className="form-checkbox h-4 w-4 bg-slate-600 text-cyan-500 rounded"/> Practice Done</label>
                            <div className="flex items-center gap-2 text-sm text-gray-300 h-6">
                                <span className="w-4 h-4 flex items-center justify-center text-cyan-300">📈</span>
                                <span>PYQ Practice</span>
                                <span className="font-semibold text-white ml-auto bg-slate-700 px-2 py-0.5 rounded-md">{pyqAttemptedCount} questions</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Revisions</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleUpdate('revisionCount', Math.max(0, Number(progress.revisionCount || 0) - 1))} className="px-2 py-1 bg-slate-700 rounded">-</button>
                                <span className="font-semibold text-cyan-300">{progress.revisionCount || 0}</span>
                                <button onClick={() => handleUpdate('revisionCount', (Number(progress.revisionCount || 0) || 0) + 1)} className="px-2 py-1 bg-slate-700 rounded">+</button>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Live Performance</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                                <div className="bg-slate-900/50 p-2 rounded"><p className="text-gray-400">Accuracy</p><p className="font-bold text-lg text-white">{chapterStats.accuracy.toFixed(1)}%</p></div>
                                <div className="bg-slate-900/50 p-2 rounded"><p className="text-gray-400">Attempt Rate</p><p className="font-bold text-lg text-white">{chapterStats.attemptRate.toFixed(1)}%</p></div>
                                <div className="bg-slate-900/50 p-2 rounded"><p className="text-gray-400">SPAQ</p><p className="font-bold text-lg text-white">{chapterStats.spaq.toFixed(2)}</p></div>
                                <div className="bg-slate-900/50 p-2 rounded h-16">
                                    <p className="text-gray-400">Accuracy Trend</p>
                                    {chapterStats.accuracyTrend.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chapterStats.accuracyTrend} margin={{top: 5, right: 0, left: 0, bottom: 0}}>
                                            <defs><linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="rgb(var(--color-primary-rgb))" stopOpacity={0.4}/><stop offset="95%" stopColor="rgb(var(--color-primary-rgb))" stopOpacity={0}/></linearGradient></defs>
                                            <YAxis domain={[0, 100]} hide />
                                            <Area type="monotone" dataKey="accuracy" stroke="rgb(var(--color-primary-rgb))" strokeWidth={2} fill="url(#sparklineGradient)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    ) : <p className="text-gray-500 text-xs mt-1">Not enough data</p>}
                                </div>
                            </div>
                        </div>

                        {chapterStats.errorCount > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Error Analysis</h4>
                                <div className="h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chapterStats.errorReasons} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5}>
                                                {chapterStats.errorReasons.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PIE[entry.name] || '#8884d8'} />)}
                                            </Pie>
                                            <RechartsTooltip content={<div className="p-2 bg-slate-800 border border-slate-600 rounded-md text-xs"><p className="font-bold text-white">{chapterStats.errorReasons[0]?.name}</p></div>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-2">
                            <button onClick={() => onStartFocusSession(chapter.name)} className="flex-1 text-sm bg-indigo-600/50 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2">⚡️ Start Focus Session</button>
                            <button onClick={() => onExplainTopic(chapter.name)} className="flex-1 text-sm bg-cyan-600/50 hover:bg-cyan-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2">📖 Explain Topic</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SubjectSyllabus: React.FC<Omit<SyllabusProps, 'userProfile' | 'apiKey' | 'setView' | 'setUserProfile'> & { subject: 'physics' | 'chemistry' | 'maths', userProfile: UserProfile, onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void; onExplainTopic: (topic: string) => void; searchQuery: string; activeUnitFilter?: string | null; }> = ({ subject, userProfile, onSyllabusChange, questionLogs, reports, onStartFocusSession, onExplainTopic, searchQuery, activeUnitFilter }) => {
    const [filter, setFilter] = useState<{ status: string, strength: string }>({ status: 'all', strength: 'all' });
    const [sort, setSort] = useState<string>('default');
    const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

    const getChapterErrorCount = useCallback((chapterName: string) => {
        return questionLogs.filter(l => l.topic === chapterName && (l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect)).length;
    }, [questionLogs]);

    const getChapterAccuracy = useCallback((chapterName: string) => {
        const logs = questionLogs.filter(l => l.topic === chapterName);
        const errors = logs.filter(l => l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect).length;
        const correct = logs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
        if (correct + errors === 0) return -1; // No data
        return (correct / (correct + errors)) * 100;
    }, [questionLogs]);

    const processedSyllabusData = useMemo(() => {
        return JEE_SYLLABUS[subject].map(unit => {
            // Unit Filter Logic
            if (activeUnitFilter && unit.unit !== activeUnitFilter) return null;

            const chapters = unit.chapters
                .filter(chapter => {
                    // Search filter
                    if (searchQuery && !chapter.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return false;
                    }
                    const progress = userProfile.syllabus[chapter.name];
                    const statusMatch = filter.status === 'all' || (progress && progress.status === filter.status) || (!progress && filter.status === SyllabusStatus.NotStarted);
                    const strengthMatch = filter.strength === 'all' || (progress && progress.strength === filter.strength) || (filter.strength === 'null' && (!progress || !progress.strength));
                    return statusMatch && strengthMatch;
                })
                .sort((a, b) => {
                    if (sort === 'errors_desc') return getChapterErrorCount(b.name) - getChapterErrorCount(a.name);
                    if (sort === 'accuracy_asc') {
                        const accA = getChapterAccuracy(a.name);
                        const accB = getChapterAccuracy(b.name);
                        if (accA === -1) return 1; // Put no-data items at the end
                        if (accB === -1) return -1;
                        return accA - accB;
                    }
                    if (sort === 'weightage') {
                         const wA = TOPIC_WEIGHTAGE[a.name] === 'High' ? 3 : TOPIC_WEIGHTAGE[a.name] === 'Medium' ? 2 : 1;
                         const wB = TOPIC_WEIGHTAGE[b.name] === 'High' ? 3 : TOPIC_WEIGHTAGE[b.name] === 'Medium' ? 2 : 1;
                         return wB - wA;
                    }
                    return a.name.localeCompare(b.name);
                });
            return { ...unit, chapters };
        }).filter(unit => unit && unit.chapters.length > 0); // Only show units with matching chapters
    }, [subject, userProfile.syllabus, filter, sort, getChapterErrorCount, getChapterAccuracy, searchQuery, activeUnitFilter]);

    const pyqAttemptedCounts = useMemo(() => {
        const counts = new Map<string, number>();
        const pyqReportIds = new Set(reports.filter(r => r.type === TestType.PreviousYearPaper).map(r => r.id));
        questionLogs.forEach(log => {
            if (pyqReportIds.has(log.testId) && log.topic) {
                counts.set(log.topic, (counts.get(log.topic) || 0) + 1);
            }
        });
        return counts;
    }, [questionLogs, reports]);
    
    const toggleUnit = (unitName: string) => {
        setCollapsedUnits(prev => {
            const next = new Set(prev);
            if (next.has(unitName)) next.delete(unitName);
            else next.add(unitName);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Status:</span>
                    <select value={filter.status} onChange={e => setFilter(prev => ({...prev, status: e.target.value}))} className="bg-slate-700 text-sm p-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                        <option value="all">All</option>
                        {Object.values(SyllabusStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Strength:</span>
                    <select value={filter.strength} onChange={e => setFilter(prev => ({...prev, strength: e.target.value}))} className="bg-slate-700 text-sm p-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                        <option value="all">All</option>
                        <option value="strength">Strength</option>
                        <option value="weakness">Weakness</option>
                        <option value="null">Unmarked</option>
                    </select>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Sort By:</span>
                    <select value={sort} onChange={e => setSort(e.target.value)} className="bg-slate-700 text-sm p-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                        <option value="default">Alphabetical</option>
                        <option value="errors_desc">Most Errors</option>
                        <option value="accuracy_asc">Lowest Accuracy</option>
                        <option value="weightage">High Yield First</option>
                    </select>
                </div>
            </div>
            
            <div className="space-y-8">
                {processedSyllabusData.map(unit => (
                    <div key={unit!.unit} className="animate-fade-in">
                        <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => toggleUnit(unit!.unit)}>
                            <button className="text-gray-400 hover:text-white">
                                {collapsedUnits.has(unit!.unit) ? '▶' : '▼'}
                            </button>
                            <h3 className="text-lg font-bold text-cyan-200 border-b border-slate-700 pb-1 flex-grow">{unit!.unit} <span className="text-sm font-normal text-gray-500 ml-2">({unit!.chapters.length})</span></h3>
                        </div>
                        {!collapsedUnits.has(unit!.unit) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {unit!.chapters.map(chapter => {
                                    const defaultProgress: ChapterProgress = { status: SyllabusStatus.NotStarted, strength: null, lectureCompleted: false, practiceCompleted: false, revisionCount: 0 };
                                    const progress: ChapterProgress = { ...defaultProgress, ...(userProfile.syllabus[chapter.name] || {}) };
                                    return (
                                    <ChapterCard 
                                        key={chapter.name} 
                                        chapter={chapter} 
                                        progress={progress} 
                                        onSyllabusChange={onSyllabusChange} 
                                        questionLogs={questionLogs} 
                                        reports={reports} 
                                        onStartFocusSession={onStartFocusSession}
                                        pyqAttemptedCount={pyqAttemptedCounts.get(chapter.name) || 0}
                                        onExplainTopic={onExplainTopic}
                                        userProfile={userProfile}
                                    />
                                )})}
                            </div>
                        )}
                    </div>
                ))}
                {processedSyllabusData.length === 0 && <p className="text-center text-gray-400 py-8">No chapters found matching your filters.</p>}
            </div>
        </div>
    );
};

export const Syllabus: React.FC<SyllabusProps> = ({ userProfile, setUserProfile, questionLogs, reports, apiKey, onStartFocusSession, setView, addTasksToPlanner }) => {
    const [activeSubject, setActiveSubject] = useState<'physics' | 'chemistry' | 'maths'>('physics');
    const [activeUnit, setActiveUnit] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [explainModalData, setExplainModalData] = useState<{ topic: string; content: string; loading: boolean } | null>(null);
    const [vizMode, setVizMode] = useState<'sunburst' | 'overview'>('overview'); // View Toggle State

    const handleSyllabusChange = (chapter: string, updatedProgress: Partial<ChapterProgress>) => {
        setUserProfile(prev => ({
            ...prev,
            syllabus: {
                ...prev.syllabus,
                [chapter]: {
                    ...(prev.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, lectureCompleted: false, practiceCompleted: false, revisionCount: 0 }),
                    ...updatedProgress
                }
            }
        }));
    };
    
    const handleExplainTopic = async (topic: string) => {
        setExplainModalData({ topic, content: '', loading: true });
        try {
            const explanation = await explainTopic(topic, apiKey);
            setExplainModalData(prev => prev ? { ...prev, content: explanation, loading: false } : null);
        } catch (error) {
            setExplainModalData(prev => prev ? { ...prev, content: "Failed to load explanation.", loading: false } : null);
        }
    };

    // Robust logic for identifying revision topics
    const revisionStackTopics = useMemo(() => {
        const topics: { name: string, weight: number, reason: string }[] = [];
        
        // Ensure we check ALL chapters defined in syllabus, not just those with progress
        // @ts-ignore
        const syllabusChapters = Object.values(JEE_SYLLABUS).flatMap(subject => subject.flatMap(unit => unit.chapters.map(c => c.name)));
        
        syllabusChapters.forEach(chapter => {
            const progress = userProfile.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0 };
            const baseWeight = TOPIC_WEIGHTAGE[chapter] === 'High' ? 3 : TOPIC_WEIGHTAGE[chapter] === 'Medium' ? 2 : 1;

            // Logic 1: Fading retention (requires question log data)
            let lastInteractionDate = new Date('2000-01-01');
            let hasInteraction = false;
             questionLogs.forEach(log => {
                if (log.topic === chapter) {
                    const report = reports.find(r => r.id === log.testId);
                    if (report) {
                        const date = new Date(report.testDate);
                        if (date > lastInteractionDate) {
                            lastInteractionDate = date;
                            hasInteraction = true;
                        }
                    }
                }
            });
            
            if(hasInteraction) {
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - lastInteractionDate.getTime());
                const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                const stability = 7 * (1 + (progress.revisionCount || 0) * 0.5); 
                const retention = Math.exp(-daysAgo / stability);
                
                if(retention < 0.7) { // Fading
                    const urgency = retention < 0.4 ? 2 : 1;
                    topics.push({ name: chapter, weight: baseWeight * 5 * urgency, reason: 'Fading Memory' });
                    return; 
                }
            }

            // Logic 2: Explicit Weakness
            if (progress.strength === 'weakness') {
                topics.push({ name: chapter, weight: baseWeight * 4, reason: 'Marked Weakness' });
                return;
            }

            // Logic 3: In Progress (Finish it!)
            if (progress.status === SyllabusStatus.InProgress) {
                topics.push({ name: chapter, weight: baseWeight * 2, reason: 'In Progress' });
                return;
            }
        });

        // Fallback: If list is empty, pick InProgress or NotStarted High Weightage to encourage progress
        if (topics.length === 0) {
             syllabusChapters.forEach(chapter => {
                 const progress = userProfile.syllabus[chapter];
                 if(progress && progress.status === SyllabusStatus.InProgress) {
                     topics.push({ name: chapter, weight: 1, reason: 'Continue Progress' });
                 }
             });
        }

        // Sort by weight descending
        return topics.sort((a, b) => b.weight - a.weight).slice(0, 5);
    }, [userProfile.syllabus, questionLogs, reports]);

    const handleGenerateRevisionStack = () => {
        if(revisionStackTopics.length === 0) {
            alert("You haven't marked enough chapters as 'In Progress' or 'Weakness' to generate a targeted stack. Please update your syllabus status.");
            return;
        }
        
        if(addTasksToPlanner) {
            const tasks = revisionStackTopics.map(t => ({
                task: `Revise: ${t.name} (${t.reason})`,
                time: 30,
                topic: t.name
            }));
            addTasksToPlanner(tasks);
            // Removed explicit navigation to planner to allow user to stay in context
            // setView('daily-planner'); 
        } else {
            // Fallback if planner not available
            onStartFocusSession(revisionStackTopics[0].name);
        }
    };

    const handleSunburstClick = (type: 'subject' | 'unit', name: string) => {
        if (type === 'subject') {
            setActiveSubject(name.toLowerCase() as 'physics' | 'chemistry' | 'maths');
            setActiveUnit(null);
        } else if (type === 'unit') {
            const subject = ['physics', 'chemistry', 'maths'].find(sub => {
                // @ts-ignore
                return JEE_SYLLABUS[sub].some((u: any) => u.unit === name);
            });
            if (subject) {
                setActiveSubject(subject as 'physics' | 'chemistry' | 'maths');
                setActiveUnit(name);
            }
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--color-primary-accent-rgb))]">Syllabus Tracker</h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600 shadow-lg">
                        <button onClick={() => setVizMode('overview')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${vizMode === 'overview' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Overview</button>
                        <button onClick={() => setVizMode('sunburst')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${vizMode === 'sunburst' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>Sunburst</button>
                    </div>
                    <button 
                        onClick={handleGenerateRevisionStack}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                        title="Auto-generate tasks for fading, weak, or in-progress topics"
                    >
                        <span>🧠</span> Generate Revision Stack
                        {revisionStackTopics.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{revisionStackTopics.length}</span>}
                    </button>
                     <input 
                        type="text" 
                        placeholder="Search chapters..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="bg-slate-700 border border-slate-600 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none w-64"
                    />
                </div>
            </div>

            {/* Visualization Container */}
            <div className="relative">
                {vizMode === 'sunburst' ? (
                    <SyllabusSunburst userProfile={userProfile} onSliceClick={handleSunburstClick} />
                ) : (
                    <SyllabusOverviewWidget userProfile={userProfile} questionLogs={questionLogs} />
                )}
            </div>

            <div className="flex items-center gap-4 border-b border-slate-700 overflow-x-auto">
                 {(['physics', 'chemistry', 'maths'] as const).map(subject => (
                     <button
                        key={subject}
                        onClick={() => { setActiveSubject(subject); setActiveUnit(null); }}
                        className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeSubject === subject ? `border-[${SUBJECT_CONFIG[subject].color}] text-white` : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        style={{ borderColor: activeSubject === subject ? SUBJECT_CONFIG[subject].color : 'transparent', color: activeSubject === subject ? SUBJECT_CONFIG[subject].color : undefined }}
                    >
                        {subject}
                    </button>
                 ))}
                 {activeUnit && (
                     <div className="flex items-center gap-2 pb-3 text-sm font-bold text-cyan-300 border-b-2 border-cyan-300 whitespace-nowrap animate-fade-in">
                         <span className="text-gray-500">/</span> {activeUnit} 
                         <button onClick={() => setActiveUnit(null)} className="ml-1 text-gray-500 hover:text-white font-normal">✕</button>
                     </div>
                 )}
            </div>

            <SubjectSyllabus 
                subject={activeSubject} 
                userProfile={userProfile} 
                onSyllabusChange={handleSyllabusChange} 
                questionLogs={questionLogs} 
                reports={reports} 
                onStartFocusSession={onStartFocusSession}
                onExplainTopic={handleExplainTopic}
                searchQuery={searchQuery}
                activeUnitFilter={activeUnit}
            />
            
             <Modal isOpen={!!explainModalData} onClose={() => setExplainModalData(null)} title={`Concept: ${explainModalData?.topic}`}>
                <div className="p-4 prose prose-invert max-w-none">
                    {explainModalData?.loading ? (
                        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                            Generating explanation...
                        </div>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: explainModalData?.content.replace(/\n/g, '<br/>') || '' }} />
                    )}
                </div>
            </Modal>
        </div>
    );
};
