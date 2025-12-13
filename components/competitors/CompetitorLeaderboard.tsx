
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { TestReport, DifficultyLevel } from '../../types';
import { getMarkingScheme } from '../../utils/metrics';

interface CompetitorLeaderboardProps {
    report: TestReport;
    allReports?: TestReport[];
}

const PERSONAS = {
    BENCHMARK_100: { name: "AIR 100 Benchmark", color: "#10B981", accuracy: 0.95, attemptRate: 0.90, speedFactor: 1.2 },
    ACCURACY_BOT: { name: "The Accuracy Bot", color: "#6366F1", accuracy: 1.0, attemptRate: 0.65, speedFactor: 0.8 },
    SPEEDSTER: { name: "The Speedster", color: "#F59E0B", accuracy: 0.75, attemptRate: 1.0, speedFactor: 1.5 },
    AVERAGE_JOE: { name: "Cohort Average", color: "#64748B", accuracy: 0.60, attemptRate: 0.70, speedFactor: 1.0 },
};

export const CompetitorLeaderboard: React.FC<CompetitorLeaderboardProps> = ({ report, allReports }) => {
    const [simulatedData, setSimulatedData] = useState<any[]>([]);

    useMemo(() => {
        // Simple simulation logic based on test metadata
        const totalMarks = report.total.maxMarks || 300; // Default if not present
        const difficulty = report.difficulty || 'Medium';
        
        let difficultyMultiplier = 1.0;
        if (difficulty === 'Hard') difficultyMultiplier = 0.85;
        if (difficulty === 'Easy') difficultyMultiplier = 1.15;

        // Base potential score (assuming standard +4/-1 or similar avg)
        // We can approximate based on the user's report structure if needed, but simple mult is easier for now.

        const data = Object.values(PERSONAS).map(persona => {
            const rawScore = totalMarks * persona.attemptRate * persona.accuracy * difficultyMultiplier;
            // Apply slight randomization for realism
            const randomFactor = 0.95 + Math.random() * 0.1; 
            const finalScore = Math.min(totalMarks, Math.round(rawScore * randomFactor));
            
            return {
                name: persona.name,
                score: finalScore,
                color: persona.color,
                isUser: false
            };
        });

        // Add User
        data.push({
            name: "You",
            score: report.total.marks,
            color: "#22D3EE", // Cyan
            isUser: true
        });

        // Sort descending
        data.sort((a, b) => b.score - a.score);
        setSimulatedData(data);
    }, [report]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-lg text-xs">
                    <p className="font-bold text-white mb-1">{d.name}</p>
                    <p className="text-gray-300">Score: <span className="font-mono text-cyan-300 font-bold">{d.score}</span></p>
                    {d.isUser && <p className="text-[10px] text-gray-500 mt-1">Your Actual Score</p>}
                    {!d.isUser && <p className="text-[10px] text-gray-500 mt-1">AI Simulated</p>}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 h-full flex flex-col">
            <h3 className="text-lg font-bold text-cyan-300 mb-2 flex items-center gap-2">
                <span>🏆</span> Shadow Leaderboard
            </h3>
            <p className="text-xs text-gray-400 mb-4">
                Simulated ranking against AI personas for <strong>{report.testName}</strong> ({report.difficulty || 'Medium'}).
            </p>

            <div className="flex-grow min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={simulatedData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                        <XAxis type="number" hide domain={[0, 'dataMax + 20']} />
                        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={100} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
                            {simulatedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-2 text-center">
                 <div className="inline-flex gap-4 text-[10px] text-gray-500 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10B981]"></span> Benchmark</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6366F1]"></span> Accuracy</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span> Speed</span>
                 </div>
            </div>
        </div>
    );
};
