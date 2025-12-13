
import React, { useMemo, useState } from 'react';
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
    // State to manually track which slice is hovered, bypassing potential Recharts payload conflicts
    const [hoveredData, setHoveredData] = useState<any | null>(null);

    const { data, totalChapters, completion } = useMemo(() => {
        // Data structures for Recharts
        const innerRingData: {name: string, value: number, color: string, type: string}[] = [];
        const outerRingData: {name: string, value: number, color: string, type: string}[] = [];

        // Temporary storage for categorization
        const categories = {
            strength: [] as string[],
            weakness: [] as string[],
            completed: [] as string[],
            inProgress: [] as string[],
            notStarted: [] as string[],
            highAcc: [] as string[],
            midAcc: [] as string[],
            lowAcc: [] as string[],
            noData: [] as string[]
        };
        
        // 1. Calculate Accuracy Per Chapter
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

        // 2. Distribute Chapters into Buckets
        chapters.forEach(chapter => {
            // Inner Ring: Syllabus Status
            const progress = userProfile.syllabus[chapter];
            if (progress?.strength === 'strength') categories.strength.push(chapter);
            else if (progress?.strength === 'weakness') categories.weakness.push(chapter);
            else if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) categories.completed.push(chapter);
            else if (progress?.status === SyllabusStatus.InProgress) categories.inProgress.push(chapter);
            else categories.notStarted.push(chapter);

            // Outer Ring: Performance Accuracy
            const accuracy = chapterAccuracies.get(chapter);
            if (accuracy === undefined) categories.noData.push(chapter);
            else if (accuracy >= 80) categories.highAcc.push(chapter);
            else if (accuracy >= 50) categories.midAcc.push(chapter);
            else categories.lowAcc.push(chapter);
        });
        
        // 3. Build Recharts Data Objects with explicit TYPE
        // Inner Ring Data
        if (categories.strength.length > 0) innerRingData.push({ name: 'Strength', value: categories.strength.length, color: '#22c55e', type: 'Status' });
        if (categories.weakness.length > 0) innerRingData.push({ name: 'Weakness', value: categories.weakness.length, color: '#ef4444', type: 'Status' });
        if (categories.completed.length > 0) innerRingData.push({ name: 'Done', value: categories.completed.length, color: '#3b82f6', type: 'Status' });
        if (categories.inProgress.length > 0) innerRingData.push({ name: 'In Progress', value: categories.inProgress.length, color: '#eab308', type: 'Status' });
        if (categories.notStarted.length > 0) innerRingData.push({ name: 'Not Started', value: categories.notStarted.length, color: '#334155', type: 'Status' });
        
        // Outer Ring Data
        if (categories.highAcc.length > 0) outerRingData.push({ name: 'High Acc (>80%)', value: categories.highAcc.length, color: '#10b981', type: 'Performance' });
        if (categories.midAcc.length > 0) outerRingData.push({ name: 'Med Acc (50-80%)', value: categories.midAcc.length, color: '#f59e0b', type: 'Performance' });
        if (categories.lowAcc.length > 0) outerRingData.push({ name: 'Low Acc (<50%)', value: categories.lowAcc.length, color: '#f43f5e', type: 'Performance' });
        if (categories.noData.length > 0) outerRingData.push({ name: 'No Data', value: categories.noData.length, color: '#1e293b', type: 'Performance' });

        const weightedCompletion = ( (categories.strength.length + categories.weakness.length + categories.completed.length) + (categories.inProgress.length * 0.5) ) / chapters.length * 100;

        return {
            data: { inner: innerRingData, outer: outerRingData },
            totalChapters: chapters.length,
            completion: weightedCompletion
        };
    }, [subject, chapters, userProfile, questionLogs]);
    
    // Custom Tooltip that strictly uses local state 'hoveredData' if available, 
    // falling back to payload only if state is null.
    // JITTER FIX: Removed onMouseLeave state clearing. CustomTooltip now relies on 'active' to hide.
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active) return null;

        const dataPoint = hoveredData || (payload && payload.length ? payload[0].payload : null);

        if (dataPoint) {
            // Calculate percentage relative to the total chapters in this subject
            const percent = totalChapters > 0 ? (dataPoint.value / totalChapters) * 100 : 0;

            return (
                <div className="glass-panel p-2 rounded-lg shadow-xl text-xs z-50 pointer-events-none border border-slate-600/50 bg-slate-900/90 backdrop-blur-md transition-opacity duration-200">
                    <p className="font-bold text-white mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: dataPoint.color, boxShadow: `0 0 5px ${dataPoint.color}` }}></span>
                        {dataPoint.name}
                    </p>
                    <div className="flex justify-between gap-4 text-gray-300">
                        <span>Chapters:</span>
                        <span className="text-white font-mono font-bold">{dataPoint.value}</span>
                    </div>
                    <p className="text-gray-400 text-[10px] mt-1 pt-1 border-t border-slate-700/50">
                        {percent.toFixed(0)}% of total chapters
                    </p>
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
                            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                            content={<CustomTooltip />}
                            cursor={false}
                            isAnimationActive={false} // Prevent tooltip jumping
                        />
                        
                        {/* Inner Ring: Status (Back Layer) */}
                        {(Pie as any) && <Pie 
                            data={data.inner} 
                            dataKey="value" 
                            nameKey="name"
                            cx="50%" cy="50%" 
                            outerRadius="65%" 
                            innerRadius="45%" 
                            stroke="none"
                            isAnimationActive={false}
                            onMouseEnter={(data: any) => setHoveredData(data)}
                            // Jitter Fix: Don't clear state on leave. Recharts 'active' prop handles visibility.
                        >
                            {data.inner.map((entry, index) => (
                                <Cell key={`inner-${index}`} fill={entry.color} stroke="#1e293b" strokeWidth={2} />
                            ))}
                        </Pie>}
                        
                        {/* Outer Ring: Performance (Front Layer - Captures Mouse First) */}
                        {(Pie as any) && <Pie 
                            data={data.outer} 
                            dataKey="value" 
                            nameKey="name"
                            cx="50%" cy="50%" 
                            innerRadius="70%" 
                            outerRadius="95%" 
                            stroke="none"
                            isAnimationActive={false}
                            onMouseEnter={(data: any) => setHoveredData(data)}
                            // Jitter Fix: Don't clear state on leave.
                        >
                            {data.outer.map((entry, index) => (
                                <Cell key={`outer-${index}`} fill={entry.color} stroke="#1e293b" strokeWidth={2} />
                            ))}
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
