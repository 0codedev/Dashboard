
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SUBJECT_CONFIG } from '../../constants';
import { UserProfile, QuestionLog, SyllabusStatus, QuestionStatus } from '../../types';

interface SubjectDonutCardProps {
    subject: string;
    chapters: string[];
    userProfile: UserProfile;
    questionLogs: QuestionLog[];
}

export const SubjectDonutCard: React.FC<SubjectDonutCardProps> = React.memo(({ subject, chapters, userProfile, questionLogs }) => {
    
    const { data, totalChapters, completion } = useMemo(() => {
        const innerRingData: {name: string, value: number, color: string}[] = [];
        const outerRingData: {name: string, value: number, color: string}[] = [];

        const innerRingCounts = { strength: 0, weakness: 0, completed: 0, inProgress: 0, notStarted: 0 };
        const outerRingCounts = { highAcc: 0, midAcc: 0, lowAcc: 0, noData: 0 };
        
        const chapterAccuracies = new Map<string, number>();
        const chapterLogs = new Map<string, QuestionLog[]>();

        questionLogs.forEach(log => {
            if (log.topic && log.topic !== 'N/A' && chapters.includes(log.topic)) {
                if (!chapterLogs.has(log.topic)) chapterLogs.set(log.topic, []);
                chapterLogs.get(log.topic)!.push(log);
            }
        });

        chapterLogs.forEach((logs, topic) => {
            const correct = logs.filter(l => l.status === QuestionStatus.FullyCorrect).length;
            const totalAttempted = logs.filter(l => l.status === QuestionStatus.FullyCorrect || l.status === QuestionStatus.Wrong).length;
            if (totalAttempted > 0) {
                chapterAccuracies.set(topic, (correct / totalAttempted) * 100);
            }
        });

        chapters.forEach(chapter => {
            const progress = userProfile.syllabus[chapter];
            if (progress?.strength === 'strength') innerRingCounts.strength++;
            else if (progress?.strength === 'weakness') innerRingCounts.weakness++;
            else if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) innerRingCounts.completed++;
            else if (progress?.status === SyllabusStatus.InProgress) innerRingCounts.inProgress++;
            else innerRingCounts.notStarted++;

            const accuracy = chapterAccuracies.get(chapter);
            if (accuracy === undefined) outerRingCounts.noData++;
            else if (accuracy >= 80) outerRingCounts.highAcc++;
            else if (accuracy >= 50) outerRingCounts.midAcc++;
            else outerRingCounts.lowAcc++;
        });
        
        if (innerRingCounts.strength > 0) innerRingData.push({ name: 'Strength', value: innerRingCounts.strength, color: '#22c55e' });
        if (innerRingCounts.weakness > 0) innerRingData.push({ name: 'Weakness', value: innerRingCounts.weakness, color: '#ef4444' });
        if (innerRingCounts.completed > 0) innerRingData.push({ name: 'Done', value: innerRingCounts.completed, color: '#3b82f6' });
        if (innerRingCounts.inProgress > 0) innerRingData.push({ name: 'In Progress', value: innerRingCounts.inProgress, color: '#eab308' });
        if (innerRingCounts.notStarted > 0) innerRingData.push({ name: 'Not Started', value: innerRingCounts.notStarted, color: '#334155' });
        
        if (outerRingCounts.highAcc > 0) outerRingData.push({ name: 'High Acc (>80%)', value: outerRingCounts.highAcc, color: '#10b981' });
        if (outerRingCounts.midAcc > 0) outerRingData.push({ name: 'Med Acc (50-80%)', value: outerRingCounts.midAcc, color: '#f59e0b' });
        if (outerRingCounts.lowAcc > 0) outerRingData.push({ name: 'Low Acc (<50%)', value: outerRingCounts.lowAcc, color: '#f43f5e' });
        if (outerRingCounts.noData > 0) outerRingData.push({ name: 'No Data', value: outerRingCounts.noData, color: '#1e293b' });

        const weightedCompletion = ( (innerRingCounts.strength + innerRingCounts.weakness + innerRingCounts.completed) + (innerRingCounts.inProgress * 0.5) ) / chapters.length * 100;

        return {
            data: { inner: innerRingData, outer: outerRingData },
            totalChapters: chapters.length,
            completion: weightedCompletion
        };
    }, [subject, chapters, userProfile, questionLogs]);
    
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            const dataName = payload[0].name;
            const dataValue = payload[0].value;
            
            const isInner = data.inner.some((d: any) => d.name === dataName);
            const ringData = isInner ? data.inner : data.outer;
            const totalRingValue = ringData.reduce((sum: number, entry: any) => sum + entry.value, 0);
            const percent = totalRingValue > 0 ? (dataValue / totalRingValue) * 100 : 0;

            return (
                <div className="glass-panel p-2 rounded-lg shadow-xl text-xs z-50">
                    <p className="font-bold text-white mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dataPoint.color }}></span>
                        {dataName}
                    </p>
                    <p className="text-gray-300">Chapters: <span className="text-white font-mono font-bold">{dataValue}</span></p>
                    <p className="text-gray-400 text-[10px]">({percent.toFixed(0)}% of total)</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-800 border border-slate-600 shadow-lg rounded-xl p-4 flex flex-col h-full animate-fade-in">
            <h4 className="text-lg font-bold text-center mb-2 capitalize" style={{ color: SUBJECT_CONFIG[subject]?.color || 'white' }}>{subject}</h4>
            
            <div className="flex-grow relative min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Tooltip 
                            wrapperStyle={{ zIndex: 1000 }}
                            content={<CustomTooltip />}
                        />
                        {/* Fix: Cast Pie to any to suppress TS errors about missing props in Recharts definition files */}
                        {(Pie as any) && <Pie 
                            data={data.inner} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            outerRadius="65%" 
                            innerRadius="45%" 
                            stroke="none"
                        >
                            {data.inner.map((entry, index) => <Cell key={`inner-${index}`} fill={entry.color} />)}
                        </Pie>}
                        {(Pie as any) && <Pie 
                            data={data.outer} 
                            dataKey="value" 
                            cx="50%" cy="50%" 
                            innerRadius="70%" 
                            outerRadius="95%" 
                            stroke="none"
                        >
                            {data.outer.map((entry, index) => <Cell key={`outer-${index}`} fill={entry.color} />)}
                        </Pie>}
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-white">{completion.toFixed(0)}%</span>
                    <span className="text-xs text-gray-400">{totalChapters} Ch.</span>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Strength</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Weakness</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Done</div>
            </div>
        </div>
    );
});
