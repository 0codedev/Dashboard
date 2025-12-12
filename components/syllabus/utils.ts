
import { QuestionLog, QuestionStatus, SyllabusStatus } from '../../types';

export const calculateMasteryScore = (topic: string, logs: QuestionLog[], status: SyllabusStatus | undefined) => {
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

export const getMasteryTier = (score: number) => {
    if (score > 2000) return { tier: 'Grandmaster', color: '#f59e0b', bg: 'bg-amber-500/20 border-amber-500/50' };
    if (score > 1500) return { tier: 'Expert', color: '#a855f7', bg: 'bg-purple-500/20 border-purple-500/50' };
    if (score > 1200) return { tier: 'Adept', color: '#22c55e', bg: 'bg-green-500/20 border-green-500/50' };
    if (score > 1000) return { tier: 'Apprentice', color: '#3b82f6', bg: 'bg-blue-500/20 border-blue-500/50' };
    return { tier: 'Novice', color: '#94a3b8', bg: 'bg-slate-700/50 border-slate-600' };
};
