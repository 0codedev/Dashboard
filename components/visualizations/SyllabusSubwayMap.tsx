import React from 'react';
import { UserProfile, SyllabusStatus } from '../../types';
import { SUBJECT_COLORS, TOPIC_DEPENDENCIES } from '../../constants';

// A more professionally designed, static layout for the subway map.
const LAYOUT_DATA = {
    nodes: {
        'Motion in 1D': { x: 100, y: 150, subject: 'physics' },
        'Laws of Motion': { x: 200, y: 150, subject: 'physics' },
        'Work Power Energy': { x: 400, y: 150, subject: 'physics' },
        'Rotational Motion': { x: 500, y: 150, subject: 'physics' },
        
        'Mole Concept': { x: 100, y: 450, subject: 'chemistry' },
        'Atomic Structure': { x: 200, y: 450, subject: 'chemistry' },
        'Chemical Bonding': { x: 400, y: 450, subject: 'chemistry' },
        'GOC': { x: 500, y: 450, subject: 'chemistry' },

        'Sets & Relations': { x: 650, y: 150, subject: 'maths' },
        'Functions': { x: 650, y: 250, subject: 'maths' },
        'Limits': { x: 650, y: 350, subject: 'maths' },
        'C&D': { x: 650, y: 450, subject: 'maths' },

        // Interchange Station
        'Vector Algebra': { x: 300, y: 300, subject: 'maths', isInterchange: true }
    },
    paths: [
        // Physics Line (Blue)
        { subject: 'physics', d: "M 100 150 H 500" },
        // Chemistry Line (Green)
        { subject: 'chemistry', d: "M 100 450 H 500" },
        // Maths Line (Red)
        { subject: 'maths', d: "M 650 150 V 450" },
        // Interchange Connectors
        { subject: 'maths', d: "M 300 300 L 200 150" }, // Vector -> LOM
        { subject: 'maths', d: "M 300 300 L 650 250" }, // Vector -> Functions
        { subject: 'chemistry', d: "M 400 350 L 300 300" } // Bonding -> Vector
    ]
};

interface SyllabusSubwayMapProps {
    userProfile: UserProfile;
    masteryScores: Record<string, { score: number, tier: string, color: string }>;
    onNodeClick: (topic: string) => void;
}

export const SyllabusSubwayMap: React.FC<SyllabusSubwayMapProps> = ({ userProfile, masteryScores, onNodeClick }) => {
    
    const getNodeStatus = (topic: string) => {
        const progress = userProfile.syllabus[topic];
        if (progress?.status === SyllabusStatus.Completed || progress?.status === SyllabusStatus.Revising) return 'completed';
        if (progress?.status === SyllabusStatus.InProgress) return 'inProgress';
        return 'notStarted';
    };

    return (
        <div className="w-full h-[600px] bg-slate-900 rounded-xl border border-slate-700 p-4 relative overflow-hidden flex items-center justify-center">
            <h3 className="text-xl font-bold text-slate-200 absolute top-4 left-4 z-10">Learning Subway Map</h3>
            <svg width="100%" height="100%" viewBox="0 0 800 600">
                <defs>
                    <style>{`
                        @keyframes pulse {
                            0%, 100% { stroke-width: 4px; opacity: 0.8; }
                            50% { stroke-width: 12px; opacity: 0.3; }
                        }
                        .bottleneck-halo {
                            animation: pulse 2s ease-in-out infinite;
                        }
                    `}</style>
                </defs>

                {/* Background Grid */}
                <path d="M0 300 H 800 M 400 0 V 600" stroke="#1e293b" strokeWidth="1" />

                {/* Paths */}
                {LAYOUT_DATA.paths.map((path, i) => (
                     <path 
                        key={i}
                        d={path.d}
                        stroke={SUBJECT_COLORS[path.subject as keyof typeof SUBJECT_COLORS]}
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                        opacity={0.5}
                    />
                ))}

                {/* Stations */}
                {Object.entries(LAYOUT_DATA.nodes).map(([topic, nodeData]) => {
                    // Fix: Destructure properties from nodeData and handle optional 'isInterchange' property.
                    const { x, y, subject } = nodeData;
                    const isInterchange = 'isInterchange' in nodeData && nodeData.isInterchange;
                    const status = getNodeStatus(topic);
                    const mastery = masteryScores[topic];
                    const isBottleneck = TOPIC_DEPENDENCIES[topic] && mastery && mastery.score < 1200;

                    let station;
                    const r = isInterchange ? 12 : 8;

                    if (status === 'completed') {
                        station = <circle cx={x} cy={y} r={r} fill={SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]} stroke="#fff" strokeWidth="2" />;
                    } else if (status === 'inProgress') {
                        station = <circle cx={x} cy={y} r={r} fill="#1e293b" stroke="#fff" strokeWidth="3" />;
                    } else { // not started
                        station = <circle cx={x} cy={y} r={r-2} fill="#1e293b" stroke={SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]} strokeWidth="2" />;
                    }
                    
                    return (
                        <g key={topic} className="cursor-pointer group" onClick={() => onNodeClick(topic)}>
                           {isBottleneck && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#ef4444" className="bottleneck-halo" />}
                           {station}
                           <text x={x} y={y - (r + 8)} textAnchor="middle" fill="#94a3b8" fontSize="11" className="group-hover:fill-white transition-colors pointer-events-none">{topic}</text>
                           {status === 'completed' && <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="10" className="pointer-events-none">★</text>}
                        </g>
                    );
                })}
            </svg>
            <div className="absolute bottom-4 left-4 text-[10px] text-gray-500 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700 space-y-1">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-white bg-cyan-500 flex items-center justify-center text-white text-[8px]">★</div> Completed</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-white bg-slate-800"></div> In Progress</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-cyan-500 bg-slate-800"></div> Not Started</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent animate-pulse"></div> Bottleneck</div>
            </div>
        </div>
    );
};
