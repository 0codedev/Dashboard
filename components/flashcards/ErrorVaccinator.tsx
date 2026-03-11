
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QuestionLog, Flashcard, QuestionStatus, TestReport } from '../../types';
import { Button } from '../common/Button';
import { useJeeStore } from '../../store/useJeeStore';
import { generateCardSolution } from '../../services/geminiService';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { FlashCardModal } from '../FlashCardModal';
import { SUBJECT_COLORS } from '../../constants';
import { exportFlashcardsToAnkiCsv } from '../../services/sheetParser';

interface ErrorVaccinatorProps {
    logs: QuestionLog[];
    reports?: TestReport[]; 
    apiKey: string;
}

// --- 1. VISUALIZATION COMPONENT: Viral Load Monitor ---
const ViralLoadMonitor: React.FC<{ logs: QuestionLog[] }> = ({ logs }) => {
    const stats = useMemo(() => {
        const counts = { physics: 0, chemistry: 0, maths: 0 };
        let total = 0;
        logs.forEach(l => {
            if (l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect) {
                if (l.subject && counts[l.subject] !== undefined) {
                    counts[l.subject]++;
                    total++;
                }
            }
        });
        return { counts, total };
    }, [logs]);

    const getLevelHeight = (count: number) => Math.min(100, (count / 15) * 100); // Cap at 15 errors for visual fullness
    const getColor = (count: number) => count > 10 ? '#ef4444' : count > 5 ? '#f59e0b' : '#10b981';

    return (
        <div className="flex gap-4 p-4 bg-black/40 rounded-xl border border-slate-700/50 shadow-inner">
            {(['physics', 'chemistry', 'maths'] as const).map(subject => (
                <div key={subject} className="flex flex-col items-center gap-2 group">
                    <div className="relative w-10 h-24 bg-slate-800/50 rounded-full border border-slate-600 overflow-hidden">
                        {/* Liquid Level */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out opacity-80 group-hover:opacity-100"
                            style={{ 
                                height: `${getLevelHeight(stats.counts[subject])}%`, 
                                backgroundColor: getColor(stats.counts[subject]),
                                boxShadow: `0 0 15px ${getColor(stats.counts[subject])}`
                            }}
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"></div>
                        </div>
                        
                        {/* Grid Overlay */}
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-30 pointer-events-none">
                            {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-slate-400"></div>)}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{subject.slice(0,3)}</div>
                        <div className="text-xs font-mono text-white">{stats.counts[subject]}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 2. VISUALIZATION COMPONENT: Holographic Card ---
const HolographicCard: React.FC<{ 
    card: Flashcard; 
    metadata: { testName: string, testDate: string, qNum?: string }; 
    onSynthesize: (id: string) => void; 
    isSynthesizing: boolean; 
}> = ({ card, metadata, onSynthesize, isSynthesizing }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotate, setRotate] = useState({ x: 0, y: 0 });
    const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

    const isStub = card.back === '__STUB__' || card.back.includes("Solution Needed");
    const borderColor = isStub ? 'border-red-500/30' : 'border-cyan-500/30';
    const glowColor = isStub ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 211, 238, 0.15)';

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5; // Max 5 deg tilt
        const rotateY = ((x - centerX) / centerX) * 5;

        setRotate({ x: rotateX, y: rotateY });
        setGlowPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
    };

    const handleMouseLeave = () => {
        setRotate({ x: 0, y: 0 });
    };

    return (
        <div 
            className="perspective-1000 h-[320px] w-full" 
            onMouseMove={handleMouseMove} 
            onMouseLeave={handleMouseLeave}
        >
            <div 
                ref={cardRef}
                className={`relative h-full w-full rounded-xl border transition-all duration-100 ease-out shadow-2xl overflow-hidden flex flex-col ${borderColor} bg-slate-900/40 backdrop-blur-md`}
                style={{
                    transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1, 1, 1)`,
                    background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}, transparent 80%)`
                }}
            >
                {/* Scanner Effect Overlay */}
                {isSynthesizing && (
                    <div className="absolute inset-0 z-50 pointer-events-none">
                        <div className="w-full h-2 bg-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.8)] absolute top-0 animate-[scan_2s_linear_infinite]"></div>
                        <div className="absolute inset-0 bg-cyan-900/10 animate-pulse"></div>
                    </div>
                )}

                {/* Header */}
                <div className={`px-4 py-3 flex justify-between items-center border-b ${isStub ? 'border-red-500/20 bg-red-950/30' : 'border-cyan-500/20 bg-cyan-950/30'}`}>
                    <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${isStub ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`}></div>
                         <span className={`text-[10px] uppercase font-bold tracking-widest ${isStub ? 'text-red-400' : 'text-cyan-400'}`}>
                             {isStub ? 'CONTAMINATED' : 'SECURE'}
                         </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">ID: {card.id.slice(-6)}</span>
                </div>

                {/* Content */}
                <div className="flex-grow p-4 relative overflow-hidden group">
                     {/* Metadata */}
                     <div className="flex justify-between text-[10px] text-slate-500 mb-3 font-mono border-b border-white/5 pb-2">
                        <span className="truncate max-w-[120px]" title={metadata.testName}>{metadata.testName}</span>
                        <span>{metadata.qNum ? `Q.${metadata.qNum}` : ''}</span>
                    </div>

                    <div className="relative z-10 h-32 overflow-y-auto custom-scrollbar">
                        <h4 className="text-xs font-bold text-slate-300 mb-1">{card.topic}</h4>
                        <div className="prose prose-invert prose-xs">
                             <MarkdownRenderer 
                                content={isStub ? card.front : card.back} 
                                baseTextColor="text-slate-400" 
                                baseTextSize="text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 border-t border-white/5 bg-black/20 mt-auto relative z-20">
                    {isStub ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSynthesize(card.id); }}
                            disabled={isSynthesizing}
                            className="w-full py-2.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] transition-all flex items-center justify-center gap-2"
                        >
                            {isSynthesizing ? (
                                <><span className="animate-spin">⟳</span> Purging...</>
                            ) : (
                                <>☣ Synthesize Vaccine</>
                            )}
                        </button>
                    ) : (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-cyan-400 font-medium flex items-center gap-1">
                                <span className="text-lg">🛡️</span> Immunity Active
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                                R:{card.reviews} | EF:{card.easeFactor.toFixed(1)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ErrorVaccinator: React.FC<ErrorVaccinatorProps> = ({ logs, reports, apiKey }) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const { startFlashcardSession, isFlashcardModalOpen, closeFlashcardSession } = useJeeStore();
    const [isSynthesizing, setIsSynthesizing] = useState<string | null>(null); 
    const [filterMode, setFilterMode] = useState<'all' | 'due' | 'pathogens'>('pathogens');

    // 1. Load & Hydrate Data
    useEffect(() => {
        const loadCards = () => {
            const storedCardsStr = localStorage.getItem('errorFlashcards_v1');
            let allCards: Flashcard[] = storedCardsStr ? JSON.parse(storedCardsStr) : [];
            
            // Auto-generate "stub" cards from new errors
            const existingIds = new Set(allCards.map(c => c.id));
            const errorLogs = logs.filter(l => 
                (l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect) && 
                l.topic && l.topic !== 'N/A' && 
                !existingIds.has(`${l.testId}-${l.questionNumber}`)
            );

            if (errorLogs.length > 0) {
                const newCards: Flashcard[] = errorLogs.map(e => ({
                    id: `${e.testId}-${e.questionNumber}`,
                    topic: e.topic,
                    front: `**Error Analysis:**\n${e.reasonForError || 'Incorrect Answer'}\n\n**Context:**\n${e.questionType}`, 
                    back: `__STUB__`, 
                    nextReview: new Date().toISOString(),
                    interval: 0,
                    easeFactor: 2.5,
                    reviews: 0
                }));
                allCards = [...allCards, ...newCards];
                localStorage.setItem('errorFlashcards_v1', JSON.stringify(allCards));
            }
            setFlashcards(allCards);
        };
        loadCards();
    }, [logs, isFlashcardModalOpen]);

    // 2. Statistics
    const stats = useMemo(() => {
        const now = new Date();
        const due = flashcards.filter(c => new Date(c.nextReview) <= now && c.back !== '__STUB__').length;
        const pathogens = flashcards.filter(c => c.back === '__STUB__' || c.back.includes("Solution Needed")).length;
        return { total: flashcards.length, due, pathogens };
    }, [flashcards]);

    // 3. Synthesis Logic
    const handleSynthesize = async (cardId: string) => {
        const card = flashcards.find(c => c.id === cardId);
        if (!card || !apiKey) return;

        setIsSynthesizing(cardId);
        try {
            const logParts = card.id.split('-'); 
            const qNumStr = logParts.pop();
            const tId = logParts.join('-');
            const originalLog = logs.find(l => l.testId === tId && l.questionNumber === Number(qNumStr));
            
            const contextPrompt = originalLog 
                ? `Topic: ${originalLog.topic}. Error Reason: ${originalLog.reasonForError}. Question Type: ${originalLog.questionType}.` 
                : card.front;

            const response = await generateCardSolution({ topic: card.topic, front: contextPrompt }, apiKey);
            
            // Simulate scanning delay for effect
            await new Promise(r => setTimeout(r, 1500));

            const updatedCards = flashcards.map(c => 
                c.id === cardId ? { 
                    ...c, 
                    back: response.solution, 
                    mutation: response.mutation,
                    visual_aid: response.visual_aid
                } : c
            );
            
            setFlashcards(updatedCards);
            localStorage.setItem('errorFlashcards_v1', JSON.stringify(updatedCards));
        } catch (e) {
            console.error("Synthesis failed", e);
            alert("Failed to synthesize vaccine. Check connection.");
        } finally {
            setIsSynthesizing(null);
        }
    };

    const handleSynthesizeAll = async () => {
        const pathogens = flashcards.filter(c => c.back === '__STUB__' || c.back.includes("Solution Needed"));
        if(pathogens.length === 0) return;
        for (const p of pathogens) { await handleSynthesize(p.id); }
    };

    const startSession = () => {
        const now = new Date();
        const dueCards = flashcards
            .filter(c => new Date(c.nextReview) <= now && c.back !== '__STUB__' && !c.back.includes("Solution Needed"))
            .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime())
            .slice(0, 20);

        if (dueCards.length === 0) {
            alert("No vaccinated cards due for review! Synthesize more pathogens first.");
            return;
        }
        startFlashcardSession(dueCards);
    };
    
    const handleExportAnki = () => {
        const vaccinatedCards = flashcards.filter(c => c.back !== '__STUB__' && !c.back.includes("Solution Needed"));
        if (vaccinatedCards.length === 0) {
            alert("No vaccinated cards to export.");
            return;
        }
        exportFlashcardsToAnkiCsv(vaccinatedCards);
    };


    const displayCards = useMemo(() => {
        if (filterMode === 'pathogens') return flashcards.filter(c => c.back === '__STUB__' || c.back.includes("Solution Needed"));
        if (filterMode === 'due') {
            const now = new Date();
            return flashcards.filter(c => new Date(c.nextReview) <= now && c.back !== '__STUB__' && !c.back.includes("Solution Needed"));
        }
        return flashcards;
    }, [flashcards, filterMode]);

    const getCardMetadata = (cardId: string) => {
        const parts = cardId.split('-');
        const qNum = parts.pop();
        const testId = parts.join('-');
        const report = reports?.find(r => r.id === testId);
        return { 
            testName: report ? report.testName : testId, 
            testDate: report ? report.testDate : 'Unknown', 
            qNum 
        };
    };

    return (
        <div className="flex flex-col h-full space-y-6 pb-20">
            <style>{`
                @keyframes scan {
                    0% { top: -10%; opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { top: 110%; opacity: 0; }
                }
            `}</style>

            {/* Header / Control Panel */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10 mb-4 md:mb-0">
                    <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                        <span className="text-red-500 animate-pulse">☣</span> 
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-200 to-red-500">LABORATORY</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-[0.2em]">Error Isolation & Vaccine Synthesis</p>
                </div>
                
                <div className="relative z-10 flex items-center gap-6">
                    <ViralLoadMonitor logs={logs} />
                    <div className="h-12 w-px bg-slate-700"></div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-cyan-400 tabular-nums">{stats.due}</div>
                        <div className="text-[10px] text-cyan-300/50 uppercase tracking-widest">Vaccines Ready</div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Actions */}
            <div className="flex justify-between items-end border-b border-slate-700/50 pb-2">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setFilterMode('pathogens')}
                        className={`px-6 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-all border-t border-x border-b-0 ${filterMode === 'pathogens' ? 'bg-red-950/30 text-red-400 border-red-500/30 shadow-[0_-5px_15px_rgba(220,38,38,0.1)]' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Infected Samples ({stats.pathogens})
                    </button>
                    <button 
                        onClick={() => setFilterMode('due')}
                        className={`px-6 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-all border-t border-x border-b-0 ${filterMode === 'due' ? 'bg-cyan-950/30 text-cyan-400 border-cyan-500/30 shadow-[0_-5px_15px_rgba(34,211,238,0.1)]' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Active Immunity ({stats.due})
                    </button>
                </div>

                <div className="flex gap-3">
                    <Button onClick={handleExportAnki} variant="secondary" size="sm" className="border-slate-600 hover:border-blue-500 text-[10px] uppercase tracking-wider">
                        ⬆ Export Anki
                    </Button>
                    {filterMode === 'pathogens' && stats.pathogens > 0 && (
                        <Button onClick={handleSynthesizeAll} disabled={!!isSynthesizing} size="sm" className="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20 border-0 uppercase tracking-wider text-[10px]">
                            {isSynthesizing ? 'Running Protocols...' : '⚡ Mass Synthesis'}
                        </Button>
                    )}
                    {filterMode === 'due' && stats.due > 0 && (
                        <Button onClick={startSession} size="sm" className="bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 border-0 uppercase tracking-wider text-[10px]">
                            ▶ Initiate Review
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pb-10">
                {displayCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                        <span className="text-5xl mb-4 opacity-20">🧬</span>
                        <p className="text-sm font-mono uppercase tracking-widest opacity-50">Sector Clear. No samples found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2">
                        {displayCards.map(card => (
                            <HolographicCard 
                                key={card.id}
                                card={card}
                                metadata={getCardMetadata(card.id)}
                                onSynthesize={handleSynthesize}
                                isSynthesizing={isSynthesizing === card.id}
                            />
                        ))}
                    </div>
                )}
            </div>

            <FlashCardModal 
                isOpen={isFlashcardModalOpen} 
                onClose={closeFlashcardSession} 
            />
        </div>
    );
};
