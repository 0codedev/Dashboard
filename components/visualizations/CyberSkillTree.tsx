
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { UserProfile, SyllabusStatus, ChapterProgress } from '../../types';
import { JEE_SYLLABUS, SUBJECT_COLORS } from '../../constants';

interface CyberSkillTreeProps {
    userProfile: UserProfile;
    masteryScores: Record<string, { score: number, tier: string, color: string }>;
    onNodeClick: (topic: string) => void;
}

// --- Icons (Raw SVG to avoid dependencies) ---
const Icons = {
    Lock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
    ),
    Crown: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-300">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path>
        </svg>
    ),
    Bolt: () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-cyan-300 animate-pulse">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
    )
};

// --- Helper Functions ---
const getStatusColor = (status: SyllabusStatus | undefined, subjectColor: string) => {
    if (status === SyllabusStatus.Completed || status === SyllabusStatus.Revising) return subjectColor;
    if (status === SyllabusStatus.InProgress) return '#22d3ee'; // Cyan for active
    return '#475569'; // Slate 600 for locked
};

const getHexPoints = (x: number, y: number, r: number) => {
    // Flat-topped hexagon points
    const angles = [0, 60, 120, 180, 240, 300];
    return angles.map(angle => {
        const rad = (Math.PI / 180) * angle;
        return `${x + r * Math.cos(rad)},${y + r * Math.sin(rad)}`;
    }).join(' ');
};

export const CyberSkillTree: React.FC<CyberSkillTreeProps> = ({ userProfile, masteryScores, onNodeClick }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [hoveredNode, setHoveredNode] = useState<{ id: string, x: number, y: number, subject: string } | null>(null);

    // --- Data Processing for Layout ---
    const { lanes, width } = useMemo(() => {
        const NODE_SPACING = 140; // Horizontal distance
        const PADDING_X = 80;
        const subjects = ['physics', 'chemistry', 'maths'] as const;
        
        const processedLanes = subjects.map(subject => {
            // @ts-ignore
            const units = JEE_SYLLABUS[subject];
            // Flatten chapters to linear list for timeline
            const chapters: any[] = units.flatMap((u: any) => u.chapters);
            
            return {
                subject,
                color: SUBJECT_COLORS[subject],
                nodes: chapters.map((ch, index) => ({
                    id: ch.name,
                    x: PADDING_X + index * NODE_SPACING,
                    y: 60, // Centered in lane (Lane height 120)
                    index,
                    total: chapters.length
                }))
            };
        });

        const maxNodes = Math.max(...processedLanes.map(l => l.nodes.length));
        return { 
            lanes: processedLanes, 
            width: maxNodes * NODE_SPACING + PADDING_X * 2 
        };
    }, []);

    // --- Interactive Handlers ---
    const handleNodeEnter = (e: React.MouseEvent, node: any, subject: string) => {
        const rect = (e.target as Element).getBoundingClientRect();
        const containerRect = scrollContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
             setHoveredNode({
                id: node.id,
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top - 10,
                subject
            });
        }
    };

    return (
        <div className="w-full bg-[#0b1121] rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden relative group select-none">
            {/* Background Cyber-Grid */}
            <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                    backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', 
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(to bottom, transparent, black, transparent)'
                }} 
            />

            {/* Header / Legend */}
            <div className="absolute top-4 left-4 z-20 flex gap-4 text-[10px] uppercase tracking-widest font-bold">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-600 border border-slate-400 border-dashed"></span> Locked</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]"></span> In Progress</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 border border-yellow-200"></span> Mastered</div>
            </div>

            {/* Main Scroll Area */}
            <div 
                ref={scrollContainerRef}
                className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar relative py-12"
                style={{ scrollBehavior: 'smooth' }}
            >
                <div style={{ width: `${width}px`, height: '420px', position: 'relative' }}>
                    {/* Render Lanes */}
                    {lanes.map((lane, laneIndex) => (
                        <div 
                            key={lane.subject} 
                            className="absolute left-0 w-full"
                            style={{ top: `${laneIndex * 140}px`, height: '140px' }}
                        >
                            {/* Subject Label Watermark */}
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-6xl font-black text-slate-800/50 uppercase pointer-events-none select-none tracking-tighter">
                                {lane.subject}
                            </div>

                            {/* Connection Lines Layer (SVG) */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                <defs>
                                    <linearGradient id={`grad-${lane.subject}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={lane.color} stopOpacity="0.1" />
                                        <stop offset="50%" stopColor={lane.color} stopOpacity="0.5" />
                                        <stop offset="100%" stopColor={lane.color} stopOpacity="0.1" />
                                    </linearGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                                {lane.nodes.map((node, i) => {
                                    if (i === lane.nodes.length - 1) return null;
                                    const nextNode = lane.nodes[i + 1];
                                    
                                    const progress = userProfile.syllabus[node.id];
                                    const nextProgress = userProfile.syllabus[nextNode.id];
                                    
                                    const isUnlocked = progress?.status && progress.status !== SyllabusStatus.NotStarted;
                                    const isNextUnlocked = nextProgress?.status && nextProgress.status !== SyllabusStatus.NotStarted;

                                    return (
                                        <path
                                            key={`link-${i}`}
                                            d={`M ${node.x + 30} ${node.y} C ${node.x + 70} ${node.y}, ${nextNode.x - 70} ${nextNode.y}, ${nextNode.x - 30} ${nextNode.y}`}
                                            stroke={isUnlocked ? lane.color : '#334155'}
                                            strokeWidth={isUnlocked ? 3 : 2}
                                            strokeDasharray={isUnlocked ? 'none' : '4 4'}
                                            fill="none"
                                            className="transition-all duration-500"
                                            style={{ 
                                                opacity: isUnlocked ? 0.6 : 0.3,
                                                filter: isUnlocked ? 'url(#glow)' : 'none'
                                            }}
                                        />
                                    );
                                })}
                            </svg>

                            {/* Hex Nodes Layer */}
                            {lane.nodes.map((node) => {
                                const progress = userProfile.syllabus[node.id];
                                const status = progress?.status || SyllabusStatus.NotStarted;
                                const isLocked = status === SyllabusStatus.NotStarted;
                                const isMastered = status === SyllabusStatus.Completed || status === SyllabusStatus.Revising;
                                const isInProgress = status === SyllabusStatus.InProgress;
                                
                                const nodeColor = getStatusColor(status, lane.color);

                                return (
                                    <div
                                        key={node.id}
                                        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                                        style={{ left: node.x, top: node.y }}
                                        onClick={() => onNodeClick(node.id)}
                                        onMouseEnter={(e) => handleNodeEnter(e, node, lane.subject)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                    >
                                        {/* Outer Glow Ring for Active Nodes */}
                                        {isInProgress && (
                                            <div className="absolute inset-0 -m-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                                        )}

                                        {/* Hexagon Container */}
                                        <div className="relative w-16 h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                            
                                            {/* Hexagon Shape SVG */}
                                            <svg width="64" height="64" viewBox="0 0 100 100" className="absolute inset-0 drop-shadow-lg">
                                                {/* Fill */}
                                                <path 
                                                    d="M50 0 L93.3 25 V75 L50 100 L6.7 75 V25 Z" 
                                                    fill={isLocked ? '#0f172a' : '#1e293b'}
                                                    stroke={nodeColor}
                                                    strokeWidth={isMastered ? 3 : isLocked ? 1 : 2}
                                                    strokeDasharray={isLocked ? '4 2' : 'none'}
                                                    className="transition-colors duration-300"
                                                />
                                                {/* Inner Progress Fill (Simulated) */}
                                                {!isLocked && (
                                                    <path 
                                                        d="M50 10 L85 30 V70 L50 90 L15 70 V30 Z"
                                                        fill={nodeColor}
                                                        fillOpacity={isMastered ? 0.2 : 0.1}
                                                    />
                                                )}
                                            </svg>

                                            {/* Icon / Content */}
                                            <div className="relative z-10 text-white flex flex-col items-center gap-1">
                                                {isMastered ? <Icons.Crown /> : isInProgress ? <Icons.Bolt /> : <Icons.Lock />}
                                                {masteryScores[node.id] && masteryScores[node.id].score > 1200 && (
                                                    <span className="text-[8px] font-bold text-yellow-400 bg-black/50 px-1 rounded">
                                                        {Math.round(masteryScores[node.id].score)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Label under node */}
                                        <div className={`absolute top-14 left-1/2 -translate-x-1/2 w-32 text-center text-[10px] font-medium transition-colors duration-300 leading-tight ${isLocked ? 'text-slate-600' : 'text-slate-300 group-hover:text-white'}`}>
                                            {node.id}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Holographic Tooltip */}
                {hoveredNode && (
                    <div 
                        className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 animate-fade-in"
                        style={{ 
                            left: scrollContainerRef.current?.getBoundingClientRect().left! + hoveredNode.x, 
                            top: scrollContainerRef.current?.getBoundingClientRect().top! + hoveredNode.y 
                        }}
                    >
                        <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 p-3 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] min-w-[180px]">
                            <div className="flex justify-between items-start mb-2 border-b border-cyan-900/50 pb-2">
                                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">{hoveredNode.subject}</span>
                                <span className="text-[9px] text-slate-400">ID: {hoveredNode.id.substring(0, 3).toUpperCase()}</span>
                            </div>
                            <p className="text-white font-bold text-sm mb-1">{hoveredNode.id}</p>
                            
                            {(() => {
                                const prog = userProfile.syllabus[hoveredNode.id];
                                const status = prog?.status || SyllabusStatus.NotStarted;
                                
                                return (
                                    <div className="space-y-2 mt-2">
                                        <div className="flex justify-between text-[10px] text-gray-400">
                                            <span>Status</span>
                                            <span className={status === SyllabusStatus.Completed ? 'text-green-400' : 'text-white'}>{status}</span>
                                        </div>
                                        
                                        {/* Retention Bar Mockup */}
                                        {status !== SyllabusStatus.NotStarted && (
                                            <div>
                                                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                                    <span>Retention</span>
                                                    <span>{prog?.revisionCount || 0} Revs</span>
                                                </div>
                                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 w-3/4"></div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="text-[10px] text-center text-cyan-400 pt-1 mt-1 border-t border-slate-800 italic">
                                            {status === SyllabusStatus.NotStarted ? "Click to Unlock" : "Click to Manage"}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        {/* Tooltip Arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-3 h-3 bg-slate-900 border-r border-b border-cyan-500/30 transform rotate-45"></div>
                    </div>
                )}
            </div>
            
             {/* Fade Gradients for Scroll Indication */}
             <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0b1121] to-transparent pointer-events-none z-10"></div>
             <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0b1121] to-transparent pointer-events-none z-10"></div>
        </div>
    );
};
