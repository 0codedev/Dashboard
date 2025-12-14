
import { useMemo } from 'react';
import type { TestReport, QuestionLog, LongTermGoal, TestSubType, ErrorReason } from '../types';
import { SUBJECT_CONFIG, TOPIC_WEIGHTAGE } from '../constants';
import { QuestionStatus } from '../types';

// Helper for Normal Distribution (Box-Muller transform)
function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Simple Linear Regression
function linearRegression(y: number[]) {
    const x = y.map((_, i) => i);
    const n = y.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumXX = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

export interface StrategicROIPoint {
    topic: string;
    subject: string;
    effort: number; // X-axis
    impact: number; // Y-axis
    bubbleSize: number;
    quadrant: 'Quick Wins' | 'Big Bets' | 'Maintenance' | 'Money Pits';
}

export const useDashboardKpis = (
    processedReports: (TestReport & { testDate: string })[], 
    logs: QuestionLog[] = [], 
    longTermGoals: LongTermGoal[] = [],
    userProfile: any = {} // Accept userProfile for settings
) => {
  return useMemo(() => {
    // --- Base KPIs ---
    if (processedReports.length === 0) return { 
        latestScore: 0, strongestSubject: {name: 'N/A', avgScore: 0}, latestRank: 0, latestAccuracy: 0, consistencyScore: 0, 
        scoreTrend: [], rankTrend: [], accuracyTrend: [], radarData:[], 
        scoreComparison: undefined, rankComparison: undefined, accuracyComparison: undefined,
        rankPrediction: null, nextBestAction: null, percentileData: null, strategicROI: [], goalProbability: null, volatilityMetrics: null,
        rankModel: null,
        avgScores: { physics: 0, chemistry: 0, maths: 0 }
    };
    
    const latestReport = processedReports[processedReports.length - 1];
    
    const avgScores = {
        physics: processedReports.reduce((sum, r) => sum + r.physics.marks, 0) / processedReports.length,
        chemistry: processedReports.reduce((sum, r) => sum + r.chemistry.marks, 0) / processedReports.length,
        maths: processedReports.reduce((sum, r) => sum + r.maths.marks, 0) / processedReports.length,
    };

    const strongestSubject = Object.entries(avgScores).reduce((strongest, [subject, avgScore]) => 
        avgScore > strongest.avgScore ? { name: SUBJECT_CONFIG[subject].name, avgScore } : strongest,
        { name: 'N/A', avgScore: -Infinity }
    );

    const totalAvg = {
        score: processedReports.reduce((sum, r) => sum + r.total.marks, 0) / processedReports.length,
        rank: processedReports.reduce((sum, r) => sum + r.total.rank, 0) / processedReports.length,
        accuracy: processedReports.reduce((sum, r) => sum + (r.totalMetrics?.accuracy || 0), 0) / processedReports.length,
    };

    const scoreStdDev = Math.sqrt(processedReports.reduce((sum, r) => sum + Math.pow(r.total.marks - totalAvg.score, 2), 0) / processedReports.length);
    const consistencyScore = totalAvg.score > 0 ? (1 - (scoreStdDev / totalAvg.score)) * 100 : 0;
    
    const scoreComparison = { diff: latestReport.total.marks - totalAvg.score, trend: latestReport.total.marks > totalAvg.score ? 'up' : (latestReport.total.marks < totalAvg.score ? 'down' : 'flat') as 'up' | 'down' | 'flat' };
    const rankComparison = { diff: latestReport.total.rank - totalAvg.rank, trend: latestReport.total.rank > totalAvg.rank ? 'up' : (latestReport.total.rank < totalAvg.rank ? 'down' : 'flat') as 'up' | 'down' | 'flat' };
    const accuracyComparison = { diff: (latestReport.totalMetrics?.accuracy || 0) - totalAvg.accuracy, trend: (latestReport.totalMetrics?.accuracy || 0) > totalAvg.accuracy ? 'up' : ((latestReport.totalMetrics?.accuracy || 0) < totalAvg.accuracy ? 'down' : 'flat') as 'up' | 'down' | 'flat' };

    // --- Volatility Analysis (Student Sharpe Ratio) ---
    let volatilityMetrics = null;
    if (processedReports.length >= 2) {
        const riskFreeRate = 0; // Assuming 0 as baseline
        const annualizedVol = scoreStdDev; // Using standard deviation as volatility proxy
        const sharpeRatio = annualizedVol > 0 ? (totalAvg.score - riskFreeRate) / annualizedVol : 0;
        
        // Bollinger Bands like logic for "Testing Zone"
        const upperBand = totalAvg.score + 2 * scoreStdDev;
        const lowerBand = totalAvg.score - 2 * scoreStdDev;
        const isTestingOutOfZone = latestReport.total.marks > upperBand || latestReport.total.marks < lowerBand;

        volatilityMetrics = {
            sharpeRatio: sharpeRatio.toFixed(2),
            volatilityScore: Math.round(consistencyScore), // Reusing consistency as inverse volatility score
            stdDev: scoreStdDev.toFixed(1),
            isTestingOutOfZone,
            zoneMessage: isTestingOutOfZone ? (latestReport.total.marks > upperBand ? "Breaking Out (High)" : "Breaking Down (Low)") : "Stable"
        };
    }


    // --- 1. Rank Predictor Engine (Monte Carlo with Goal Probability) ---
    let rankPrediction = null;
    let goalProbability = null;
    let rankModel = null;
    
    if (processedReports.length >= 3) {
        // Log-Linear Regression for Rank
        const points = processedReports.map(r => ({ x: r.total.marks, y: Math.log(Math.max(1, r.total.rank)) }));
        const n = points.length;
        const sumX = points.reduce((a, b) => a + b.x, 0);
        const sumY = points.reduce((a, b) => a + b.y, 0);
        const sumXY = points.reduce((a, b) => a + b.x * b.y, 0);
        const sumXX = points.reduce((a, b) => a + b.x * b.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        rankModel = { slope, intercept };

        // Monte Carlo Simulation
        const SIMULATION_COUNT = 5000;
        const simulatedRanks: number[] = [];
        
        for(let i = 0; i < SIMULATION_COUNT; i++) {
            const simScore = (randn_bm() * scoreStdDev) + totalAvg.score;
            const predictedLogRank = slope * simScore + intercept;
            const predictedRank = Math.exp(predictedLogRank);
            simulatedRanks.push(predictedRank);
        }

        simulatedRanks.sort((a, b) => a - b);

        const p05 = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.05)]; // Best Case
        const p50 = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.50)]; // Most Likely
        const p95 = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.95)]; // Worst Case

        // Goal Probability Calculation
        const targetGoal = longTermGoals.find(g => !g.completed && /\d+/.test(g.text));
        let targetRank = 1000; // Default
        if (targetGoal) {
            const matches = targetGoal.text.match(/(\d+)/);
            if (matches) targetRank = parseInt(matches[0], 10);
        }
        
        const successCount = simulatedRanks.filter(r => r <= targetRank).length;
        const prob = (successCount / SIMULATION_COUNT) * 100;
        
        goalProbability = {
            targetRank,
            probability: Math.round(prob),
            text: targetGoal ? targetGoal.text : `Top ${targetRank}`
        };


        // Create Full Distribution Data (Tail to Tail)
        const distribution = [];
        const minChartRank = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.01)];
        const maxChartRank = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.99)];
        
        const bucketCount = 40; 
        const bucketSize = (maxChartRank - minChartRank) / bucketCount;

        for(let i=0; i<=bucketCount; i++) {
            const start = minChartRank + i * bucketSize;
            const end = start + bucketSize;
            const count = simulatedRanks.filter(r => r >= start && r < end).length;
            distribution.push({ rank: Math.round(start + bucketSize/2), probability: count / SIMULATION_COUNT });
        }

        // IMPORTANT: Sort by rank descending to ensure smooth curve (highest rank usually left/top depending on axis)
        // Actually for X-Axis reversed (better rank on right), we might want sorted by rank.
        // Recharts AreaChart needs sorted X values.
        distribution.sort((a, b) => b.rank - a.rank);

        rankPrediction = {
            bestCase: Math.round(p05),
            likely: Math.round(p50),
            worstCase: Math.round(p95),
            distribution
        };
    }

    // --- 2. Percentile & Score Predictor (Linear Regression) ---
    let percentileData = null;
    if (processedReports.length >= 2) {
        // Use user-configured cohort size if available
        let cohortSize = 10000; // Safe default
        const latestSubType = latestReport.subType;
        
        if (latestSubType && userProfile?.cohortSizes?.[latestSubType] > 0) {
            cohortSize = userProfile.cohortSizes[latestSubType];
        } else {
             // Fallback dynamic estimation
            const maxRankObserved = Math.max(...processedReports.map(r => r.total.rank));
            cohortSize = Math.max(10000, maxRankObserved * 1.2);
        }

        const trendPoints = processedReports.map((r, i) => {
            const percentile = ((cohortSize - r.total.rank) / cohortSize) * 100;
            return {
                name: `T${i+1}`,
                score: r.total.marks,
                rank: r.total.rank,
                percentile: Math.max(0, percentile),
                testName: r.testName
            };
        });

        const scoreReg = linearRegression(trendPoints.map(p => p.score));
        const nextIndex = trendPoints.length;
        const predictedScore = scoreReg.slope * nextIndex + scoreReg.intercept;

        const rankReg = linearRegression(trendPoints.map(p => p.rank));
        const predictedRank = Math.max(1, rankReg.slope * nextIndex + rankReg.intercept);
        const predictedPercentile = ((cohortSize - predictedRank) / cohortSize) * 100;
        
        const chartData = trendPoints.map((p, i) => ({
            ...p,
            trendPercentile: ((cohortSize - (rankReg.slope * i + rankReg.intercept)) / cohortSize) * 100
        }));

        percentileData = {
            chartData,
            predictedScore: Math.round(predictedScore),
            predictedPercentile: predictedPercentile.toFixed(1),
            nextIndex
        };
    }

    // --- 4. Strategic ROI Engine (Effort based on Error Type) ---
    const strategicROI: StrategicROIPoint[] = [];
    if (logs && logs.length > 0) {
        const topicMap = new Map<string, { attempts: number, correct: number, wrong: number, subject: string, reasons: Record<string, number> }>();
        
        logs.forEach(log => {
             if (log.topic && log.topic !== 'N/A') {
                 const curr = topicMap.get(log.topic) || { attempts: 0, correct: 0, wrong: 0, subject: log.subject, reasons: {} };
                 curr.attempts++;
                 if (log.status === QuestionStatus.FullyCorrect) curr.correct++;
                 if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) {
                     curr.wrong++;
                     if(log.reasonForError) {
                        curr.reasons[log.reasonForError] = (curr.reasons[log.reasonForError] || 0) + 1;
                     }
                 }
                 topicMap.set(log.topic, curr);
             }
        });

        topicMap.forEach((stats, topic) => {
             if (stats.attempts < 3) return; // Filter low data

             const weightageStr = TOPIC_WEIGHTAGE[topic] || 'Medium';
             const weightageVal = weightageStr === 'High' ? 1.5 : (weightageStr === 'Medium' ? 1.0 : 0.7);
             
             // Base complexity
             let complexity = weightageVal; 

             const accuracy = stats.correct / stats.attempts;
             
             // Effort Logic Refinement:
             // Find dominant error reason
             let dominantReason = 'Guess';
             let maxReasonCount = 0;
             Object.entries(stats.reasons).forEach(([r, c]) => {
                 if (c > maxReasonCount) { maxReasonCount = c; dominantReason = r; }
             });

             // Impact: Weightage * Volume of errors
             const impact = weightageVal * stats.wrong * 10; 

             // Effort Modifier based on Error Type
             // Silly Mistake/Misread = Low Effort to fix (Quick Win)
             // Conceptual Gap = High Effort
             let effortModifier = 1.0;
             if (dominantReason === 'Silly Mistake' || dominantReason === 'Misread Question') effortModifier = 0.4;
             else if (dominantReason === 'Conceptual Gap') effortModifier = 1.5;

             // Base Effort (Low accuracy = High base effort)
             const baseEffort = (1 / (accuracy + 0.2));
             
             // Adjusted scaling to better utilize the 0-100 range
             const effort = baseEffort * complexity * effortModifier * 15; 

             // Determine Quadrant
             let quadrant: StrategicROIPoint['quadrant'] = 'Maintenance';
             const midImpact = 30; 
             const midEffort = 30;

             if (impact >= midImpact && effort < midEffort) quadrant = 'Quick Wins';
             else if (impact >= midImpact && effort >= midEffort) quadrant = 'Big Bets';
             else if (impact < midImpact && effort < midEffort) quadrant = 'Maintenance';
             else quadrant = 'Money Pits';

             strategicROI.push({
                 topic,
                 subject: stats.subject,
                 effort,
                 impact,
                 bubbleSize: stats.attempts * 5,
                 quadrant
             });
        });
    }


    // --- 3. Next Best Action Engine (Legacy / Fallback) ---
    let nextBestAction = null;
    if (logs && logs.length > 0) {
        const topicStats = new Map<string, { count: number, subject: string, reasons: Record<string, number> }>();
        
        logs.forEach(log => {
            if (log.status === QuestionStatus.Wrong && log.topic && log.topic !== 'N/A') {
                const current = topicStats.get(log.topic) || { count: 0, subject: log.subject, reasons: {} };
                current.count++;
                if (log.reasonForError) {
                    current.reasons[log.reasonForError] = (current.reasons[log.reasonForError] || 0) + 1;
                }
                topicStats.set(log.topic, current);
            }
        });

        if (topicStats.size > 0) {
            const sortedTopics = Array.from(topicStats.entries()).sort((a, b) => b[1].count - a[1].count);
            const [topic, stats] = sortedTopics[0];
            const dominantReason = Object.entries(stats.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General Practice';
            const potentialGain = stats.count * 4;

            nextBestAction = {
                topic,
                subject: stats.subject,
                errorCount: stats.count,
                dominantReason,
                potentialGain
            };
        }
    }
    
    // --- Radar Data Logic (Average of Last 3 Tests) ---
    const radarData = useMemo(() => {
         const subjects = ['physics', 'chemistry', 'maths'] as const;
         const recentReports = processedReports.slice(-3); // Get last 3 reports (or fewer)
         
         if (recentReports.length === 0) return [];

         return subjects.map(subject => {
             // Calculate Average Score for this subject
             const totalScore = recentReports.reduce((sum, r) => sum + r[subject].marks, 0);
             const avgScore = totalScore / recentReports.length;
             
             // Calculate Max Mark (Dynamic based on max in recent tests)
             const maxMark = Math.max(...recentReports.map(r => r[subject].maxMarks || 60), 60);

             return {
                 subject: SUBJECT_CONFIG[subject].name,
                 A: Math.round(avgScore), // User Average
                 fullMark: maxMark
             };
         });
    }, [processedReports]);


    return {
        latestScore: latestReport.total.marks,
        strongestSubject: strongestSubject,
        latestRank: latestReport.total.rank,
        latestAccuracy: latestReport.totalMetrics?.accuracy || 0,
        consistencyScore,
        scoreTrend: processedReports.map(r => ({ value: r.total.marks })),
        rankTrend: processedReports.map(r => ({ value: r.total.rank })),
        accuracyTrend: processedReports.map(r => ({ value: r.totalMetrics?.accuracy || 0 })),
        radarData,
        scoreComparison, rankComparison, accuracyComparison,
        rankPrediction,
        nextBestAction,
        percentileData,
        strategicROI,
        goalProbability,
        volatilityMetrics,
        rankModel,
        avgScores
    };
  }, [processedReports, logs, longTermGoals, userProfile]);
};
