
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UserProfile, SyllabusStatus } from '../../types';
import { JEE_SYLLABUS, TOPIC_DEPENDENCIES, TOPIC_WEIGHTAGE } from '../../constants';

interface Node {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    subject: string;
    isLocked: boolean;
    masteryTier: string;
    isDragging: boolean;
}

interface Edge {
    source: string;
    target: string;
    isBottleneck: boolean;
}

interface SyllabusNetworkProps {
    userProfile: UserProfile;
    masteryScores: Record<string, { score: number, tier: string, color: string }>;
    onNodeClick: (topic: string) => void;
}

export const SyllabusNetwork: React.FC<SyllabusNetworkProps> = React.memo(({ userProfile, masteryScores, onNodeClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const [isStable, setIsStable] = useState(false);

    // Physics Constants
    const REPULSION = 1500;
    const SPRING_LENGTH = 100;
    const SPRING_STRENGTH = 0.05;
    const DAMPING = 0.8;
    const CENTER_GRAVITY = 0.02;

    const getRadius = useCallback((topic: string) => {
        const w = TOPIC_WEIGHTAGE[topic];
        return w === 'High' ? 25 : w === 'Medium' ? 18 : 12;
    }, []);

    useEffect(() => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const addedTopics = new Set<string>();

        // Initialize Nodes
        ['physics', 'chemistry', 'maths'].forEach((subject) => {
            // @ts-ignore
            JEE_SYLLABUS[subject].forEach(unit => {
                unit.chapters.forEach((chapter: any) => {
                    const topic = chapter.name;
                    if (addedTopics.has(topic)) return;

                    const prereqs = TOPIC_DEPENDENCIES[topic] || [];
                    
                    // Check Locked Status
                    let isLocked = false;
                    if (prereqs.length > 0) {
                        const unfinishedPrereqs = prereqs.filter(p => {
                            const progress = userProfile.syllabus[p];
                            return !progress || (progress.status !== SyllabusStatus.Completed && progress.status !== SyllabusStatus.Revising);
                        });
                        if (unfinishedPrereqs.length > 0) isLocked = true;
                    }

                    const mastery = masteryScores[topic] || { score: 1000, tier: 'Novice', color: '#64748b' };

                    newNodes.push({
                        id: topic,
                        x: Math.random() * 800,
                        y: Math.random() * 600,
                        vx: 0,
                        vy: 0,
                        radius: getRadius(topic),
                        color: isLocked ? '#334155' : mastery.color,
                        subject: subject,
                        isLocked: isLocked,
                        masteryTier: mastery.tier,
                        isDragging: false
                    });
                    addedTopics.add(topic);
                });
            });
        });

        // Initialize Edges
        newNodes.forEach(node => {
            const prereqs = TOPIC_DEPENDENCIES[node.id] || [];
            prereqs.forEach(p => {
                if (addedTopics.has(p)) {
                    // Bottleneck detection: If Prereq is low mastery/not done, connection is "Bottleneck"
                    const pMastery = masteryScores[p];
                    const isBottleneck = !pMastery || pMastery.score < 1200;
                    newEdges.push({ source: p, target: node.id, isBottleneck });
                }
            });
        });

        // Initial Positioning by Subject Cluster
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        
        newNodes.forEach(n => {
            let cx = width / 2, cy = height / 2;
            if (n.subject === 'physics') { cx = width * 0.25; cy = height * 0.3; }
            else if (n.subject === 'chemistry') { cx = width * 0.75; cy = height * 0.3; }
            else if (n.subject === 'maths') { cx = width * 0.5; cy = height * 0.8; }
            
            n.x = cx + (Math.random() - 0.5) * 200;
            n.y = cy + (Math.random() - 0.5) * 200;
        });

        nodesRef.current = newNodes;
        edgesRef.current = newEdges;
        setIsStable(false);

    }, [userProfile, masteryScores, getRadius]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Edges
        edgesRef.current.forEach(edge => {
            const source = nodesRef.current.find(n => n.id === edge.source);
            const target = nodesRef.current.find(n => n.id === edge.target);
            if (!source || !target) return;

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            
            if (edge.isBottleneck) {
                ctx.strokeStyle = '#ef4444'; // Red for bottleneck
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]); // Dashed line
            } else {
                ctx.strokeStyle = '#475569'; // Slate for normal
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
            }
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
        });

        // Draw Nodes
        nodesRef.current.forEach(node => {
            // Glow for masters
            if (node.masteryTier === 'Grandmaster' || node.masteryTier === 'Expert') {
                ctx.shadowBlur = 15;
                ctx.shadowColor = node.color;
            } else {
                ctx.shadowBlur = 0;
            }

            // Node Body
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();
            
            // Border
            if (node.isLocked) {
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Lock Icon
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔒', node.x, node.y);
            } else {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.shadowBlur = 0;

            // Label
            if (node.radius > 15 || node.masteryTier === 'Grandmaster') {
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(node.id, node.x, node.y + node.radius + 4);
            }
        });

    }, []);

    const updatePhysics = useCallback(() => {
        if (isStable) return;

        let maxVel = 0;
        const width = canvasRef.current?.width || 800;
        const height = canvasRef.current?.height || 600;

        nodesRef.current.forEach(node => {
            if (node.isDragging) return;

            let fx = 0, fy = 0;

            // Repulsion
            nodesRef.current.forEach(other => {
                if (node.id === other.id) return;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distSq = dx * dx + dy * dy || 1;
                if (distSq < 100000) { // Optimization
                    const force = REPULSION / distSq;
                    const dist = Math.sqrt(distSq);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            });

            // Spring Forces
            edgesRef.current.forEach(edge => {
                if (edge.source === node.id || edge.target === node.id) {
                    const otherId = edge.source === node.id ? edge.target : edge.source;
                    const other = nodesRef.current.find(n => n.id === otherId);
                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                    }
                }
            });

            // Subject Gravity
            let cx = width / 2, cy = height / 2;
            if (node.subject === 'physics') { cx = width * 0.25; cy = height * 0.3; }
            else if (node.subject === 'chemistry') { cx = width * 0.75; cy = height * 0.3; }
            else if (node.subject === 'maths') { cx = width * 0.5; cy = height * 0.8; }
            
            fx += (cx - node.x) * CENTER_GRAVITY;
            fy += (cy - node.y) * CENTER_GRAVITY;

            node.vx = (node.vx + fx) * DAMPING;
            node.vy = (node.vy + fy) * DAMPING;
            node.x += node.vx;
            node.y += node.vy;

            // Bounds
            const pad = 50;
            if (node.x < pad) node.x = pad;
            if (node.x > width - pad) node.x = width - pad;
            if (node.y < pad) node.y = pad;
            if (node.y > height - pad) node.y = height - pad;

            const vel = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            if (vel > maxVel) maxVel = vel;
        });

        if (maxVel < 0.1) setIsStable(true);

    }, [isStable]);

    useEffect(() => {
        const loop = () => {
            updatePhysics();
            draw();
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [updatePhysics, draw]);

    // Interaction Handlers (Wrapped in useCallback)
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedNode = nodesRef.current.find(n => {
            const dx = x - n.x;
            const dy = y - n.y;
            return dx*dx + dy*dy < n.radius*n.radius;
        });

        if (clickedNode) {
            clickedNode.isDragging = true;
            setIsStable(false);
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        nodesRef.current.forEach(n => {
            if (n.isDragging) {
                n.x = x;
                n.y = y;
                n.vx = 0; n.vy = 0;
            }
        });
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let clickedNode = null;
        nodesRef.current.forEach(n => {
            if (n.isDragging) {
                n.isDragging = false;
                clickedNode = n;
            } else {
                // Check for click without drag
                const dx = x - n.x;
                const dy = y - n.y;
                if (dx*dx + dy*dy < n.radius*n.radius) clickedNode = n;
            }
        });

        if (clickedNode) {
            onNodeClick(clickedNode.id);
        }
    }, [onNodeClick]);

    // Resize Handler
    useEffect(() => {
        const resize = () => {
            if (containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                setIsStable(false);
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-[600px] bg-slate-900/80 rounded-xl border border-slate-700 overflow-hidden relative shadow-inner">
            <div className="absolute top-4 left-4 pointer-events-none z-10 space-y-1">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></span> <span className="text-xs text-slate-300">Physics</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span> <span className="text-xs text-slate-300">Chemistry</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899]"></span> <span className="text-xs text-slate-300">Maths</span></div>
                <div className="flex items-center gap-2 mt-2"><span className="w-3 h-3 rounded-full bg-slate-700 border border-slate-500"></span> <span className="text-xs text-slate-400">Locked / Not Started</span></div>
                <div className="flex items-center gap-2"><span className="w-8 h-0 border-t-2 border-dashed border-red-500"></span> <span className="text-xs text-red-400">Bottleneck</span></div>
            </div>
            
            <div className="absolute top-4 right-4 pointer-events-none z-10 text-right">
                <h3 className="text-xl font-bold text-slate-200">Knowledge Network</h3>
                <p className="text-xs text-slate-400">Force-Directed Dependency Graph</p>
            </div>

            <canvas 
                ref={canvasRef}
                className="cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
        </div>
    );
});
