
import React, { useState, useMemo, useCallback } from 'react';
import { UserProfile, SyllabusStatus, ChapterProgress } from '../../types';
import { JEE_SYLLABUS, SUBJECT_COLORS } from '../../constants';

interface SyllabusTreeProps {
    userProfile: UserProfile;
    masteryScores: Record<string, { score: number, tier: string, color: string }>;
    onNodeClick: (topic: string) => void;
    onSyllabusChange: (chapter: string, updatedProgress: Partial<ChapterProgress>) => void;
}

const FolderIcon: React.FC<{ isOpen?: boolean; className?: string }> = ({ isOpen, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        {isOpen && <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" style={{transform: 'translateY(3px)'}}/>}
    </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);


const ProgressBar: React.FC<{ progress: number; color: string }> = ({ progress, color }) => (
    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color, transition: 'width 0.5s ease-in-out' }}></div>
    </div>
);

export const SyllabusTree: React.FC<SyllabusTreeProps> = React.memo(({ userProfile, onNodeClick, onSyllabusChange }) => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['subject-physics']));

    const toggleExpand = useCallback((id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);
    
    const handleSubTopicToggle = useCallback((chapterName: string, subTopicName: string, isChecked: boolean) => {
        const progress = userProfile.syllabus[chapterName] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {} };
        const currentSubTopicStatus = progress.subTopicStatus || {};
        const newSubTopicStatus = {
            ...currentSubTopicStatus,
            [subTopicName]: isChecked
        };
        onSyllabusChange(chapterName, { subTopicStatus: newSubTopicStatus });
    }, [userProfile.syllabus, onSyllabusChange]);

    const progressData = useMemo(() => {
        const data: Record<string, { progress: number }> = {};

        (['physics', 'chemistry', 'maths'] as const).forEach(subject => {
            let subjectTotalProgress = 0;
            let unitCount = 0;
            // @ts-ignore
            const units = JEE_SYLLABUS[subject];
            units.forEach((unit: any) => {
                let unitTotalProgress = 0;
                let chapterCount = 0;
                unit.chapters.forEach((chapter: any) => {
                    const progress = userProfile.syllabus[chapter.name];
                    const subTopics = chapter.subTopics || [];
                    const subTopicsDone = Object.values(progress?.subTopicStatus || {}).filter(Boolean).length;
                    
                    let chapterProgress = 0;
                    if (subTopics.length > 0) {
                        chapterProgress = (subTopicsDone / subTopics.length) * 100;
                    } else {
                        if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) chapterProgress = 100;
                    }
                    
                    data[`chapter-${chapter.name}`] = { progress: chapterProgress };
                    unitTotalProgress += chapterProgress;
                    chapterCount++;
                });

                if (chapterCount > 0) {
                    const unitProgress = unitTotalProgress / chapterCount;
                    data[`unit-${unit.unit}`] = { progress: unitProgress };
                    subjectTotalProgress += unitProgress;
                    unitCount++;
                }
            });

            if (unitCount > 0) {
                data[`subject-${subject}`] = { progress: subjectTotalProgress / unitCount };
            }
        });
        return data;
    }, [userProfile.syllabus]);
    
    return (
        <div className="w-full min-h-[600px] bg-slate-900/80 rounded-xl border border-slate-700 p-4">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Structured Syllabus Tree</h3>
            <div className="space-y-1">
                {(['physics', 'chemistry', 'maths'] as const).map(subject => {
                    const subjectId = `subject-${subject}`;
                    const isSubjectExpanded = expanded.has(subjectId);
                    // @ts-ignore
                    const units = JEE_SYLLABUS[subject];
                    const subjectProgress = progressData[subjectId]?.progress || 0;

                    return (
                        <div key={subjectId}>
                            <div 
                                onClick={() => toggleExpand(subjectId)} 
                                className="flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-slate-800"
                                style={{ color: SUBJECT_COLORS[subject] }}
                            >
                                <span className={`transition-transform text-sm ${isSubjectExpanded ? 'rotate-90' : ''}`}>▶</span>
                                <FolderIcon isOpen={isSubjectExpanded} />
                                <span className="font-bold capitalize flex-grow text-xl">{subject}</span>
                                <ProgressBar progress={subjectProgress} color={SUBJECT_COLORS[subject]} />
                                <span className="text-base w-12 text-right font-mono text-slate-300">{subjectProgress.toFixed(0)}%</span>
                            </div>
                            
                            {isSubjectExpanded && (
                                <div className="pl-5 border-l-2 border-slate-800 ml-5">
                                    {units.map((unit: any) => {
                                        const unitId = `unit-${unit.unit}`;
                                        const isUnitExpanded = expanded.has(unitId);
                                        const unitProgress = progressData[unitId]?.progress || 0;

                                        return (
                                            <div key={unitId} className="my-1">
                                                <div onClick={() => toggleExpand(unitId)} className="flex items-center gap-2 py-2.5 px-2 rounded-md cursor-pointer hover:bg-slate-800/50 text-slate-300">
                                                    <span className={`transition-transform text-base ${isUnitExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                    <FolderIcon isOpen={isUnitExpanded} />
                                                    <span className="font-semibold flex-grow text-lg">{unit.unit}</span>
                                                    <ProgressBar progress={unitProgress} color={SUBJECT_COLORS[subject]} />
                                                    <span className="text-base w-12 text-right font-mono">{unitProgress.toFixed(0)}%</span>
                                                </div>

                                                {isUnitExpanded && (
                                                    <div className="pl-5 border-l-2 border-slate-800 ml-5">
                                                        {unit.chapters.map((chapter: any) => {
                                                            const chapterId = `chapter-${chapter.name}`;
                                                            const isChapterExpanded = expanded.has(chapterId);
                                                            const chapterProgress = progressData[chapterId]?.progress || 0;

                                                            return (
                                                                <div key={chapterId} className="my-1">
                                                                    <div 
                                                                        onClick={() => toggleExpand(chapterId)} 
                                                                        className="flex items-center gap-2 py-2.5 pl-2 pr-1 rounded-md cursor-pointer hover:bg-slate-700/50 text-slate-300"
                                                                    >
                                                                        <span className={`transition-transform text-base ${isChapterExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                                        <FolderIcon isOpen={isChapterExpanded} />
                                                                        <span className="text-lg flex-grow hover:text-white font-medium" onClick={(e) => { e.stopPropagation(); onNodeClick(chapter.name); }}>{chapter.name}</span>
                                                                        <ProgressBar progress={chapterProgress} color={SUBJECT_COLORS[subject]} />
                                                                        <span className="text-base w-12 text-right font-mono">{chapterProgress.toFixed(0)}%</span>
                                                                    </div>
                                                                    
                                                                    {isChapterExpanded && (
                                                                         <div className="pl-5 border-l-2 border-slate-800 ml-5">
                                                                            {chapter.subTopics.map((subTopic: string) => {
                                                                                const isChecked = !!userProfile.syllabus[chapter.name]?.subTopicStatus?.[subTopic];
                                                                                return (
                                                                                    <label key={subTopic} className="flex items-center gap-3 py-2 pl-2 rounded-md cursor-pointer hover:bg-slate-700/30">
                                                                                        <input 
                                                                                            type="checkbox" 
                                                                                            checked={isChecked} 
                                                                                            onChange={(e) => handleSubTopicToggle(chapter.name, subTopic, e.target.checked)} 
                                                                                            className="form-checkbox h-4 w-4 bg-slate-600 border-slate-500 text-cyan-500 rounded focus:ring-cyan-500"
                                                                                        />
                                                                                        <FileIcon className={isChecked ? 'text-slate-600' : 'text-slate-400'}/>
                                                                                        <span className={`text-base ${isChecked ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{subTopic}</span>
                                                                                    </label>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
