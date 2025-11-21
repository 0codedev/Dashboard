import type { SubjectData } from '../types';
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

export const getMarkingScheme = (questionType: QuestionType | string): { correct: number; wrong: number } => {
    const match = questionType.match(/\(\s*\+(\d+)\s*,\s*(-?\d+)\s*\)/);
    if (!match) return { correct: 4, wrong: -1 }; // Default fallback
    return { correct: parseInt(match[1], 10), wrong: parseInt(match[2], 10) };
};

export const calculateMarks = (status: QuestionStatus | string, questionType: QuestionType | string): number | null => {
    const { correct, wrong } = getMarkingScheme(questionType);

    switch (status) {
        case QuestionStatus.FullyCorrect:
            return correct;
        case QuestionStatus.Wrong:
            return wrong; // Usually negative, e.g., -1
        case QuestionStatus.Unanswered:
            return 0;
        case QuestionStatus.PartiallyCorrect:
            return null; // Indicates manual input is needed
        default:
            return null;
    }
};