
import { useMemo } from 'react';
import type { QuestionLog, TestReport, PanicEvent, GuessStats, DependencyAlert } from '../types';
import { QuestionStatus, ErrorReason } from '../types';
import { TOPIC_DEPENDENCIES } from '../constants';
import { getMarkingScheme } from '../utils/metrics';

export const useRootCauseAnalytics = (filteredLogs: QuestionLog[], reports: TestReport[]) => {
  return useMemo(() => {
    const errorLogs = filteredLogs.filter(log => log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect);
    const totalErrors = errorLogs.length;

    // 1. Weak Topics (All data, for drill-down)
    const weakestTopicsMap = new Map<string, { count: number; tests: Set<string>; subject: string }>();
    errorLogs.forEach(log => {
        if (log.topic && log.topic !== 'N/A') {
            const existing = weakestTopicsMap.get(log.topic) || { count: 0, tests: new Set(), subject: log.subject };
            existing.count++;
            existing.tests.add(log.testId);
            weakestTopicsMap.set(log.topic, existing);
        }
    });

    const weakestTopics = Array.from(weakestTopicsMap.entries())
        .map(([topic, data]) => ({ topic, count: data.count, tests: data.tests.size, subject: data.subject }))
        .sort((a, b) => b.count - a.count);

    // 2. Pareto Analysis (80/20 Rule)
    let cumulativeCount = 0;
    const paretoData = weakestTopics.slice(0, 20).map((item) => {
        cumulativeCount += item.count;
        return {
            topic: item.topic,
            count: item.count,
            cumulativePercentage: totalErrors > 0 ? (cumulativeCount / totalErrors) * 100 : 0
        };
    });

    // 3. Error Reason Distribution
    const errorReasonDistribution = new Map<string, number>();
    errorLogs.forEach(log => { if (log.reasonForError) { errorReasonDistribution.set(log.reasonForError, (errorReasonDistribution.get(log.reasonForError) || 0) + 1); } });

    // 4. Temporal Error Trend (Time-Series)
    const errorsByDate = new Map<string, { date: string, name: string, [key: string]: any }>();
    reports.forEach(r => {
        errorsByDate.set(r.id, { 
            date: r.testDate, 
            name: r.testName,
            totalErrors: 0,
            [ErrorReason.ConceptualGap]: 0,
            [ErrorReason.SillyMistake]: 0,
            [ErrorReason.TimePressure]: 0, 
            [ErrorReason.MisreadQuestion]: 0,
            [ErrorReason.Guess]: 0
        });
    });

    errorLogs.forEach(log => {
        const entry = errorsByDate.get(log.testId);
        if (entry && log.reasonForError) {
            entry[log.reasonForError] = (entry[log.reasonForError] || 0) + 1;
            entry.totalErrors++;
        }
    });

    const errorTrendData = Array.from(errorsByDate.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(entry => {
            const total = entry.totalErrors || 1;
            return {
                ...entry,
                [`${ErrorReason.ConceptualGap}%`]: (entry[ErrorReason.ConceptualGap] / total) * 100,
                [`${ErrorReason.SillyMistake}%`]: (entry[ErrorReason.SillyMistake] / total) * 100,
                [`${ErrorReason.TimePressure}%`]: (entry[ErrorReason.TimePressure] / total) * 100,
                [`${ErrorReason.MisreadQuestion}%`]: (entry[ErrorReason.MisreadQuestion] / total) * 100,
                [`${ErrorReason.Guess}%`]: (entry[ErrorReason.Guess] / total) * 100,
            };
        });


    // 5. Fatigue Analysis (Question Number vs Error Rate)
    const fatigueMap = new Map<string, { attempts: number, errors: number }>();
    filteredLogs.forEach(log => {
        const bucketStart = Math.floor((log.questionNumber - 1) / 10) * 10 + 1;
        const bucketLabel = `${bucketStart}-${bucketStart + 9}`;
        const existing = fatigueMap.get(bucketLabel) || { attempts: 0, errors: 0 };
        
        existing.attempts++;
        if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) {
            existing.errors++;
        }
        fatigueMap.set(bucketLabel, existing);
    });

    const fatigueData = Array.from(fatigueMap.entries())
        .map(([range, data]) => ({
            range,
            errorRate: data.attempts > 0 ? (data.errors / data.attempts) * 100 : 0,
            attempts: data.attempts
        }))
        .sort((a, b) => parseInt(a.range.split('-')[0]) - parseInt(b.range.split('-')[0]));


    // 6. Sankey Data Construction
    const sankeyNodes: { name: string }[] = [];
    const sankeyLinks: { source: number, target: number, value: number }[] = [];
    
    const subjectIndices: Record<string, number> = {};
    const topicIndices: Record<string, number> = {};
    const reasonIndices: Record<string, number> = {};

    ['Physics', 'Chemistry', 'Maths'].forEach(sub => {
        subjectIndices[sub.toLowerCase()] = sankeyNodes.length;
        sankeyNodes.push({ name: sub });
    });

    const topTopics = weakestTopics.slice(0, 8);
    topTopics.forEach(t => {
        topicIndices[t.topic] = sankeyNodes.length;
        sankeyNodes.push({ name: t.topic });
    });

    Object.values(ErrorReason).forEach(r => {
        reasonIndices[r] = sankeyNodes.length;
        sankeyNodes.push({ name: r });
    });

    topTopics.forEach(t => {
        const sourceIdx = subjectIndices[t.subject.toLowerCase()];
        const targetIdx = topicIndices[t.topic];
        if (sourceIdx !== undefined && targetIdx !== undefined) {
            sankeyLinks.push({ source: sourceIdx, target: targetIdx, value: t.count });
        }
        
        const topicLogs = errorLogs.filter(l => l.topic === t.topic);
        const reasonCounts = topicLogs.reduce((acc, l) => {
            if (l.reasonForError) acc[l.reasonForError] = (acc[l.reasonForError] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(reasonCounts).forEach(([reason, count]) => {
            const rTargetIdx = reasonIndices[reason];
            if (targetIdx !== undefined && rTargetIdx !== undefined) {
                sankeyLinks.push({ source: targetIdx, target: rTargetIdx, value: count });
            }
        });
    });

    // 7. Performance by Question Type with Extended Metrics
    const performanceByQuestionType = new Map<string, { count: number, errors: number, totalMarks: number }>();
    filteredLogs.forEach(log => {
        if(log.questionType) {
            const existing = performanceByQuestionType.get(log.questionType) || { count: 0, errors: 0, totalMarks: 0 };
            existing.count++;
            if (log.status === QuestionStatus.Wrong) existing.errors++;
            existing.totalMarks += log.marksAwarded;
            performanceByQuestionType.set(log.questionType, existing);
        }
    });

    const errorReasonsBySubject = new Map<string, Record<string, number>>();
    errorLogs.forEach(log => {
        if (log.reasonForError) {
            const subjectErrors = errorReasonsBySubject.get(log.subject) || {};
            subjectErrors[log.reasonForError] = (subjectErrors[log.reasonForError] || 0) + 1;
            errorReasonsBySubject.set(log.subject, subjectErrors);
        }
    });

    const allReasons = Object.values(ErrorReason);
    const subjects = ['physics', 'chemistry', 'maths'];
    const flippedStackedErrorData = allReasons.map(reason => {
        const entry: any = { name: reason };
        subjects.forEach(subject => {
            const subjectData = errorReasonsBySubject.get(subject);
            entry[subject] = subjectData?.[reason] || 0;
        });
        return entry;
    });

    // 8. Panic "Death Spiral" Detection
    const panicEvents: PanicEvent[] = [];
    const reportMap = new Map(reports.map(r => [r.id, r]));
    
    const logsByTest = new Map<string, QuestionLog[]>();
    filteredLogs.forEach(log => {
        if (!logsByTest.has(log.testId)) logsByTest.set(log.testId, []);
        logsByTest.get(log.testId)!.push(log);
    });

    logsByTest.forEach((testLogs, testId) => {
        // Sort by question number
        const sorted = testLogs.sort((a, b) => a.questionNumber - b.questionNumber);
        let currentChain = 0;
        let chainLostMarks = 0;
        let chainStartIndex = -1;

        sorted.forEach((log, index) => {
            if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.Unanswered) {
                if (currentChain === 0) chainStartIndex = index;
                currentChain++;
                const { correct, wrong } = getMarkingScheme(log.questionType);
                // Panic cost: Missed opportunity (correct) + negative penalty (if wrong)
                chainLostMarks += (correct + (log.status === QuestionStatus.Wrong ? Math.abs(wrong) : 0));
            } else {
                // Chain broken
                if (currentChain >= 3) { // Threshold for panic spiral
                    const testName = reportMap.get(testId)?.testName || 'Unknown Test';
                    const startQ = sorted[chainStartIndex].questionNumber;
                    const endQ = sorted[index - 1].questionNumber;
                    panicEvents.push({
                        testId,
                        testName,
                        startQuestion: startQ,
                        endQuestion: endQ,
                        length: currentChain,
                        lostMarks: chainLostMarks
                    });
                }
                currentChain = 0;
                chainLostMarks = 0;
                chainStartIndex = -1;
            }
        });
        // Check for spiral at end of paper
        if (currentChain >= 3) {
             const testName = reportMap.get(testId)?.testName || 'Unknown Test';
             const startQ = sorted[chainStartIndex].questionNumber;
             const endQ = sorted[sorted.length - 1].questionNumber;
             panicEvents.push({
                testId,
                testName,
                startQuestion: startQ,
                endQuestion: endQ,
                length: currentChain,
                lostMarks: chainLostMarks
            });
        }
    });

    // 9. Psychological Profiling (Guessing)
    const guessLogs = filteredLogs.filter(l => (l.reasonForError as any) === ErrorReason.Guess || ((l.reasonForError as any) === ErrorReason.Guess && l.status === QuestionStatus.FullyCorrect));
    // Note: Standard logs usually only track errors. Ideally, 'Guess' should be a flag separate from ErrorReason to track successful guesses. 
    // Assuming strictly for now that we only know about FAILED guesses or explicit tags.
    // Heuristic: If reasonForError is 'Guess' -> it was a Wrong Guess.
    // If we don't have data on Correct Guesses, we can't calc true efficiency.
    // However, if QuestionLog allowed tagging 'Guess' even on correct, we'd use that.
    // For now, let's assume we only see WRONG guesses from standard error log flow.
    // *Advanced*: Look for patterns of "Marked for Review" + Correct? (Not in current data model)
    // *Simulated Metric*: Assuming for every 1 Wrong Guess marked, there might be un-logged correct guesses? No, unsafe.
    // We will report on "Failed Guesses" and their cost.
    
    const guessStats: GuessStats = {
        totalGuesses: guessLogs.length, // Only failed guesses in current model usually
        correctGuesses: 0, // Placeholder unless data model improves
        efficiency: 0,
        netScoreImpact: guessLogs.reduce((acc, l) => acc + l.marksAwarded, 0) // Usually negative
    };

    // 10. Dependency Propagation (Graph Theory)
    const dependencyAlerts: DependencyAlert[] = [];
    const weakTopicSet = new Set(weakestTopics.map(t => t.topic));
    
    weakestTopics.forEach(wt => {
        // Does this weak topic have a parent?
        // TOPIC_DEPENDENCIES: Child -> [Parents]
        const parents = TOPIC_DEPENDENCIES[wt.topic] || [];
        parents.forEach(parent => {
            if (weakTopicSet.has(parent)) {
                // Root cause found!
                dependencyAlerts.push({
                    topic: wt.topic, // The symptom
                    rootCauseTopic: parent, // The disease
                    errorCount: wt.count
                });
            }
        });
    });
    
    return {
        weakestTopics: weakestTopics, // Return full list for modal, slice in UI
        errorReasonDistribution: Array.from(errorReasonDistribution.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        performanceByQuestionType: Array.from(performanceByQuestionType.entries()).map(([name, data]) => ({ 
            name, 
            errors: data.errors,
            totalAttempts: data.count, // New Metric
            errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0,
            avgMarks: data.count > 0 ? data.totalMarks / data.count : 0,
        })).sort((a, b) => b.errors - a.errors),
        flippedStackedErrorData,
        totalErrors,
        errorTrendData,
        fatigueData,
        sankeyData: { nodes: sankeyNodes, links: sankeyLinks },
        paretoData,
        panicEvents: panicEvents.sort((a, b) => b.lostMarks - a.lostMarks).slice(0, 5), // Top 5 worst spirals
        guessStats,
        dependencyAlerts: dependencyAlerts.sort((a, b) => b.errorCount - a.errorCount)
    };
  }, [filteredLogs, reports]);
};
