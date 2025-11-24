
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { UserProfile, QuestionLog, ChapterProgress, TestReport, QuizQuestion } from '../types';
import { TargetExam, SyllabusStatus, QuestionStatus, ErrorReason, TestType } from '../types';
import { JEE_SYLLABUS, SUBJECT_CONFIG, TOPIC_WEIGHTAGE, TOPIC_DEPENDENCIES, SUBJECT_COLORS } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import Modal from './common/Modal';
import { explainTopic, generateGatekeeperQuiz, generateLearningPath } from '../services/geminiService';
import { SyllabusSunburst } from './visualizations/SyllabusSunburst';
import { SyllabusSubwayMap } from './visualizations/SyllabusSubwayMap';
import { SyllabusRiverFlow } from './visualizations/SyllabusRiverFlow';
import { SyllabusTree } from './visualizations/SyllabusTree';


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

// --- Strategic Planner Component ---
const StrategicPlanner: React.FC<{ userProfile: UserProfile }> = ({ userProfile }) => {
    const { velocity, requiredVelocity, isOnTrack, remainingChapters, daysLeft } = useMemo(() => {
        const syllabusValues = Object.values(userProfile.syllabus) as Partial<ChapterProgress>[];
        const completed = syllabusValues
            .filter(p => p?.completionDate && (p.status === SyllabusStatus.Completed || p.status === SyllabusStatus.Revising))
            .map(p => ({ date: new Date(p!.completionDate!) }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const allChaptersCount = Object.values(JEE_SYLLABUS).flatMap(subject => subject.flatMap(unit => unit.chapters)).length;
        const remaining = allChaptersCount - completed.length;

        let actualVel = 0;
        if (completed.length >= 2) {
            const firstDate = completed[0].date;
            const lastDate = completed[completed.length - 1].date;
            const daysElapsed = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24) || 1;
            actualVel = (completed.length / daysElapsed) * 7;
        }

        let requiredVel: number | null = null;
        let onTrackStatus: 'ahead' | 'behind' | 'on_track' | null = null;
        let days = 0;

        if (userProfile.targetExamDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const examDate = new Date(userProfile.targetExamDate);
            examDate.setHours(0,0,0,0);
            
            const diffTime = examDate.getTime() - today.getTime();
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (remaining > 0) {
                const bufferDays = userProfile.syllabusCompletionBufferDays ?? 90;
                const targetCompletionDate = new Date(examDate);
                targetCompletionDate.setDate(examDate.getDate() - bufferDays);

                const daysForStudy = (targetCompletionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

                if (daysForStudy > 0) {
                    requiredVel = (remaining / daysForStudy) * 7;
                    if (actualVel > requiredVel) onTrackStatus = 'ahead';
                    else if (actualVel < requiredVel * 0.9) onTrackStatus = 'behind';
                    else onTrackStatus = 'on_track';
                } else {
                    requiredVel = Infinity;
                    onTrackStatus = 'behind';
                }
            }
        }
        
        return { 
            velocity: actualVel, 
            requiredVelocity: requiredVel, 
            isOnTrack: onTrackStatus, 
            remainingChapters: remaining, 
            daysLeft: days
        };
    }, [userProfile]);

    const statusConfig = {
        ahead: { text: 'Ahead', color: 'text-green-400', icon: '🚀' },
        on_track: { text: 'On Track', color: 'text-cyan-400', icon: '👍' },
        behind: { text: 'Behind', color: 'text-red-400', icon: '⚠️' },
        null: { text: 'N/A', color: 'text-gray-400', icon: '❓' },
    };
    const currentStatus = statusConfig[isOnTrack || 'null'];

    return (
        <div className="glass-panel p-4 rounded-xl mb-6 relative overflow-hidden transition-all text-center">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center justify-around relative z-10">
                <div><p className="text-xs text-gray-400">Actual Velocity</p><p className="text-2xl font-bold text-white tabular-nums">{velocity.toFixed(1)} <span className="text-sm text-gray-400">ch/wk</span></p></div>
                <div><p className="text-xs text-gray-400">Required Velocity</p><p className="text-2xl font-bold text-white tabular-nums">{requiredVelocity === null ? 'N/A' : isFinite(requiredVelocity) ? requiredVelocity.toFixed(1) : '∞'} <span className="text-sm text-gray-400">ch/wk</span></p></div>
                <div><p className="text-xs text-gray-400">Chapters Left</p><p className="text-2xl font-bold text-white tabular-nums">{remainingChapters}</p></div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs text-gray-400">Status</p>
                            <p className={`text-xl font-bold flex items-center justify-center gap-2 ${currentStatus.color}`}>
                                <span>{currentStatus.icon}</span>
                                <span>{currentStatus.text}</span>
                            </p>
                        </div>
                        <div className="w-px h-8 bg-slate-700 mx-2"></div>
                        <div>
                            <p className="text-xs text-gray-400">Days Left</p>
                            <p className="text-xl font-bold text-white tabular-nums">{daysLeft > 0 ? daysLeft : 'Set Date'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Skeleton Loader for AI Explanation ---
const SkeletonText: React.FC = () => (
    <div className="space-y-4 animate-shimmer p-4">
        <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
        <div className="h-4 bg-slate-700/50 rounded w-full"></div>
        <div className="h-4 bg-slate-700/50 rounded w-full"></div>
        <div className="h-4 bg-slate-700/50 rounded w-5/6"></div>
    </div>
);


// Mastery Calculation Helpers
const calculateMasteryScore = (topic: string, logs: QuestionLog[], status: SyllabusStatus | undefined) => {
    let score = 1000; // Base ELO for Novice
    
    const topicLogs = logs.filter(l => l.topic === topic);
    topicLogs.forEach(l => {
        if (l.status === QuestionStatus.FullyCorrect) score += 20;
        else if (l.status === QuestionStatus.PartiallyCorrect) score += 5;
        else if (l.status === QuestionStatus.Wrong) score -= 10;
    });

    if (status === SyllabusStatus.Completed) score += 200;
    if (status === SyllabusStatus.Revising) score += 300;
    if (status === SyllabusStatus.InProgress) score += 50;

    return Math.max(0, score);
};

const getMasteryTier = (score: number) => {
    if (score > 2000) return { tier: 'Grandmaster', color: '#f59e0b', bg: 'bg-amber-500/20 border-amber-500/50' };
    if (score > 1500) return { tier: 'Expert', color: '#a855f7', bg: 'bg-purple-500/20 border-purple-500/50' };
    if (score > 1200) return { tier: 'Adept', color: '#22c55e', bg: 'bg-green-500/20 border-green-500/50' };
    if (score > 1000) return { tier: 'Apprentice', color: '#3b82f6', bg: 'bg-blue-500/20 border-blue-500/50' };
    return { tier: 'Novice', color: '#94a3b8', bg: 'bg-slate-700/50 border-slate-600' };
};

interface ChapterCardProps {
    chapter: { name: string, subTopics: string[] };
    progress: ChapterProgress;
    onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void;
    questionLogs: QuestionLog[];
    reports: TestReport[];
    onStartFocusSession: (topic: string) => void;
    onExplainTopic: (topic: string) => void;
    userProfile: UserProfile; 
    mastery: { score: number, tier: string, color: string, bg: string };
    onTriggerQuiz: (topic: string) => void;
    onCompletionEffect: (coords: { x: number; y: number; }) => void;
    cardRef: (el: HTMLDivElement | null) => void;
    isQuizLoading?: boolean;
    forceExpanded?: boolean;
    showAIPath?: boolean;
    onGeneratePath?: () => void;
    isGeneratingPath?: boolean;
    onCardClick?: (topic: string) => void;
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
        const innerRingData: {name: string, value: number, color: string}[] = [];
        const outerRingData: {name: string, value: number, color: string}[] = [];

        const innerRingCounts = { strength: 0, weakness: 0, completed: 0, inProgress: 0, notStarted: 0 };
        const outerRingCounts = { highAcc: 0, midAcc: 0, lowAcc: 0, noData: 0 };
        
        const chapterAccuracies = new Map<string, number>();
        const chapterLogs = new Map<string, QuestionLog[]>();

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
            if (progress?.strength === 'strength') innerRingCounts.strength++;
            else if (progress?.strength === 'weakness') innerRingCounts.weakness++;
            else if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) innerRingCounts.completed++;
            else if (progress?.status === SyllabusStatus.InProgress) innerRingCounts.inProgress++;
            else innerRingCounts.notStarted++;

            const accuracy = chapterAccuracies.get(chapter);
            if (accuracy === undefined) outerRingCounts.noData++;
            else if (accuracy >= 80) outerRingCounts.highAcc++;
            else if (accuracy >= 50) outerRingCounts.midAcc++;
            else outerRingCounts.lowAcc++;
        });
        
        if (innerRingCounts.strength > 0) innerRingData.push({ name: 'Strength', value: innerRingCounts.strength, color: '#22c55e' });
        if (innerRingCounts.weakness > 0) innerRingData.push({ name: 'Weakness', value: innerRingCounts.weakness, color: '#ef4444' });
        if (innerRingCounts.completed > 0) innerRingData.push({ name: 'Done', value: innerRingCounts.completed, color: '#3b82f6' });
        if (innerRingCounts.inProgress > 0) innerRingData.push({ name: 'In Progress', value: innerRingCounts.inProgress, color: '#eab308' });
        if (innerRingCounts.notStarted > 0) innerRingData.push({ name: 'Not Started', value: innerRingCounts.notStarted, color: '#334155' });
        
        if (outerRingCounts.highAcc > 0) outerRingData.push({ name: 'High Acc (>80%)', value: outerRingCounts.highAcc, color: '#10b981' });
        if (outerRingCounts.midAcc > 0) outerRingData.push({ name: 'Med Acc (50-80%)', value: outerRingCounts.midAcc, color: '#f59e0b' });
        if (outerRingCounts.lowAcc > 0) outerRingData.push({ name: 'Low Acc (<50%)', value: outerRingCounts.lowAcc, color: '#f43f5e' });
        if (outerRingCounts.noData > 0) outerRingData.push({ name: 'No Data', value: outerRingCounts.noData, color: '#1e293b' });

        const weightedCompletion = ( (innerRingCounts.strength + innerRingCounts.weakness + innerRingCounts.completed) + (innerRingCounts.inProgress * 0.5) ) / chapters.length * 100;

        return {
            data: { inner: innerRingData, outer: outerRingData },
            totalChapters: chapters.length,
            completion: weightedCompletion
        };
    }, [subject, chapters, userProfile, questionLogs]);
    
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            const dataName = payload[0].name;
            const dataValue = payload[0].value;
            
            const isInner = data.inner.some((d: any) => d.name === dataName);
            const ringData = isInner ? data.inner : data.outer;
            const totalRingValue = ringData.reduce((sum: number, entry: any) => sum + entry.value, 0);
            const percent = totalRingValue > 0 ? (dataValue / totalRingValue) * 100 : 0;

            return (
                <div className="glass-panel p-2 rounded-lg shadow-xl text-xs z-50">
                    <p className="font-bold text-white mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dataPoint.color }}></span>
                        {dataName}
                    </p>
                    <p className="text-gray-300">Chapters: <span className="text-white font-mono font-bold">{dataValue}</span></p>
                    <p className="text-gray-400 text-[10px]">({percent.toFixed(0)}% of total)</p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="bg-slate-800 border border-slate-600 shadow-lg rounded-xl p-4 flex flex-col h-full">
            <h4 className="text-lg font-bold text-center mb-2 capitalize" style={{ color: SUBJECT_CONFIG[subject]?.color || 'white' }}>{subject}</h4>
            
            <div className="flex-grow relative min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <RechartsTooltip 
                            wrapperStyle={{ zIndex: 1000 }}
                            content={<CustomTooltip />}
                        />
                        <Pie 
                            data={data.inner} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            outerRadius="65%" 
                            innerRadius="45%" 
                            stroke="none"
                        >
                            {data.inner.map((entry, index) => <Cell key={`inner-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Pie 
                            data={data.outer} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            innerRadius="70%" 
                            outerRadius="95%" 
                            stroke="none"
                        >
                            {data.outer.map((entry, index) => <Cell key={`outer-${index}`} fill={entry.color} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-white">{completion.toFixed(0)}%</span>
                    <span className="text-xs text-gray-400">{totalChapters} Ch.</span>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
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

const ChapterCard: React.FC<ChapterCardProps> = ({ cardRef, chapter, progress, onSyllabusChange, questionLogs, reports, onStartFocusSession, onExplainTopic, userProfile, mastery, onTriggerQuiz, onCompletionEffect, isQuizLoading, forceExpanded, showAIPath, onGeneratePath, isGeneratingPath, onCardClick }) => {
    const [isExpandedState, setIsExpandedState] = useState(false);
    const isExpanded = forceExpanded || isExpandedState;

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

    const theoryProgress = useMemo(() => {
        const lecture = progress.lectureCompleted ? 1 : 0;
        const notes = progress.notesCompleted ? 1 : 0;
        
        if (!chapter.subTopics || chapter.subTopics.length === 0) {
            return (lecture + notes) / 2 * 100;
        }
        
        const subTopicsDone = Object.values(progress.subTopicStatus || {}).filter(Boolean).length;
        const subTopicRatio = chapter.subTopics.length > 0 ? subTopicsDone / chapter.subTopics.length : 1;
        
        return (lecture * 0.2 + notes * 0.2 + subTopicRatio * 0.6) * 100;
    }, [progress, chapter.subTopics]);

    const applicationProgress = useMemo(() => {
        const logs = questionLogs.filter(l => l.topic === chapter.name);
        const attempts = logs.length;
        if (attempts === 0) return 0;
        
        const correct = logs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
        const attemptedWithOutcome = logs.filter(l => l.status === QuestionStatus.FullyCorrect || l.status === QuestionStatus.Wrong).length;
        
        const accuracy = attemptedWithOutcome > 0 ? correct / attemptedWithOutcome : 0;
        const confidence = 1 - Math.exp(-attempts / 10);
        
        return accuracy * confidence * 100;
    }, [questionLogs, chapter.name]);

    const handleUpdate = <K extends keyof ChapterProgress>(key: K, value: ChapterProgress[K]) => {
        if (key === 'status' && value === SyllabusStatus.Completed) {
            onTriggerQuiz(chapter.name);
            // Note: We do NOT call onSyllabusChange here. We wait for the quiz to pass.
            // React state will not update, so the dropdown should visually revert or stay put until success.
        } else {
            onSyllabusChange(chapter.name, { [key]: value });
        }
    };

    const handleSubTopicToggle = (subTopicName: string, isChecked: boolean) => {
        const currentSubTopicStatus = progress.subTopicStatus || {};
        const newSubTopicStatus = {
            ...currentSubTopicStatus,
            [subTopicName]: isChecked
        };
        onSyllabusChange(chapter.name, { subTopicStatus: newSubTopicStatus });
    };
    
    const ringGlowStyle: React.CSSProperties = {};
    if (progress.strength === 'strength') {
        ringGlowStyle.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.5)';
    } else if (progress.strength === 'weakness') {
        ringGlowStyle.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.5)';
    }

    return (
        <div ref={cardRef} className={`relative rounded-lg p-px ${forceExpanded ? 'h-full' : ''}`} style={ringGlowStyle}>
            {/* REMOVED overflow-hidden to allow tooltip to show */}
            <div className={`relative rounded-lg border transition-all duration-300 ${statusColors[progress.status]} ${forceExpanded ? 'bg-slate-900 h-full border-0' : ''}`}>
                {isHighYield && !forceExpanded && (
                    <div className="absolute top-0 right-0 pointer-events-none z-10 rounded-tr-lg overflow-hidden">
                        {/* Slimmer corner ribbon */}
                        <div className="bg-amber-500 text-white text-[9px] font-bold px-6 py-0.5 rotate-45 translate-x-4 -translate-y-0.5 shadow-sm text-center">
                            HY
                        </div>
                    </div>
                )}
                <div className="p-3 relative">
                    <div 
                        className="flex items-center gap-4 cursor-pointer" 
                        onClick={(e) => {
                            if (forceExpanded) return;
                            // Logic: If not expanded (closed), standard click opens modal.
                            // If expanded (open), clicking header does nothing or collapses?
                            // User requested: "modal should only open ... when it is closed".
                            if (!isExpandedState && onCardClick) {
                                onCardClick(chapter.name);
                            }
                        }}
                    >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-inner ${mastery.bg}`}>
                            <span className="text-lg" style={{color: mastery.color}} title={`Mastery: ${mastery.tier}`}>
                                {mastery.tier === 'Grandmaster' ? '👑' : mastery.tier === 'Expert' ? '💎' : mastery.tier === 'Adept' ? '⚔️' : mastery.tier === 'Apprentice' ? '🔨' : '🌱'}
                            </span>
                        </div>
                        
                        <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-semibold truncate ${isHighYield ? 'text-amber-100' : 'text-gray-200'} ${forceExpanded ? 'text-lg' : ''}`}>{chapter.name}</p>
                                <MemoryBattery percentage={memoryHealth.percentage} status={memoryHealth.status} daysAgo={memoryHealth.daysAgo} />
                            </div>
                            <div className="space-y-1.5 mt-2">
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="w-12 text-gray-400">Theory</span>
                                    <div className="w-24 bg-slate-700/50 rounded-full h-1.5 flex-shrink-0"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${theoryProgress}%` }}></div></div>
                                    <span className="w-8 text-right font-mono text-gray-300">{theoryProgress.toFixed(0)}%</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="w-12 text-gray-400">Apply</span>
                                    <div className="w-24 bg-slate-700/50 rounded-full h-1.5 flex-shrink-0"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${applicationProgress}%` }}></div></div>
                                    <span className="w-8 text-right font-mono text-gray-300">{applicationProgress.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                        {!forceExpanded && chapterStats.errorCount > 0 && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-semibold flex-shrink-0 hidden sm:inline-block">{chapterStats.errorCount} Errors</span>}
                        
                        {/* Dropdown Arrow - Handles inline expansion */}
                        {!forceExpanded && (
                            <div 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setIsExpandedState(!isExpandedState); 
                                }}
                                className="p-1 rounded-full hover:bg-slate-700/50 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        )}
                    </div>

                    {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <DependencyIndicator topic={chapter.name} userProfile={userProfile} />
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-500 block">Weightage: {weightage}</span>
                                    <span className="text-[10px] font-bold" style={{color: mastery.color}}>ELO: {mastery.score}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Status</label>
                                    <select 
                                        value={progress.status} 
                                        onChange={e => handleUpdate('status', e.target.value as SyllabusStatus)} 
                                        className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md disabled:opacity-50"
                                        disabled={isQuizLoading}
                                    >
                                        {Object.values(SyllabusStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {isQuizLoading && <span className="text-[10px] text-cyan-400 mt-1 animate-pulse">Generating Quiz...</span>}
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

                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Theory Checklist</h4>
                                <div className="space-y-2 bg-slate-900/30 p-2 rounded-md border border-slate-700/50">
                                    <label className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.lectureCompleted} onChange={e => onSyllabusChange(chapter.name, { lectureCompleted: e.target.checked })} className="form-checkbox h-4 w-4 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.lectureCompleted ? 'text-gray-500 line-through' : 'text-gray-300'}>Lecture Completed</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.notesCompleted} onChange={e => onSyllabusChange(chapter.name, { notesCompleted: e.target.checked })} className="form-checkbox h-4 w-4 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.notesCompleted ? 'text-gray-500 line-through' : 'text-gray-300'}>Notes Prepared</span>
                                    </label>
                                </div>
                            </div>

                            {chapter.subTopics && chapter.subTopics.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Sub-Topics</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar bg-slate-900/30 p-2 rounded-md border border-slate-700/50">
                                        {chapter.subTopics.map(subTopic => (
                                            <label key={subTopic} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!progress.subTopicStatus?.[subTopic]} 
                                                    onChange={e => handleSubTopicToggle(subTopic, e.target.checked)} 
                                                    className="form-checkbox h-4 w-4 bg-slate-600 text-cyan-500 rounded"
                                                />
                                                <span className={progress.subTopicStatus?.[subTopic] ? 'text-gray-500 line-through' : 'text-gray-300'}>{subTopic}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* AI Learning Path Generator */}
                            {showAIPath && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-semibold text-indigo-300">AI Learning Path</h4>
                                    </div>
                                    <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/30 text-sm">
                                        <p className="text-gray-300 mb-3 text-xs">Generate a personalized checklist based on your weaknesses and prerequisites.</p>
                                        <button 
                                            onClick={onGeneratePath} 
                                            disabled={isGeneratingPath}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isGeneratingPath ? (
                                                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Generating...</>
                                            ) : (
                                                <>✨ Generate Smart Path</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

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

                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-2">
                                <button onClick={() => onStartFocusSession(chapter.name)} className="flex-1 text-sm bg-indigo-600/50 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2">⚡️ Start Focus</button>
                                <button onClick={() => onExplainTopic(chapter.name)} className="flex-1 text-sm bg-cyan-600/50 hover:bg-cyan-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2">📖 Explain</button>
                                <button 
                                    onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(chapter.name + " JEE")}`, '_blank')}
                                    className="text-sm bg-red-600/80 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center"
                                    title="Search on YouTube"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SubjectSyllabus: React.FC<Omit<SyllabusProps, 'userProfile' | 'apiKey' | 'setView' | 'setUserProfile'> & { subject: 'physics' | 'chemistry' | 'maths', userProfile: UserProfile, onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void; onExplainTopic: (topic: string) => void; searchQuery: string; activeUnitFilter?: string | null; onTriggerQuiz: (topic: string) => void; onCompletionEffect: (coords: { x: number; y: number; }) => void; chapterCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>; quizLoadingState: string | null; onNodeClick: (topic: string) => void; }> = ({ subject, userProfile, onSyllabusChange, questionLogs, reports, onStartFocusSession, onExplainTopic, searchQuery, activeUnitFilter, onTriggerQuiz, onCompletionEffect, chapterCardRefs, quizLoadingState, onNodeClick }) => {
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
                                    const defaultProgress: ChapterProgress = { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {} };
                                    const progress: ChapterProgress = { ...defaultProgress, ...(userProfile.syllabus[chapter.name] || {}) };
                                    
                                    const masteryScore = calculateMasteryScore(chapter.name, questionLogs, progress.status);
                                    const masteryInfo = getMasteryTier(masteryScore);
                                    const mastery = { score: masteryScore, ...masteryInfo };

                                    return (
                                    <div key={chapter.name}>
                                        <ChapterCard 
                                            cardRef={el => (chapterCardRefs.current[chapter.name] = el)}
                                            chapter={chapter} 
                                            progress={progress} 
                                            onSyllabusChange={onSyllabusChange} 
                                            questionLogs={questionLogs} 
                                            reports={reports} 
                                            onStartFocusSession={onStartFocusSession}
                                            onExplainTopic={onExplainTopic}
                                            userProfile={userProfile}
                                            mastery={mastery}
                                            onTriggerQuiz={onTriggerQuiz}
                                            onCompletionEffect={onCompletionEffect}
                                            isQuizLoading={quizLoadingState === chapter.name}
                                            onCardClick={() => onNodeClick(chapter.name)}
                                        />
                                    </div>
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

const ViewControl: React.FC<{ mode: string; setMode: (m: any) => void }> = ({ mode, setMode }) => {
    const modes = [
        { id: 'overview', icon: '☷', label: 'List' },
        { id: 'sunburst', icon: '◎', label: 'Sunburst' },
        { id: 'tree', icon: '🌳', label: 'Tree' },
        { id: 'river', icon: '🌊', label: 'River' },
        { id: 'subway', icon: '🚇', label: 'Subway' },
    ];

    return (
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-lg">
            {modes.map(m => (
                <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        mode === m.id 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'text-gray-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={m.label}
                >
                    <span className="text-lg leading-none">{m.icon}</span>
                    <span className="hidden sm:inline">{m.label}</span>
                </button>
            ))}
        </div>
    );
};

export const Syllabus: React.FC<SyllabusProps> = ({ userProfile, setUserProfile, questionLogs, reports, apiKey, onStartFocusSession, setView, addTasksToPlanner }) => {
    const [activeSubject, setActiveSubject] = useState<'physics' | 'chemistry' | 'maths'>('physics');
    const [activeUnit, setActiveUnit] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [explainModalData, setExplainModalData] = useState<{ topic: string; content: string; loading: boolean; complexity: 'standard' | 'simple' } | null>(null);
    const [vizMode, setVizMode] = useState<'overview' | 'sunburst' | 'tree' | 'river' | 'subway'>('overview');
    const [quizState, setQuizState] = useState<{ topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null>(null);
    
    // Chapter Detail Modal State
    const [selectedChapterForModal, setSelectedChapterForModal] = useState<string | null>(null);
    const [isGeneratingPath, setIsGeneratingPath] = useState(false);

    // Particle effect state
    const [completionEffect, setCompletionEffect] = useState<{ x: number, y: number, key: number } | null>(null);
    const particleCanvasRef = useRef<HTMLCanvasElement>(null);
    const chapterCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const triggerCompletionEffect = useCallback((coords: { x: number, y: number }) => {
        setCompletionEffect({ ...coords, key: Date.now() });
    }, []);

    useEffect(() => {
        if (!completionEffect || !particleCanvasRef.current) return;
        const canvas = particleCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles: any[] = [];
        const { x, y } = completionEffect;
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.random() * 4 + 1;
            particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                radius: Math.random() * 2 + 1,
                color: `rgba(var(--color-primary-rgb), ${Math.random() * 0.5 + 0.5})`,
                life: 60,
            });
        }
        let animationFrameId: number;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
                if (p.life <= 0) particles.splice(i, 1);
                else {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 60; ctx.fill();
                }
            });
            if (particles.length > 0) animationFrameId = requestAnimationFrame(animate);
            else { ctx.clearRect(0, 0, canvas.width, canvas.height); setCompletionEffect(null); }
        };
        animate();
        return () => cancelAnimationFrame(animationFrameId);
    }, [completionEffect]);

    const handleSyllabusChange = (chapter: string, updatedProgress: Partial<ChapterProgress>) => {
        setUserProfile(prev => {
            const existingProgress = prev.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0 };
            const wasCompleted = existingProgress.status === SyllabusStatus.Completed || existingProgress.status === SyllabusStatus.Revising;
            
            const newProgress = { ...existingProgress, ...updatedProgress };

            if (newProgress.status === SyllabusStatus.Completed && existingProgress.status !== SyllabusStatus.Completed) {
                newProgress.completionDate = new Date().toISOString();
                 if (!wasCompleted) {
                    const cardEl = chapterCardRefs.current[chapter];
                    if (cardEl) {
                        const rect = cardEl.getBoundingClientRect();
                        triggerCompletionEffect({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    } else {
                        // Fallback for modal view
                        triggerCompletionEffect({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    }
                }
            }
    
            return {
                ...prev,
                syllabus: {
                    ...prev.syllabus,
                    [chapter]: newProgress
                }
            };
        });
    };

    const allMasteryScores = useMemo(() => {
        const scores: Record<string, { score: number, tier: string, color: string }> = {};
        ['physics', 'chemistry', 'maths'].forEach(sub => {
            // @ts-ignore
            JEE_SYLLABUS[sub].forEach(unit => {
                unit.chapters.forEach((ch: any) => {
                    const progress = userProfile.syllabus[ch.name];
                    const score = calculateMasteryScore(ch.name, questionLogs, progress?.status);
                    const info = getMasteryTier(score);
                    scores[ch.name] = { score, tier: info.tier, color: info.color };
                });
            });
        });
        return scores;
    }, [userProfile.syllabus, questionLogs]);

    const handleExplainTopic = async (topic: string, complexity: 'standard' | 'simple' = 'standard') => {
        setExplainModalData({ topic, content: '', loading: true, complexity });
        try {
            const explanation = await explainTopic(topic, apiKey, complexity);
            setExplainModalData(prev => prev ? { ...prev, content: explanation, loading: false } : null);
        } catch (error) {
            setExplainModalData(prev => prev ? { ...prev, content: "Failed to load explanation.", loading: false } : null);
        }
    };

    const triggerCompletionQuiz = useCallback(async (topic: string) => {
        setQuizState({ topic, loading: true });
        try {
            const questions = await generateGatekeeperQuiz(topic, apiKey);
            if (questions && questions.length > 0) {
                setQuizState(prev => prev ? { ...prev, questions, loading: false } : null);
            } else {
                throw new Error("No questions generated.");
            }
        } catch (e) {
            console.error("Failed to generate quiz, aborting completion.", e);
            setQuizState(null);
            alert("Failed to generate Gatekeeper Quiz. Please check your internet connection or API key limits. Syllabus status not updated.");
        }
    }, [apiKey]);

    const handleGenerateLearningPath = async () => {
        if (!selectedChapterForModal || !apiKey) return;
        setIsGeneratingPath(true);
        try {
            // Get weak prerequisites
            const prereqs = TOPIC_DEPENDENCIES[selectedChapterForModal] || [];
            const weakPrereqs = prereqs.filter(p => {
                const mastery = allMasteryScores[p];
                return !mastery || mastery.score < 1200;
            });

            const path = await generateLearningPath(selectedChapterForModal, weakPrereqs, apiKey);
            if (addTasksToPlanner) {
                addTasksToPlanner(path);
            }
            // Optional: Show toast or success within modal
        } catch (e) {
            console.error(e);
            alert("Failed to generate learning path.");
        } finally {
            setIsGeneratingPath(false);
        }
    };

    // Handle Node Clicks from Visualizations
    const handleNodeClick = (topic: string) => {
        setSelectedChapterForModal(topic);
    };

    const handleSunburstClick = (type: 'subject' | 'unit', name: string) => {
        if (type === 'subject') { setActiveSubject(name.toLowerCase() as 'physics' | 'chemistry' | 'maths'); setActiveUnit(null); setVizMode('overview'); } 
        else if (type === 'unit') {
            const subject = ['physics', 'chemistry', 'maths'].find(sub => JEE_SYLLABUS[sub as 'physics'|'chemistry'|'maths'].some((u: any) => u.unit === name));
            if (subject) { setActiveSubject(subject as 'physics' | 'chemistry' | 'maths'); setActiveUnit(name); setVizMode('overview'); }
        }
    };

    const revisionStackTopics = useMemo(() => {
        const topics: { name: string, weight: number, reason: string }[] = [];
        // @ts-ignore
        const syllabusChapters = Object.values(JEE_SYLLABUS).flatMap(subject => subject.flatMap(unit => unit.chapters.map(c => c.name)));
        syllabusChapters.forEach(chapter => {
            const progress = userProfile.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {} };
            const baseWeight = TOPIC_WEIGHTAGE[chapter] === 'High' ? 3 : TOPIC_WEIGHTAGE[chapter] === 'Medium' ? 2 : 1;
            let lastInteractionDate = new Date('2000-01-01');
            let hasInteraction = false;
             questionLogs.forEach(log => {
                if (log.topic === chapter) {
                    const report = reports.find(r => r.id === log.testId);
                    if (report) {
                        const date = new Date(report.testDate);
                        if (date > lastInteractionDate) { lastInteractionDate = date; hasInteraction = true; }
                    }
                }
            });
            if(hasInteraction) {
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - lastInteractionDate.getTime());
                const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                const stability = 7 * (1 + (progress.revisionCount || 0) * 0.5); 
                const retention = Math.exp(-daysAgo / stability);
                if(retention < 0.7) { 
                    const urgency = retention < 0.4 ? 2 : 1;
                    topics.push({ name: chapter, weight: baseWeight * 5 * urgency, reason: 'Fading Memory' });
                    return; 
                }
            }
            if (progress.strength === 'weakness') { topics.push({ name: chapter, weight: baseWeight * 4, reason: 'Marked Weakness' }); return; }
            if (progress.status === SyllabusStatus.InProgress) { topics.push({ name: chapter, weight: baseWeight * 2, reason: 'In Progress' }); return; }
        });
        if (topics.length === 0) {
             syllabusChapters.forEach(chapter => {
                 const progress = userProfile.syllabus[chapter];
                 if(progress && progress.status === SyllabusStatus.InProgress) { topics.push({ name: chapter, weight: 1, reason: 'Continue Progress' }); }
             });
        }
        return topics.sort((a, b) => b.weight - a.weight).slice(0, 5);
    }, [userProfile.syllabus, questionLogs, reports]);

    const handleGenerateRevisionStack = () => {
        if(revisionStackTopics.length === 0) { alert("You haven't marked enough chapters as 'In Progress' or 'Weakness' to generate a targeted stack."); return; }
        if(addTasksToPlanner) { const tasks = revisionStackTopics.map(t => ({ task: `Revise: ${t.name} (${t.reason})`, time: 30, topic: t.name })); addTasksToPlanner(tasks); } 
        else { onStartFocusSession(revisionStackTopics[0].name); }
    };

    // Helper to find chapter object for modal
    const selectedChapterObj = useMemo(() => {
        if (!selectedChapterForModal) return null;
        // @ts-ignore
        const allUnits = Object.values(JEE_SYLLABUS).flatMap(subject => subject);
        for (const unit of allUnits) {
            const chapter = unit.chapters.find((c: any) => c.name === selectedChapterForModal);
            if (chapter) return chapter;
        }
        return null;
    }, [selectedChapterForModal]);

    return (
        <div className="space-y-6 pb-20">
            {completionEffect && <canvas ref={particleCanvasRef} className="fixed inset-0 pointer-events-none z-[100]" />}
            <StrategicPlanner userProfile={userProfile} />

            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--color-primary-accent-rgb))]">Syllabus Tracker</h2>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleGenerateRevisionStack}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                        title="Auto-generate tasks for fading, weak, or in-progress topics"
                    >
                        <span>🧠</span> Generate Revision Stack
                        {revisionStackTopics.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{revisionStackTopics.length}</span>}
                    </button>
                    
                    <ViewControl mode={vizMode} setMode={setVizMode} />

                     <input 
                        type="text" 
                        placeholder="Search chapters..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="bg-slate-700 border border-slate-600 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none w-64"
                    />
                </div>
            </div>

            <div className="relative">
                {vizMode === 'sunburst' ? (
                    <SyllabusSunburst userProfile={userProfile} onSliceClick={handleSunburstClick} />
                ) : vizMode === 'subway' ? (
                    <SyllabusSubwayMap userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} />
                ) : vizMode === 'river' ? (
                    <SyllabusRiverFlow userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} />
                ) : vizMode === 'tree' ? (
                    <SyllabusTree userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} onSyllabusChange={handleSyllabusChange} />
                ) : ( // overview
                    <SyllabusOverviewWidget userProfile={userProfile} questionLogs={questionLogs} />
                )}
            </div>
            
            {(vizMode === 'overview' || activeUnit) && (
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
            )}
           
            {vizMode === 'overview' && (
                 <SubjectSyllabus 
                    subject={activeSubject} 
                    userProfile={userProfile} 
                    onSyllabusChange={handleSyllabusChange} 
                    questionLogs={questionLogs} 
                    reports={reports} 
                    onStartFocusSession={onStartFocusSession}
                    onExplainTopic={(topic) => handleExplainTopic(topic, 'standard')}
                    searchQuery={searchQuery}
                    activeUnitFilter={activeUnit}
                    onTriggerQuiz={triggerCompletionQuiz}
                    onCompletionEffect={triggerCompletionEffect}
                    chapterCardRefs={chapterCardRefs}
                    quizLoadingState={quizState?.loading ? quizState.topic : null}
                    onNodeClick={handleNodeClick}
                />
            )}
            
            {/* Explanation Modal */}
             <Modal isOpen={!!explainModalData} onClose={() => setExplainModalData(null)} title={`Concept: ${explainModalData?.topic}`}>
                <div className="flex justify-end px-4 pb-2 border-b border-slate-700/50">
                    <div className="flex bg-slate-800 rounded p-1 gap-1">
                        <button onClick={() => handleExplainTopic(explainModalData!.topic, 'standard')} className={`px-3 py-1 text-xs rounded ${explainModalData?.complexity === 'standard' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>Standard</button>
                        <button onClick={() => handleExplainTopic(explainModalData!.topic, 'simple')} className={`px-3 py-1 text-xs rounded ${explainModalData?.complexity === 'simple' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}>Explain Like I'm 5</button>
                    </div>
                </div>
                {explainModalData?.loading ? <SkeletonText /> : <div className="p-4 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: explainModalData?.content.replace(/\n/g, '<br/>') || '' }} />}
            </Modal>

            {/* Quiz Modal */}
            <Modal isOpen={!!quizState} onClose={() => setQuizState(null)} title={`Mastery Check: ${quizState?.topic}`}>
                <GatekeeperQuiz
                    quizState={quizState}
                    setQuizState={setQuizState}
                    onSuccess={() => {
                        if(quizState?.topic) {
                            handleSyllabusChange(quizState.topic, { status: SyllabusStatus.Completed });
                        }
                        setQuizState(null);
                    }}
                />
            </Modal>

            {/* Unified Chapter Detail Modal */}
            <Modal isOpen={!!selectedChapterForModal} onClose={() => setSelectedChapterForModal(null)} title="">
                {selectedChapterForModal && selectedChapterObj && (
                    <div className="h-full">
                        <ChapterCard 
                            cardRef={() => {}}
                            chapter={selectedChapterObj}
                            progress={{ status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {}, ...(userProfile.syllabus[selectedChapterForModal] || {}) } as ChapterProgress}
                            onSyllabusChange={handleSyllabusChange}
                            questionLogs={questionLogs}
                            reports={reports}
                            onStartFocusSession={onStartFocusSession}
                            onExplainTopic={(topic) => handleExplainTopic(topic, 'standard')}
                            userProfile={userProfile}
                            mastery={{...allMasteryScores[selectedChapterForModal], bg: '', color: allMasteryScores[selectedChapterForModal]?.color || '#ccc'}}
                            onTriggerQuiz={triggerCompletionQuiz}
                            onCompletionEffect={triggerCompletionEffect}
                            isQuizLoading={quizState?.loading}
                            forceExpanded={true}
                            showAIPath={true}
                            onGeneratePath={handleGenerateLearningPath}
                            isGeneratingPath={isGeneratingPath}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- Gatekeeper Quiz Component ---
const GatekeeperQuiz: React.FC<{
    quizState: { topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null;
    setQuizState: React.Dispatch<React.SetStateAction<any>>;
    onSuccess: () => void;
}> = ({ quizState, setQuizState, onSuccess }) => {

    if (quizState?.loading) {
        return <div className="text-center p-8">
            <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-300">Generating conceptual questions...</p>
        </div>;
    }

    if (!quizState?.questions) {
        return <div className="text-center p-8 text-red-400">Could not load quiz questions. Please try again.</div>;
    }

    const handleAnswer = (qIndex: number, answerKey: string) => {
        setQuizState((prev: any) => ({
            ...prev,
            userAnswers: {
                ...prev.userAnswers,
                [qIndex]: answerKey
            }
        }));
    };

    const handleSubmit = () => {
        const results = quizState.questions!.map((q, i) => {
            return quizState.userAnswers?.[i] === q.answer;
        });
        const allCorrect = results.every(Boolean);

        setQuizState((prev: any) => ({
            ...prev,
            submitted: true,
            result: results
        }));

        if (allCorrect) {
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }
    };

    const isSubmitted = quizState.submitted;
    const allCorrect = isSubmitted && quizState.result?.every(Boolean);

    return (
        <div className="p-4 space-y-6">
            {quizState.questions.map((q, i) => {
                const isCorrect = isSubmitted ? quizState.result?.[i] : undefined;
                const userAnswer = quizState.userAnswers?.[i];

                return (
                    <div key={i} className={`p-4 rounded-lg border ${isSubmitted ? (isCorrect ? 'border-green-500/50 bg-green-900/20' : 'border-red-500/50 bg-red-900/20') : 'border-slate-700 bg-slate-800/50'}`}>
                        <p className="font-semibold text-gray-200 mb-4">{i + 1}. {q.question}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(q.options).map(([key, optionText]) => {
                                const isSelected = userAnswer === key;
                                const isCorrectAnswer = q.answer === key;
                                
                                let buttonClass = "bg-slate-700 hover:bg-slate-600";
                                if (isSubmitted) {
                                    if (isCorrectAnswer) buttonClass = "bg-green-600 text-white";
                                    else if (isSelected) buttonClass = "bg-red-600 text-white";
                                } else if (isSelected) {
                                    buttonClass = "bg-cyan-600 text-white";
                                }

                                return (
                                <button
                                    key={key}
                                    onClick={() => !isSubmitted && handleAnswer(i, key)}
                                    className={`w-full text-left p-3 rounded-md text-sm transition-colors ${buttonClass}`}
                                >
                                    <span className="font-bold mr-2">{key}.</span> {optionText}
                                </button>
                                );
                            })}
                        </div>
                        {isSubmitted && !isCorrect && (
                            <div className="mt-3 p-3 bg-slate-900/50 rounded-md border border-slate-700 text-xs">
                                <p className="text-amber-300 font-bold">Explanation:</p>
                                <p className="text-gray-300">{q.explanation}</p>
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="flex justify-between items-center mt-6">
                 <button onClick={onSuccess} className="text-sm text-gray-400 hover:text-white hover:bg-slate-700 px-4 py-2 rounded-md">
                    Complete Anyway
                </button>
                {!isSubmitted ? (
                    <button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg">Submit Answers</button>
                ) : allCorrect ? (
                    <div className="text-center p-3 bg-green-900/30 rounded-lg text-green-300">
                        <p className="font-bold">Perfect! Mastery confirmed.</p>
                        <p className="text-sm">Updating syllabus status...</p>
                    </div>
                ) : (
                    <div className="text-center p-3 bg-red-900/30 rounded-lg text-red-300">
                        <p className="font-bold">Not quite there yet.</p>
                        <p className="text-sm">Review the explanations above and try again later.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
