
/// <reference lib="webworker" />

import { TestReport, QuestionLog } from '../types';
import { calculateMetrics } from '../utils/metrics';

// Add necessary helper functions locally since we can't import complex DOM-dependent modules in worker easily without bundler config complexity
// Re-implementing simplified logic or pure functions here.

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

function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'CALCULATE_DASHBOARD_KPIS') {
        const { reports, logs } = payload as { reports: TestReport[], logs: QuestionLog[] };
        const result = calculateDashboardKpis(reports, logs);
        self.postMessage({ type: 'DASHBOARD_KPIS_RESULT', payload: result });
    }
    
    if (type === 'RUN_SIMULATION') {
         // Placeholder for more complex simulation logic if needed
         // For now, simpler logic is fast enough, but heavy Monte Carlo goes here
    }
};

function calculateDashboardKpis(processedReports: TestReport[], logs: QuestionLog[]) {
    if (processedReports.length === 0) return null;

    const latestReport = processedReports[processedReports.length - 1];
    
    const avgScores = {
        physics: processedReports.reduce((sum, r) => sum + r.physics.marks, 0) / processedReports.length,
        chemistry: processedReports.reduce((sum, r) => sum + r.chemistry.marks, 0) / processedReports.length,
        maths: processedReports.reduce((sum, r) => sum + r.maths.marks, 0) / processedReports.length,
    };

    const totalAvg = {
        score: processedReports.reduce((sum, r) => sum + r.total.marks, 0) / processedReports.length,
        rank: processedReports.reduce((sum, r) => sum + r.total.rank, 0) / processedReports.length,
        accuracy: processedReports.reduce((sum, r) => sum + (r.totalMetrics?.accuracy || 0), 0) / processedReports.length,
    };

    const scoreStdDev = Math.sqrt(processedReports.reduce((sum, r) => sum + Math.pow(r.total.marks - totalAvg.score, 2), 0) / processedReports.length);
    const consistencyScore = totalAvg.score > 0 ? (1 - (scoreStdDev / totalAvg.score)) * 100 : 0;

    // Rank Prediction (Monte Carlo)
    let rankPrediction = null;
    let rankModel = null;
    
    if (processedReports.length >= 3) {
        const points = processedReports.map(r => ({ x: r.total.marks, y: Math.log(Math.max(1, r.total.rank)) }));
        const n = points.length;
        const sumX = points.reduce((a, b) => a + b.x, 0);
        const sumY = points.reduce((a, b) => a + b.y, 0);
        const sumXY = points.reduce((a, b) => a + b.x * b.y, 0);
        const sumXX = points.reduce((a, b) => a + b.x * b.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        rankModel = { slope, intercept };

        const SIMULATION_COUNT = 5000;
        const simulatedRanks: number[] = [];
        
        for(let i = 0; i < SIMULATION_COUNT; i++) {
            const simScore = (randn_bm() * scoreStdDev) + totalAvg.score;
            const predictedLogRank = slope * simScore + intercept;
            const predictedRank = Math.exp(predictedLogRank);
            simulatedRanks.push(predictedRank);
        }
        simulatedRanks.sort((a, b) => a - b);
        
        // Distribution Data logic ...
        const minChartRank = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.01)];
        const maxChartRank = simulatedRanks[Math.floor(SIMULATION_COUNT * 0.99)];
        const bucketCount = 40; 
        const bucketSize = (maxChartRank - minChartRank) / bucketCount;
        const distribution = [];

        for(let i=0; i<=bucketCount; i++) {
            const start = minChartRank + i * bucketSize;
            const end = start + bucketSize;
            const count = simulatedRanks.filter(r => r >= start && r < end).length;
            distribution.push({ rank: Math.round(start + bucketSize/2), probability: count / SIMULATION_COUNT });
        }
        distribution.sort((a, b) => b.rank - a.rank);

        rankPrediction = {
            bestCase: Math.round(simulatedRanks[Math.floor(SIMULATION_COUNT * 0.05)]),
            likely: Math.round(simulatedRanks[Math.floor(SIMULATION_COUNT * 0.50)]),
            worstCase: Math.round(simulatedRanks[Math.floor(SIMULATION_COUNT * 0.95)]),
            distribution
        };
    }

    return {
        latestScore: latestReport.total.marks,
        avgScores,
        totalAvg,
        scoreStdDev,
        consistencyScore,
        rankPrediction,
        rankModel
    };
}
