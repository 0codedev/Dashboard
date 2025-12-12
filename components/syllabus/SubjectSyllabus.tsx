
import React, { useState, useMemo, useCallback } from 'react';
import { UserProfile, ChapterProgress, SyllabusStatus, QuestionLog, TestReport, QuestionStatus } from '../../types';
import { JEE_SYLLABUS, TOPIC_WEIGHTAGE } from '../../constants';
import { calculateMasteryScore, getMasteryTier } from './utils';
import { ChapterCard } from './ChapterCard';

interface SubjectSyllabusProps {
    subject: 'physics' | 'chemistry' | 'maths';
    userProfile: UserProfile;
    onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void;
    questionLogs: QuestionLog[];
    reports: TestReport[];
    onStartFocusSession: (topic: string) => void;
    onExplainTopic: (topic: string) => void;
    searchQuery: string;
    activeUnitFilter?: string | null;
    onTriggerQuiz: (topic: string) => void;
    onCompletionEffect: (coords: { x: number; y: number; }) => void;
    chapterCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
    quizLoadingState: string | null;
    onNodeClick: (topic: string) => void;
    onPredictHurdles: (topic: string) => void;
    isHurdleLoading: boolean;
    currentHurdleTopic: string | null;
}

export const SubjectSyllabus: React.FC<SubjectSyllabusProps> = ({ 
    subject, userProfile, onSyllabusChange, questionLogs, reports, onStartFocusSession, 
    onExplainTopic, searchQuery, activeUnitFilter, onTriggerQuiz, onCompletionEffect, 
    chapterCardRefs, quizLoadingState, onNodeClick, onPredictHurdles, isHurdleLoading, currentHurdleTopic 
}) => {
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
        if (!userProfile?.syllabus) return [];
        
        // @ts-ignore
        const subjectUnits = JEE_SYLLABUS[subject];
        if (!subjectUnits) return [];

        return subjectUnits.map((unit: any) => {
            // Unit Filter Logic
            if (activeUnitFilter && unit.unit !== activeUnitFilter) return null;

            const chapters = unit.chapters
                .filter((chapter: any) => {
                    // Search filter
                    if (searchQuery && !chapter.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return false;
                    }
                    const progress = userProfile.syllabus[chapter.name];
                    const statusMatch = filter.status === 'all' || (progress && progress.status === filter.status) || (!progress && filter.status === SyllabusStatus.NotStarted);
                    const strengthMatch = filter.strength === 'all' || (progress && progress.strength === filter.strength) || (filter.strength === 'null' && (!progress || !progress.strength));
                    return statusMatch && strengthMatch;
                })
                .sort((a: any, b: any) => {
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
        }).filter((unit: any) => unit && unit.chapters.length > 0); 
    }, [subject, userProfile?.syllabus, filter, sort, getChapterErrorCount, getChapterAccuracy, searchQuery, activeUnitFilter]);
    
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
                {processedSyllabusData.map((unit: any) => (
                    <div key={unit.unit} className="animate-fade-in">
                        <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => toggleUnit(unit.unit)}>
                            <button className="text-gray-400 hover:text-white">
                                {collapsedUnits.has(unit.unit) ? '▶' : '▼'}
                            </button>
                            <h3 className="text-lg font-bold text-cyan-200 border-b border-slate-700 pb-1 flex-grow">{unit.unit} <span className="text-sm font-normal text-gray-500 ml-2">({unit.chapters.length})</span></h3>
                        </div>
                        {!collapsedUnits.has(unit.unit) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {unit.chapters.map((chapter: any) => {
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
                                            onPredictHurdles={onPredictHurdles}
                                            isHurdleLoading={isHurdleLoading && currentHurdleTopic === chapter.name}
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
