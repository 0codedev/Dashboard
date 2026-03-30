
import React from 'react';
import { UserProfile, QuestionLog, SyllabusStatus } from '../../types';
import { SubjectDonutCard } from '../visualizations/SubjectDonutCard';
import { JEE_SYLLABUS } from '../../constants';
import { useRevisionStack } from '../../hooks/useSyllabusLogic';

export const SyllabusOverviewWidget: React.FC<{ userProfile: UserProfile; questionLogs: QuestionLog[]; reports: any[]; onStartFocusSession: (topic: string) => void }> = ({ userProfile, questionLogs, reports, onStartFocusSession }) => {
    const subjects = ['physics', 'chemistry', 'maths'];
    const revisionStack = useRevisionStack(userProfile, questionLogs, reports);

    return (
        <div className="animate-fade-in space-y-8">
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

            {/* Revision Stack Visualization */}
            <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>📚</span> Revision Priority Stack
                        </h3>
                        <p className="text-xs text-slate-400">Topics decaying in memory or showing high error density.</p>
                    </div>
                    <div className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                        {revisionStack.length} Topics Flagged
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {revisionStack.slice(0, 5).map((topic, index) => (
                        <div 
                            key={topic.name}
                            className="group relative flex items-center gap-4 p-4 glass-panel hover:bg-white/5 rounded-xl transition-all hover:translate-x-1"
                            style={{ opacity: 1 - index * 0.15 }}
                        >
                            <div className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-xs font-bold text-indigo-400">
                                {index + 1}
                            </div>
                            <div className="flex-grow">
                                <h4 className="text-sm font-semibold text-white">{topic.name}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${topic.reason === 'Decay' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                                        {topic.reason}
                                    </span>
                                    <span className="text-[10px] text-slate-500 italic">
                                        Last Revised: {topic.lastRevised ? new Date(topic.lastRevised).toLocaleDateString() : 'Never'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => onStartFocusSession(topic.name)}
                                    className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md transition-colors"
                                >
                                    Revise Now
                                </button>
                            </div>
                        </div>
                    ))}
                    {revisionStack.length === 0 && (
                        <div className="py-12 text-center text-slate-500 italic border-2 border-dashed border-slate-700/50 rounded-xl">
                            No topics currently require urgent revision. Great job!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
