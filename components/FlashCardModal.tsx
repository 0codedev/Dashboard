
import React, { useState, useEffect, useRef } from 'react';
import { useJeeStore } from '../store/useJeeStore';
import { MarkdownRenderer } from './common/MarkdownRenderer';

interface FlashCardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FlashCardModal: React.FC<FlashCardModalProps> = ({ isOpen, onClose }) => {
    const { flashcardSession, rateCurrentCard, closeFlashcardSession } = useJeeStore();
    const [isFlipped, setIsFlipped] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const currentCard = flashcardSession.deck[flashcardSession.currentCardIndex];
    const isFinished = flashcardSession.currentCardIndex >= flashcardSession.deck.length;
    
    // Ensure we don't render if there's no deck, even if open (safety check)
    const hasDeck = flashcardSession.deck && flashcardSession.deck.length > 0;

    useEffect(() => {
        if (isOpen && cardRef.current) {
            cardRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || isFinished || !hasDeck) return;

            if (e.code === 'Space') {
                e.preventDefault();
                setIsFlipped(prev => !prev);
            } else if (isFlipped) {
                // Rate mapping: 1=Fail(1), 2=Hard(3), 3=Good(4), 4=Easy(5)
                if (e.key === '1') handleRate(1); // Again
                if (e.key === '2') handleRate(3); // Hard
                if (e.key === '3') handleRate(4); // Good
                if (e.key === '4') handleRate(5); // Easy
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFlipped, isFinished, hasDeck]);

    const handleRate = (quality: number) => {
        setIsFlipped(false);
        rateCurrentCard(quality);
    };

    const handleClose = () => {
        closeFlashcardSession();
        onClose();
    };

    if (!isOpen) return null;

    if (isFinished || !hasDeck) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
                <div className="bg-slate-900 border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center max-w-md w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 to-transparent pointer-events-none"></div>
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Session Complete</h2>
                    <p className="text-cyan-400 mb-6 font-mono text-sm">Neural Pathways Reinforced.</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-xs text-gray-400 uppercase">Mastery</p>
                            <p className="text-2xl font-bold text-white">{flashcardSession.masteredCards}/{flashcardSession.deck.length}</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-xs text-gray-400 uppercase">Max Streak</p>
                            <p className="text-2xl font-bold text-amber-400">{flashcardSession.streak}🔥</p>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
                    >
                        Sync & Return
                    </button>
                </div>
            </div>
        );
    }

    const progress = ((flashcardSession.currentCardIndex) / flashcardSession.deck.length) * 100;

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div className="h-full bg-cyan-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="text-xs font-mono text-cyan-400">{flashcardSession.currentCardIndex + 1} / {flashcardSession.deck.length}</span>
                </div>
                <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors text-2xl">×</button>
            </div>

            {/* 3D Card Container */}
            <div 
                className="relative w-full max-w-2xl aspect-[3/2] perspective-1000 cursor-pointer group"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div 
                    className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                >
                    {/* FRONT */}
                    <div className="absolute inset-0 backface-hidden bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col p-8 group-hover:shadow-cyan-500/20 transition-shadow">
                        <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-cyan-900/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider">
                                {currentCard.topic}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">Q.{flashcardSession.currentCardIndex + 1}</span>
                        </div>
                        
                        <div className="flex-grow flex items-center justify-center text-center">
                            <div className="prose prose-invert prose-lg max-w-none">
                                <MarkdownRenderer content={currentCard.front} baseTextSize="text-xl md:text-2xl" baseTextColor="text-white" />
                            </div>
                        </div>

                        <div className="mt-6 text-center text-xs text-slate-500 font-mono animate-pulse">
                            [SPACE] to Flip
                        </div>
                        
                        {/* Decorative Cyberpunk Elements */}
                        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-cyan-500/20 rounded-bl-2xl"></div>
                        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/20 rounded-tr-2xl"></div>
                    </div>

                    {/* BACK */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col p-8">
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col justify-center">
                            <h4 className="text-xs uppercase tracking-widest text-cyan-500 mb-4 font-bold border-b border-cyan-900/50 pb-2">
                                Solution Protocol
                            </h4>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <MarkdownRenderer content={currentCard.back} />
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="mt-8 grid grid-cols-4 gap-3">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRate(1); }}
                                className="py-3 rounded-lg bg-slate-800 border border-red-500/30 hover:bg-red-900/20 hover:border-red-500 text-red-300 font-bold text-xs transition-all hover:-translate-y-1"
                            >
                                <span className="block text-[10px] opacity-50 mb-1">[1]</span> Again
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRate(3); }}
                                className="py-3 rounded-lg bg-slate-800 border border-orange-500/30 hover:bg-orange-900/20 hover:border-orange-500 text-orange-300 font-bold text-xs transition-all hover:-translate-y-1"
                            >
                                <span className="block text-[10px] opacity-50 mb-1">[2]</span> Hard
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRate(4); }}
                                className="py-3 rounded-lg bg-slate-800 border border-blue-500/30 hover:bg-blue-900/20 hover:border-blue-500 text-blue-300 font-bold text-xs transition-all hover:-translate-y-1"
                            >
                                <span className="block text-[10px] opacity-50 mb-1">[3]</span> Good
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRate(5); }}
                                className="py-3 rounded-lg bg-slate-800 border border-green-500/30 hover:bg-green-900/20 hover:border-green-500 text-green-300 font-bold text-xs transition-all hover:-translate-y-1"
                            >
                                <span className="block text-[10px] opacity-50 mb-1">[4]</span> Easy
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
