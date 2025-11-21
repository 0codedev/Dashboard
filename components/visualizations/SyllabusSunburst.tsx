
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { JEE_SYLLABUS, SUBJECT_COLORS } from '../../constants';
import { UserProfile, SyllabusStatus } from '../../types';

interface SyllabusSunburstProps {
    userProfile: UserProfile;
    onSliceClick?: (type: 'subject' | 'unit', name: string) => void;
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#0f172a" // slate-900 matching bg
        strokeWidth={4}
      />
    </g>
  );
};

export const SyllabusSunburst: React.FC<SyllabusSunburstProps> = ({ userProfile, onSliceClick }) => {
    const [activeInnerIndex, setActiveInnerIndex] = useState<number | undefined>(undefined);
    const [activeOuterIndex, setActiveOuterIndex] = useState<number | undefined>(undefined);

    const { innerData, outerData } = useMemo(() => {
        const subjects = ['physics', 'chemistry', 'maths'] as const;
        const iData: any[] = []; // Inner Ring (Subjects)
        const oData: any[] = []; // Outer Ring (Units)

        // Iterate strictly in order to align inner and outer rings
        subjects.forEach(subject => {
            // @ts-ignore
            const units = JEE_SYLLABUS[subject];
            let subjectTotalWeight = 0;

            units.forEach((unit: any) => {
                // Calculate weight for this unit (based on chapter count)
                const unitWeight = unit.chapters.length;
                
                // Calculate completion status for coloring/opacity
                let completedChapters = 0;
                unit.chapters.forEach((chapter: any) => {
                    const progress = userProfile.syllabus[chapter.name];
                    if (progress) {
                        if (progress.status === SyllabusStatus.Completed || progress.status === SyllabusStatus.Revising) completedChapters += 1;
                        else if (progress.status === SyllabusStatus.InProgress) completedChapters += 0.5;
                    }
                });
                const completionRatio = unitWeight > 0 ? completedChapters / unitWeight : 0;

                oData.push({
                    name: unit.unit,
                    value: unitWeight, // Size based on chapter count
                    subject: subject,
                    completion: completionRatio,
                    color: SUBJECT_COLORS[subject] // Base color matches subject
                });

                subjectTotalWeight += unitWeight;
            });

            iData.push({
                name: subject.charAt(0).toUpperCase() + subject.slice(1),
                value: subjectTotalWeight,
                color: SUBJECT_COLORS[subject]
            });
        });

        return { innerData: iData, outerData: oData };
    }, [userProfile]);

    const onPieLeave = () => {
        setActiveInnerIndex(undefined);
        setActiveOuterIndex(undefined);
    };

    const handleClick = (data: any, level: 'subject' | 'unit') => {
        if(onSliceClick) onSliceClick(level, data.name);
    };

    const onInnerEnter = (_: any, index: number) => {
        setActiveInnerIndex(index);
        setActiveOuterIndex(undefined); // Clear outer focus to avoid confusion
    };

    const onOuterEnter = (_: any, index: number) => {
        setActiveOuterIndex(index);
        setActiveInnerIndex(undefined); // Clear inner focus to avoid confusion
    };

    return (
        <div className="w-full h-[400px] relative bg-slate-900/30 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center p-4 animate-fade-in">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart onMouseLeave={onPieLeave}>
                    <Tooltip 
                        wrapperStyle={{ zIndex: 1000 }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                // Logic to determine which payload is currently "active" based on state
                                const activePayload = payload.find((p: any) => {
                                    // If outer is active, show outer. If inner is active, show inner.
                                    if (activeOuterIndex !== undefined && p.name === outerData[activeOuterIndex]?.name) return true;
                                    if (activeInnerIndex !== undefined && p.name === innerData[activeInnerIndex]?.name) return true;
                                    return false;
                                }) || payload[0];

                                const d = activePayload.payload;
                                const isUnit = d.subject !== undefined; // Unit data has 'subject' property, Subject data does not in this context structure

                                return (
                                    <div className="bg-slate-800/90 border border-slate-600 p-3 rounded-lg shadow-xl text-xs z-50 backdrop-blur-sm">
                                        <p className="font-bold text-white text-sm mb-1">{d.name}</p>
                                        {isUnit ? (
                                            <div className="space-y-1">
                                                <p className="text-gray-300 flex justify-between gap-4"><span>Type:</span> <span>Unit ({d.value} ch)</span></p>
                                                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1">
                                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.completion * 100}%`, backgroundColor: d.color }}></div>
                                                </div>
                                                <p className="text-right text-[10px] text-gray-400 mt-0.5">{(d.completion * 100).toFixed(0)}% Done</p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-300">Subject Total: {d.value} Chapters</p>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    
                    {/* Inner Ring: Subjects */}
                    <Pie
                        activeIndex={activeInnerIndex}
                        activeShape={renderActiveShape}
                        data={innerData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={2}
                        onMouseEnter={onInnerEnter}
                        onClick={(data) => handleClick(data, 'subject')}
                        isAnimationActive={true}
                    >
                        {innerData.map((entry: any, index: number) => (
                            <Cell key={`cell-inner-${index}`} fill={entry.color} stroke={activeInnerIndex === index ? '#fff' : '#0f172a'} strokeWidth={activeInnerIndex === index ? 2 : 2}/>
                        ))}
                    </Pie>

                    {/* Outer Ring: Units */}
                    <Pie
                        activeIndex={activeOuterIndex}
                        activeShape={renderActiveShape}
                        data={outerData}
                        cx="50%"
                        cy="50%"
                        innerRadius={95}
                        outerRadius={140}
                        dataKey="value"
                        stroke="#0f172a"
                        strokeWidth={1}
                        onMouseEnter={onOuterEnter}
                        onClick={(data) => handleClick(data, 'unit')}
                        isAnimationActive={true}
                    >
                        {outerData.map((entry: any, index: number) => (
                            <Cell 
                                key={`cell-outer-${index}`} 
                                fill={entry.color} 
                                // Opacity logic: 0.5 base + 0.5 * completion. 
                                fillOpacity={0.5 + (entry.completion * 0.5)} 
                                stroke={activeOuterIndex === index ? '#fff' : '#0f172a'}
                            />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 pointer-events-none bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-500 opacity-50 mr-1"></span>
                Outer opacity = Completion %
            </div>
        </div>
    );
};
