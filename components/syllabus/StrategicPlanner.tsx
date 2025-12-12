
import React, { useMemo } from 'react';
import { UserProfile, ChapterProgress, SyllabusStatus } from '../../types';
import { JEE_SYLLABUS } from '../../constants';

export const StrategicPlanner: React.FC<{ userProfile: UserProfile }> = ({ userProfile }) => {
    const { velocity, requiredVelocity, isOnTrack, remainingChapters, daysLeft } = useMemo(() => {
        if (!userProfile?.syllabus) return { velocity: 0, requiredVelocity: null, isOnTrack: null, remainingChapters: 0, daysLeft: 0 };
        
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
