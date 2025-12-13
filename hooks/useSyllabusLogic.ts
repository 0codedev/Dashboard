
import { useMemo } from 'react';
import { UserProfile, QuestionLog, TestReport, SyllabusStatus } from '../types';
import { JEE_SYLLABUS, TOPIC_WEIGHTAGE } from '../constants';
import { calculateMasteryScore, getMasteryTier } from '../components/syllabus/utils';

export const useMasteryScores = (userProfile: UserProfile, questionLogs: QuestionLog[]) => {
    return useMemo(() => {
        const scores: Record<string, { score: number, tier: string, color: string }> = {};
        if (!userProfile?.syllabus) return scores;

        ['physics', 'chemistry', 'maths'].forEach(sub => {
            // @ts-ignore
            JEE_SYLLABUS[sub]?.forEach((unit: any) => {
                unit.chapters.forEach((ch: any) => {
                    const progress = userProfile.syllabus[ch.name];
                    const score = calculateMasteryScore(ch.name, questionLogs, progress?.status);
                    const info = getMasteryTier(score);
                    scores[ch.name] = { score, tier: info.tier, color: info.color };
                });
            });
        });
        return scores;
    }, [userProfile?.syllabus, questionLogs]);
};

export const useRevisionStack = (userProfile: UserProfile, questionLogs: QuestionLog[], reports: TestReport[]) => {
    return useMemo(() => {
        const topics: { name: string, weight: number, reason: string }[] = [];
        if (!userProfile?.syllabus) return [];

        const syllabusChapters = Object.values(JEE_SYLLABUS).flatMap((subject: any) => subject.flatMap((unit: any) => unit.chapters.map((c: any) => c.name)));
        
        syllabusChapters.forEach((chapter: any) => {
            const progress = userProfile.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {} };
            const baseWeight = TOPIC_WEIGHTAGE[chapter] === 'High' ? 3 : TOPIC_WEIGHTAGE[chapter] === 'Medium' ? 2 : 1;
            
            let lastInteractionDate = new Date('2000-01-01');
            let hasInteraction = false;
            
            questionLogs.forEach(log => {
                if (log.topic === chapter) {
                    const report = reports.find(r => r.id === log.testId);
                    if (report) {
                        const date = new Date(report.testDate);
                        if (date.getTime() > lastInteractionDate.getTime()) { 
                            lastInteractionDate = date; 
                            hasInteraction = true; 
                        }
                    }
                }
            });

            if (hasInteraction) {
                const today = new Date();
                // FIXED: Explicit .getTime() to avoid arithmetic on Date objects
                const diffTime = Math.abs(today.getTime() - lastInteractionDate.getTime());
                const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                const revCount = progress.revisionCount !== undefined ? Number(progress.revisionCount) : 0;
                const stability = 7 * (1 + revCount * 0.5); 
                const retention = Math.exp(-daysAgo / stability);
                
                if (retention < 0.7) { 
                    const urgency = retention < 0.4 ? 2 : 1;
                    topics.push({ name: chapter, weight: baseWeight * 5 * urgency, reason: 'Fading Memory' });
                    return; 
                }
            }
            
            if (progress.strength === 'weakness') { 
                topics.push({ name: chapter, weight: baseWeight * 4, reason: 'Marked Weakness' }); 
                return; 
            }
            
            if (progress.status === SyllabusStatus.InProgress) { 
                topics.push({ name: chapter, weight: baseWeight * 2, reason: 'In Progress' }); 
                return; 
            }
        });

        if (topics.length === 0) {
             syllabusChapters.forEach((chapter: any) => {
                 const progress = userProfile.syllabus[chapter];
                 if (progress && progress.status === SyllabusStatus.InProgress) { 
                     topics.push({ name: chapter, weight: 1, reason: 'Continue Progress' }); 
                 }
             });
        }
        
        return topics.sort((a, b) => b.weight - a.weight).slice(0, 5);
    }, [userProfile?.syllabus, questionLogs, reports]);
};
