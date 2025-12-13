
import React, { useState, useMemo } from 'react';
import { ChapterProgress, QuestionLog, TestReport, SyllabusStatus, QuestionStatus, ErrorReason, UserProfile } from '../../types';
import { TOPIC_WEIGHTAGE, TOPIC_DEPENDENCIES } from '../../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, YAxis, Tooltip as RechartsTooltip } from 'recharts';

// --- Internal Helper Components ---

const MemoryBattery: React.FC<{ percentage: number; status: 'good' | 'fading' | 'critical' | 'dormant' | 'fresh'; daysAgo: number }> = ({ percentage, status, daysAgo }) => {
    let color = 'bg-slate-600';
    if (status === 'good' || status === 'fresh') color = 'bg-green-500';
    else if (status === 'fading') color = 'bg-yellow-400';
    else if (status === 'critical') color = 'bg-red-500';
    
    const blocks = Math.ceil(percentage / 25); 

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
        const progress = userProfile?.syllabus[p];
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
                         const pProg = userProfile?.syllabus[p];
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

const statusColors: Record<SyllabusStatus, string> = {
    [SyllabusStatus.Completed]: "bg-green-500/10 border-green-500/30",
    [SyllabusStatus.Revising]: "bg-blue-500/10 border-blue-500/30",
    [SyllabusStatus.InProgress]: "bg-yellow-500/10 border-yellow-500/30",
    [SyllabusStatus.NotStarted]: "bg-slate-700/50 border-slate-700/80",
};

const COLORS_PIE: Record<string, string> = {
    [ErrorReason.ConceptualGap]: '#FBBF24',
    [ErrorReason.MisreadQuestion]: '#34D399',
    [ErrorReason.SillyMistake]: '#F87171',
    [ErrorReason.TimePressure]: '#818CF8',
    [ErrorReason.Guess]: '#A78BFA',
};

// --- Main Chapter Card Component ---

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
    onPredictHurdles: (topic: string) => void;
    isHurdleLoading?: boolean;
}

export const ChapterCard: React.FC<ChapterCardProps> = ({ 
    cardRef, chapter, progress, onSyllabusChange, questionLogs, reports, onStartFocusSession, onExplainTopic, 
    userProfile, mastery, onTriggerQuiz, onCompletionEffect, isQuizLoading, forceExpanded, showAIPath, 
    onGeneratePath, isGeneratingPath, onCardClick, onPredictHurdles, isHurdleLoading 
}) => {
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

    const handlePracticeToggle = (key: keyof Exclude<ChapterProgress['practice'], undefined>, checked: boolean) => {
        onSyllabusChange(chapter.name, {
            practice: {
                ...(progress.practice || {}),
                [key]: checked
            }
        });
    };
    
    const ringGlowStyle: React.CSSProperties = {};
    if (progress.strength === 'strength') {
        ringGlowStyle.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.5)';
    } else if (progress.strength === 'weakness') {
        ringGlowStyle.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.5)';
    }

    return (
        <div ref={cardRef} className={`relative rounded-lg p-px ${forceExpanded ? 'h-full' : ''}`} style={ringGlowStyle}>
            {/* REMOVED overflow-hidden here when forceExpanded is true to allow scrolling inside Modal */}
            <div className={`relative rounded-lg border transition-all duration-300 ${forceExpanded ? '' : 'overflow-hidden'} ${statusColors[progress.status]} ${forceExpanded ? 'bg-slate-900 h-full border-0' : ''}`}>
                {isHighYield && !forceExpanded && (
                    <div className="absolute top-0 right-0 pointer-events-none z-10 w-16 h-16 overflow-hidden">
                        <div className="bg-amber-500 text-white text-[9px] font-bold py-1 w-[120px] text-center rotate-45 absolute top-[8px] -right-[36px] shadow-sm">
                            HY
                        </div>
                    </div>
                )}
                <div className="p-3 relative">
                    <div 
                        className="flex items-center gap-4 cursor-pointer" 
                        onClick={(e) => {
                            if (forceExpanded) return;
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

                            {/* PROBLEM PRACTICE CHECKLIST */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2">Problem Practice</h4>
                                <div className="bg-slate-900/30 p-2 rounded-md border border-slate-700/50 grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 text-xs p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.practice?.mains} onChange={e => handlePracticeToggle('mains', e.target.checked)} className="form-checkbox h-3 w-3 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.practice?.mains ? 'text-gray-500 line-through' : 'text-gray-300'}>Mains Problems</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.practice?.advanced} onChange={e => handlePracticeToggle('advanced', e.target.checked)} className="form-checkbox h-3 w-3 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.practice?.advanced ? 'text-gray-500 line-through' : 'text-gray-300'}>Adv Problems</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.practice?.module} onChange={e => handlePracticeToggle('module', e.target.checked)} className="form-checkbox h-3 w-3 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.practice?.module ? 'text-gray-500 line-through' : 'text-gray-300'}>Coaching Module</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs p-1 rounded hover:bg-slate-700/50 cursor-pointer">
                                        <input type="checkbox" checked={!!progress.practice?.books} onChange={e => handlePracticeToggle('books', e.target.checked)} className="form-checkbox h-3 w-3 bg-slate-600 text-cyan-500 rounded"/>
                                        <span className={progress.practice?.books ? 'text-gray-500 line-through' : 'text-gray-300'}>Other Books</span>
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
                                {progress.status === SyllabusStatus.NotStarted && (
                                    <button 
                                        onClick={() => onPredictHurdles(chapter.name)} 
                                        disabled={isHurdleLoading}
                                        className="flex-1 text-sm bg-amber-600/50 hover:bg-amber-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isHurdleLoading ? '🔮 Predicting...' : '🔮 Predict Hurdles'}
                                    </button>
                                )}
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
