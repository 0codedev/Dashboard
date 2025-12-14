
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { UserProfile, SyllabusStatus } from '../../types';
import { JEE_SYLLABUS, TOPIC_DEPENDENCIES, SUBJECT_COLORS, TOPIC_WEIGHTAGE } from '../../constants';

interface SyllabusRiverFlowProps {
    userProfile: UserProfile;
    masteryScores: Record<string, { score: number, tier: string, color: string }>;
    onNodeClick: (topic: string) => void;
}

const getWeightValue = (topic: string) => (TOPIC_WEIGHTAGE[topic] === 'High' ? 3 : TOPIC_WEIGHTAGE[topic] === 'Medium' ? 2 : 1);

const getAbbreviation = (topic: string): string => {
    const words = topic.split(/[\s&]+/).filter(w => w.length > 0 && !['of', 'in', 'the'].includes(w.toLowerCase()));
    if (words.length > 1) {
        return words.map(w => w[0]).join('').toUpperCase();
    }
    if (topic.length > 3) {
        return topic.substring(0, 3).toUpperCase();
    }
    return topic.toUpperCase();
};

export const SyllabusRiverFlow: React.FC<SyllabusRiverFlowProps> = ({ userProfile, masteryScores, onNodeClick }) => {
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [hoveredNode, setHoveredNode] = useState<{ topic: string, x: number, y: number, subject: string } | null>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { layers, edges, nodePositions, maxLayerWidth, contentHeight } = useMemo(() => {
        const allTopics = new Set(Object.values(JEE_SYLLABUS).flatMap(s => s.flatMap(u => u.chapters.map(c => c.name))));
        const inDegree: Record<string, number> = {};
        const adj: Record<string, string[]> = {};

        allTopics.forEach(topic => { inDegree[topic] = 0; adj[topic] = []; });

        Object.entries(TOPIC_DEPENDENCIES).forEach(([topic, prereqs]) => {
            prereqs.forEach(prereq => {
                if (allTopics.has(topic) && allTopics.has(prereq)) {
                    adj[prereq].push(topic);
                    inDegree[topic]++;
                }
            });
        });
        
        const originalInDegree = { ...inDegree };

        let queue = Object.keys(inDegree).filter(topic => inDegree[topic] === 0);
        const newLayers: string[][] = [];

        while (queue.length > 0) {
            newLayers.push(queue);
            const nextQueue: string[] = [];
            queue.forEach(topic => {
                (adj[topic] || []).forEach(neighbor => {
                    inDegree[neighbor]--;
                    if (inDegree[neighbor] === 0) nextQueue.push(neighbor);
                });
            });
            queue = nextQueue;
        }

        const nodePos: Record<string, { x: number, y: number, color: string, isWeak: boolean, weight: number, subject: string }> = {};
        const layerPadding = 180;
        const baseNodePadding = 120;
        let mLayerWidth = 0;
        
        const subjectOrder = ['physics', 'chemistry', 'maths'];

        newLayers.forEach((layer, layerIndex) => {
            const getSubject = (topic: string) => {
                 for (const sub of subjectOrder) {
                     // @ts-ignore
                    if (JEE_SYLLABUS[sub].some((u: any) => u.chapters.some((c: any) => c.name === topic))) return sub;
                }
                return 'other';
            }
            
            const sortedLayer = layer.sort((a, b) => {
                const isConnectedA = (adj[a]?.length > 0) || (originalInDegree[a] > 0);
                const isConnectedB = (adj[b]?.length > 0) || (originalInDegree[b] > 0);

                if (isConnectedA && !isConnectedB) return -1;
                if (!isConnectedA && isConnectedB) return 1;

                const subA = getSubject(a);
                const subB = getSubject(b);
                if (subA !== subB) return subjectOrder.indexOf(subA) - subjectOrder.indexOf(subB);
                
                return a.localeCompare(b);
            });

            const layerWidth = (sortedLayer.length - 1) * baseNodePadding;
            mLayerWidth = Math.max(mLayerWidth, layerWidth);
            const startX = (Math.max(1000, layerWidth) - layerWidth) / 2 + 50;
            
            sortedLayer.forEach((topic, nodeIndex) => {
                const mastery = masteryScores[topic];
                nodePos[topic] = {
                    x: startX + nodeIndex * baseNodePadding,
                    y: 100 + layerIndex * layerPadding,
                    color: mastery?.color || '#64748b',
                    isWeak: !mastery || mastery.score < 1200,
                    weight: getWeightValue(topic),
                    subject: getSubject(topic)
                };
            });
        });
        
        const newEdges = Object.entries(TOPIC_DEPENDENCIES).flatMap(([topic, prereqs]) => 
            prereqs.map(prereq => ({ from: prereq, to: topic }))
        ).filter(edge => nodePos[edge.from] && nodePos[edge.to]);

        return { layers: newLayers, edges: newEdges, nodePositions: nodePos, maxLayerWidth: mLayerWidth + 100, contentHeight: newLayers.length * layerPadding + 100 };
    }, [masteryScores]) as {
        layers: string[][];
        edges: { from: string; to: string }[];
        nodePositions: Record<string, { x: number, y: number, color: string, isWeak: boolean, weight: number, subject: string }>;
        maxLayerWidth: number;
        contentHeight: number;
    };

    const upstream = useMemo(() => {
        if (!selectedTopic) return new Set();
        const path = new Set<string>();
        const q = [selectedTopic];
        while(q.length > 0) {
            const curr = q.shift()!;
            path.add(curr);
            edges.forEach(e => {
                if (e.to === curr && !path.has(e.from)) q.push(e.from);
            });
        }
        return path;
    }, [selectedTopic, edges]);

     const downstream = useMemo(() => {
        if (!selectedTopic) return new Set();
        const path = new Set<string>();
        const q = [selectedTopic];
        while(q.length > 0) {
            const curr = q.shift()!;
            path.add(curr);
            edges.forEach(e => {
                if (e.from === curr && !path.has(e.to)) q.push(e.to);
            });
        }
        return path;
    }, [selectedTopic, edges]);

    const handleZoom = (direction: 'in' | 'out') => {
        const scaleFactor = 1.2;
        const newScale = direction === 'in' ? transform.scale * scaleFactor : transform.scale / scaleFactor;
        setTransform(t => ({ ...t, scale: Math.max(0.2, Math.min(3, newScale))}));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) { // Only pan on background
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => setIsPanning(false);
    
    const handleNodeClick = (e: React.MouseEvent, topic: string) => {
        e.stopPropagation();
        setSelectedTopic(prev => prev === topic ? null : topic);
        if (onNodeClick) onNodeClick(topic); // Optional: if prop provided
    }

    const handleNodeEnter = (e: React.MouseEvent, topic: string, subject: string) => {
        const rect = (e.target as Element).getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
            setHoveredNode({
                topic,
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top - 10,
                subject
            });
        }
    };

    return (
        <div ref={containerRef} className="w-full h-[600px] bg-slate-900 rounded-xl border border-slate-700 p-4 relative overflow-hidden">
            <h3 className="text-xl font-bold text-slate-200 absolute top-4 left-4 z-10">Prerequisite River Flow</h3>
            <svg 
                ref={svgRef}
                width="100%" height="100%" 
                className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            >
                <defs>
                    <style>{`@keyframes flow { to { stroke-dashoffset: -20; } } .bottleneck-edge { animation: flow 1.5s linear infinite; }`}</style>
                </defs>
                <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                    {edges.map(({ from, to }, i) => {
                        const fromPos = nodePositions[from];
                        const toPos = nodePositions[to];
                        const isBottleneck = fromPos.isWeak;
                        const strokeW = fromPos.weight * 2;
                        
                        const isActive = selectedTopic && ( (downstream.has(from) && downstream.has(to)) || (upstream.has(from) && upstream.has(to)) );

                        return (
                            <path 
                                key={i}
                                d={`M ${fromPos.x} ${fromPos.y} C ${fromPos.x} ${fromPos.y + 75}, ${toPos.x} ${toPos.y - 75}, ${toPos.x} ${toPos.y}`}
                                stroke={isBottleneck ? '#22d3ee' : (isActive ? fromPos.color : '#334155')}
                                strokeWidth={isActive ? strokeW + 2 : strokeW}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={isBottleneck ? '8 4' : 'none'}
                                className={isBottleneck ? 'bottleneck-edge' : ''}
                                style={{ transition: 'all 0.3s ease' }}
                                opacity={selectedTopic ? (isActive ? 0.8 : 0.1) : 0.6}
                            />
                        );
                    })}

                    {Object.entries(nodePositions).map(([topic, { x, y, color, isWeak, weight, subject }]) => {
                        const isActive = selectedTopic === topic || upstream.has(topic) || downstream.has(topic);
                        const radius = 12 + weight * 4;
                        return (
                             <g 
                                key={topic} 
                                className="cursor-pointer group" 
                                onClick={(e) => handleNodeClick(e, topic)}
                                onMouseEnter={(e) => handleNodeEnter(e, topic, subject)}
                                onMouseLeave={() => setHoveredNode(null)}
                            >
                                <circle 
                                    cx={x} cy={y}
                                    r={radius + 3}
                                    fill="none"
                                    stroke={SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS] || '#475569'}
                                    strokeWidth="2"
                                    opacity={selectedTopic ? (isActive ? 0.8 : 0.2) : 0.6}
                                />
                                <circle 
                                    cx={x} cy={y} 
                                    r={radius} 
                                    fill={color} 
                                    stroke={isActive ? '#fff' : '#1e293b'} 
                                    strokeWidth="3"
                                    style={{ transition: 'all 0.3s ease' }}
                                    opacity={selectedTopic ? (isActive ? 1 : 0.3) : 1}
                                />
                                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="10" fontWeight="bold" className="pointer-events-none" opacity={selectedTopic ? (isActive ? 1 : 0.3) : 1}>
                                    {getAbbreviation(topic)}
                                </text>
                            </g>
                        )
                    })}
                </g>
            </svg>
            <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-3 z-20">
                <span>Node size & Flow width = Topic Weightage</span>
                 <div className="flex gap-1">
                    <button onClick={() => handleZoom('in')} className="w-6 h-6 bg-slate-700 rounded text-white hover:bg-slate-600">+</button>
                    <button onClick={() => handleZoom('out')} className="w-6 h-6 bg-slate-700 rounded text-white hover:bg-slate-600">-</button>
                 </div>
            </div>

            {/* Professional Overlay Tooltip */}
            {hoveredNode && (
                <div 
                    className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 animate-fade-in"
                    style={{ 
                        left: containerRef.current?.getBoundingClientRect().left! + hoveredNode.x, 
                        top: containerRef.current?.getBoundingClientRect().top! + hoveredNode.y 
                    }}
                >
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] min-w-[220px]">
                        <div className="flex justify-between items-start mb-2 border-b border-cyan-900/50 pb-2">
                            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">{hoveredNode.subject}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">ID: {getAbbreviation(hoveredNode.topic)}</span>
                        </div>
                        <p className="text-white font-bold text-base mb-3 leading-tight">{hoveredNode.topic}</p>
                        
                        {(() => {
                            const prog = userProfile.syllabus[hoveredNode.topic];
                            const status = prog?.status || SyllabusStatus.NotStarted;
                            const mastery = masteryScores[hoveredNode.topic];
                            
                            return (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[11px] text-gray-400">
                                        <span>Status</span>
                                        <span className={`font-medium ${status === SyllabusStatus.Completed ? 'text-green-400' : status === SyllabusStatus.InProgress ? 'text-yellow-400' : 'text-white'}`}>{status}</span>
                                    </div>
                                    
                                    {mastery && (
                                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                            <div className="flex justify-between text-[10px] mb-1">
                                                <span className="text-slate-400">Mastery</span>
                                                <span className="font-bold" style={{color: mastery.color}}>{mastery.tier}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(100, (mastery.score / 2000) * 100)}%`, backgroundColor: mastery.color }}
                                                ></div>
                                            </div>
                                            <div className="text-right text-[9px] text-slate-500 mt-1 font-mono">{Math.round(mastery.score)} XP</div>
                                        </div>
                                    )}

                                    {TOPIC_DEPENDENCIES[hoveredNode.topic] && TOPIC_DEPENDENCIES[hoveredNode.topic].length > 0 && (
                                         <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 mt-2">
                                            <span className="block mb-1 font-semibold">Depends on:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {TOPIC_DEPENDENCIES[hoveredNode.topic].map(dep => (
                                                    <span key={dep} className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700">{getAbbreviation(dep)}</span>
                                                ))}
                                            </div>
                                         </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-[-8px] w-4 h-4 bg-slate-900 border-r border-b border-cyan-500/30 transform rotate-45"></div>
                </div>
            )}
        </div>
    );
};
