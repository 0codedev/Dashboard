import type { SubjectData, QuestionLog } from '../types';
import { QuestionType, QuestionStatus } from '../types';

export const calculateMetrics = (subjectData: SubjectData, totalQuestions: number = 25) => {
    const { correct, wrong, partial, marks } = subjectData;
    const attempted = correct + wrong + partial;
    
    const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;
    const attemptRate = totalQuestions > 0 ? (attempted / totalQuestions) * 100 : 0;
    const cwRatio = wrong > 0 ? correct / wrong : correct > 0 ? Infinity : 0;
    const spaq = attempted > 0 ? marks / attempted : 0;
    const unattemptedPercent = totalQuestions > 0 ? ((totalQuestions - attempted) / totalQuestions) * 100 : 0;
    const negativeMarkImpact = (correct * 4) > 0 ? (wrong * 1) / (correct * 4) * 100 : 0;
    const scorePotentialRealized = (correct * 4) > 0 ? (marks / (correct * 4)) * 100 : 0;

    return {
        accuracy,
        attemptRate,
        cwRatio,
        spaq,
        unattemptedPercent,
        negativeMarkImpact,
        scorePotentialRealized,
    };
};

export const getMarkingScheme = (questionType: string, log?: Partial<QuestionLog>): { correct: number; wrong: number } => {
    // Prioritize explicit values from the log if available
    if (log?.positiveMarks !== undefined && log?.negativeMarks !== undefined) {
        return { correct: log.positiveMarks, wrong: log.negativeMarks };
    }

    // Fallback: Regex for format "Type (+4, -1)" or "Type (+4, 0)"
    // Matches (+X, -Y) or (+X, Y)
    const match = questionType.match(/\(\s*\+(\d+)\s*,\s*(-?\d+)\s*\)/);
    if (match) {
        return { correct: parseInt(match[1], 10), wrong: parseInt(match[2], 10) };
    }

    // Fallback defaults based on common types if name doesn't contain scheme
    const lowerType = questionType.toLowerCase();
    if (lowerType.includes('single')) return { correct: 3, wrong: -1 }; 
    if (lowerType.includes('multiple')) return { correct: 4, wrong: -2 };
    if (lowerType.includes('integer')) return { correct: 3, wrong: 0 };
    
    return { correct: 4, wrong: -1 }; // Ultimate Fallback
};

export const calculateMarks = (status: QuestionStatus | string, questionType: string, log?: Partial<QuestionLog>): number | null => {
    const { correct, wrong } = getMarkingScheme(questionType, log);

    switch (status) {
        case QuestionStatus.FullyCorrect:
            return correct;
        case QuestionStatus.Wrong:
            return wrong; // usually negative or 0
        case QuestionStatus.Unanswered:
            return 0;
        case QuestionStatus.PartiallyCorrect:
            // Partial marks logic is complex. If explicit in log, we rely on user input.
            // If log has a marksAwarded value already set, we respect it (handled in UI logic usually)
            return null; 
        default:
            return null;
    }
};