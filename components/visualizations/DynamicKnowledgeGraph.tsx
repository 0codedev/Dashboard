
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QuestionLog, QuestionStatus } from '../../types';
import { JEE_SYLLABUS, TOPIC_DEPENDENCIES } from '../../constants';

interface Node {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    errorCount: number;
    radius: number;
    subject: string;
    isDragging: boolean;
}

interface Edge {
    source: string;
    target: string;
}

interface DynamicKnowledgeGraphProps {
    logs: QuestionLog[];
    onNodeClick: (topic: string) => void;
}

export const DynamicKnowledgeGraph: React.FC<DynamicKnowledgeGraphProps> = ({ logs, onNodeClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    
    const [interactionMode, setInteractionMode] = useState<'interact' | 'drilldown'>('interact');
    const [isStable, setIsStable] = useState(false); 

    // --- TUNED PHYSICS PARAMETERS (RELAXED) ---
    const REPULSION = 3500;      // Increased to push nodes apart
    const SPRING_LENGTH = 150;   // Longer springs
    const SPRING_STRENGTH = 0.005; // Looser springs for fluid movement
    const DAMPING = 0.6;         // Reduced damping for smoother drift
    const CLUSTER_GRAVITY = 0.003; // Very weak gravity to prevent clustering in center
    const STABILITY_THRESHOLD = 0.05; 

    // --- DISTINCT NEON COLORS ---
    const COLORS: Record<string, string> = {
        physics: '#06b6d4',   // Cyan 500
        chemistry: '#10b981', // Emerald 500
        maths: '#ec4899',     // Pink 500
        error: '#ef4444',     // Red 500
        neutral: '#64748b',   // Slate 500
    };

    const getAttractor = (subject: string, width: number, height: number) => {
        // Spread attractors slightly more towards edges
        switch (subject.toLowerCase()) {
            case 'physics': return { x: width * 0.2, y: height * 0.3 };
            case 'maths': return { x: width * 0.8, y: height * 0.3 };
            case 'chemistry': return { x: width * 0.5, y: height * 0.85 };
            default: return { x: width / 2, y: height / 2 };
        }
    };

    useEffect(() => {
        const errorCounts = new Map<string, number>();
        logs.forEach(log => {
            if (log.topic && log.topic !== "N/A" && (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect)) {
                errorCounts.set(log.topic, (errorCounts.get(log.topic) || 0) + 1);
            }
        });

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const addedTopics = new Set<string>();

        ['physics', 'chemistry', 'maths'].forEach((subject) => {
             // @ts-ignore
             JEE_SYLLABUS[subject].forEach(unit => {
                 unit.chapters.forEach((chapter: any) => {
                     if (!addedTopics.has(chapter.name)) {
                         const errorCount = errorCounts.get(chapter.name) || 0;
                         newNodes.push({
                             id: chapter.name,
                             x: Math.random() * 800,
                             y: Math.random() * 600,
                             vx: 0,
                             vy: 0,
                             errorCount,
                             radius: Math.max(25, Math.min(60, 25 + Math.sqrt(errorCount) * 10)),
                             subject,
                             isDragging: false
                         });
                         addedTopics.add(chapter.name);
                     }
                 });
             });
        });

        newNodes.forEach(node => {
            const prereqs = TOPIC_DEPENDENCIES[node.id] || [];
            prereqs.forEach(p => {
                if (addedTopics.has(p)) {
                    newEdges.push({ source: p, target: node.id });
                }
            });
        });

        const relevantTopics = new Set<string>();
        newNodes.forEach(n => { if (n.errorCount > 0) relevantTopics.add(n.id); });
        
        let changed = true;
        while(changed) {
            changed = false;
            newEdges.forEach(e => {
                if (relevantTopics.has(e.target) && !relevantTopics.has(e.source)) {
                    relevantTopics.add(e.source);
                    changed = true;
                }
            });
        }

        const filteredNodes = newNodes.filter(n => relevantTopics.has(n.id));
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = newEdges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

        const canvasWidth = containerRef.current?.clientWidth || 800;
        const canvasHeight = containerRef.current?.clientHeight || 600;
        
        filteredNodes.forEach(n => {
            const attractor = getAttractor(n.subject, canvasWidth, canvasHeight);
            n.x = attractor.x + (Math.random() - 0.5) * 300; // Wider spread
            n.y = attractor.y + (Math.random() - 0.5) * 300;
        });

        nodesRef.current = filteredNodes;
        edgesRef.current = filteredEdges;
        setIsStable(false); // Reset stability on data change

    }, [logs]);

    const drawNode = (ctx: CanvasRenderingContext2D, node: Node) => {
        const baseColor = node.errorCount > 0 ? COLORS.error : COLORS[node.subject] || COLORS.neutral;
        
        ctx.shadowBlur = node.errorCount > 0 ? 30 : 15;
        ctx.shadowColor = baseColor;
        
        const grad = ctx.createRadialGradient(node.x - node.radius * 0.3, node.y - node.radius * 0.3, node.radius * 0.1, node.x, node.y, node.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, baseColor);
        grad.addColorStop(1, '#0f172a');

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = `bold ${node.errorCount > 0 ? '12px' : '10px'} sans-serif`;
        const label = node.id;
        const textMetrics = ctx.measureText(label);
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; 
        ctx.beginPath();
        ctx.roundRect(node.x - textMetrics.width/2 - 4, node.y - 8, textMetrics.width + 8, 16, 4);
        ctx.fill();

        ctx.fillStyle = '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, node.x, node.y);

        if (node.errorCount > 0) {
            const badgeX = node.x + node.radius * 0.7;
            const badgeY = node.y - node.radius * 0.7;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ef4444';
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 10, 0, 2 * Math.PI);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(node.errorCount.toString(), badgeX, badgeY);
        }
    };

    const drawEdges = (ctx: CanvasRenderingContext2D) => {
         edgesRef.current.forEach(edge => {
            const source = nodesRef.current.find(n => n.id === edge.source);
            const target = nodesRef.current.find(n => n.id === edge.target);
            if (!source || !target) return;

            const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
            const colorSource = source.errorCount > 0 ? COLORS.error : COLORS[source.subject] || COLORS.neutral;
            const colorTarget = target.errorCount > 0 ? COLORS.error : COLORS[target.subject] || COLORS.neutral;
            
            grad.addColorStop(0, colorSource);
            grad.addColorStop(1, colorTarget);

            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = (source.errorCount > 0 && target.errorCount > 0) ? 0.6 : 0.15; 
            
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    const drawBackgroundLabels = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.save();
        ctx.font = 'bold 60px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.05;
        const p = getAttractor('physics', width, height);
        ctx.fillStyle = COLORS.physics;
        ctx.fillText("PHYSICS", p.x, p.y);
        const c = getAttractor('chemistry', width, height);
        ctx.fillStyle = COLORS.chemistry;
        ctx.fillText("CHEMISTRY", c.x, c.y);
        const m = getAttractor('maths', width, height);
        ctx.fillStyle = COLORS.maths;
        ctx.fillText("MATHS", m.x, m.y);
        ctx.restore();
    };

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        drawBackgroundLabels(ctx, width, height);
        drawEdges(ctx);

        // Physics Simulation
        if (interactionMode === 'interact' && !isStable) {
            let maxVelocity = 0;

            nodesRef.current.forEach(node => {
                if (node.isDragging) return;

                let fx = 0, fy = 0;

                // Repulsion (Long Range)
                nodesRef.current.forEach(other => {
                    if (node.id === other.id) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const distSq = dx * dx + dy * dy || 1;
                    // Increased repulsive range
                    if (distSq < 250000) { // 500px radius
                         const force = REPULSION / distSq;
                         fx += (dx / Math.sqrt(distSq)) * force;
                         fy += (dy / Math.sqrt(distSq)) * force;
                    }
                });

                // Attractor Gravity (Very Weak Center Pull)
                const attractor = getAttractor(node.subject, width, height);
                fx += (attractor.x - node.x) * CLUSTER_GRAVITY;
                fy += (attractor.y - node.y) * CLUSTER_GRAVITY;

                node.vx = (node.vx + fx) * DAMPING;
                node.vy = (node.vy + fy) * DAMPING;
                node.x += node.vx;
                node.y += node.vy;
                
                // Wall Bounds
                const padding = node.radius + 30;
                if (node.x < padding) { node.x = padding; node.vx *= -0.5; }
                if (node.x > width - padding) { node.x = width - padding; node.vx *= -0.5; }
                if (node.y < padding) { node.y = padding; node.vy *= -0.5; }
                if (node.y > height - padding) { node.y = height - padding; node.vy *= -0.5; }

                const velocity = Math.sqrt(node.vx*node.vx + node.vy*node.vy);
                if (velocity > maxVelocity) maxVelocity = velocity;
            });

            // Spring Forces (Pull connected nodes)
            edgesRef.current.forEach(edge => {
                const source = nodesRef.current.find(n => n.id === edge.source);
                const target = nodesRef.current.find(n => n.id === edge.target);
                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    if (!source.isDragging) { source.vx += fx; source.vy += fy; }
                    if (!target.isDragging) { target.vx -= fx; target.vy -= fy; }
                }
            });

            if (maxVelocity < STABILITY_THRESHOLD) {
                setIsStable(true);
            }
        }

        nodesRef.current.forEach(node => drawNode(ctx, node));
        requestRef.current = requestAnimationFrame(animate);
    }, [interactionMode, isStable]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [animate]);

    useEffect(() => {
        const resize = () => {
            if (containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                setIsStable(false); // Wake up on resize
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Interaction Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (interactionMode === 'drilldown') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const node = nodesRef.current[i];
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx*dx + dy*dy < node.radius * node.radius) {
                node.isDragging = true;
                setIsStable(false); // Wake up physics on interaction
                return;
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (interactionMode === 'drilldown') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        nodesRef.current.forEach(node => {
            if (node.isDragging) {
                node.x = e.clientX - rect.left;
                node.y = e.clientY - rect.top;
                node.vx = 0; node.vy = 0;
            }
        });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let clickedNode = null;

        nodesRef.current.forEach(node => {
            if (node.isDragging) node.isDragging = false;
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx*dx + dy*dy < node.radius * node.radius) clickedNode = node;
        });

        if (interactionMode === 'drilldown' && clickedNode) {
            onNodeClick(clickedNode.id);
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-[#0f172a] rounded-lg overflow-hidden relative border border-slate-700 shadow-inner">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
             <div className="absolute top-2 left-2 text-xs text-slate-400 pointer-events-none z-10 bg-slate-900/80 p-1 rounded border border-slate-700">
                {interactionMode === 'interact' ? 'Drag nodes to wake up simulation.' : 'Click nodes to view details.'}
                {isStable && interactionMode === 'interact' && <span className="text-green-400 ml-2">● Stable</span>}
            </div>
            <div className="absolute top-2 right-2 z-10 flex bg-slate-800 rounded-lg p-1 border border-slate-600 shadow-lg">
                <button onClick={() => setInteractionMode('interact')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${interactionMode === 'interact' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>✋ Interact</button>
                <button onClick={() => setInteractionMode('drilldown')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${interactionMode === 'drilldown' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>🔍 Drill Down</button>
            </div>
            <canvas ref={canvasRef} className={`block w-full h-full relative z-0 ${interactionMode === 'interact' ? 'cursor-move' : 'cursor-pointer'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
        </div>
    );
};
