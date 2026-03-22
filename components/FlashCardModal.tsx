
import React, { useState, useEffect, useRef } from 'react';
import { useJeeStore } from '../store/useJeeStore';
import { MarkdownRenderer } from './common/MarkdownRenderer';
import { ErrorReason } from '../types';
import { playTTS, stopTTS } from '../services/audioEngine';

interface FlashCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
}

export const FlashCardModal: React.FC<FlashCardModalProps> = ({ isOpen, onClose, apiKey }) => {
    const { flashcardSession, rateCurrentCard, closeFlashcardSession } = useJeeStore();
    const [isFlipped, setIsFlipped] = useState(false);
    
    // New States for Reconstruction
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [showMutation, setShowMutation] = useState(false);
    const [revealMutationAnswer, setRevealMutationAnswer] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const cardRef = useRef<HTMLDivElement>(null);

    const currentCard = flashcardSession.deck[flashcardSession.currentCardIndex];
    const isFinished = flashcardSession.currentCardIndex >= flashcardSession.deck.length;
    const hasDeck = flashcardSession.deck && flashcardSession.deck.length > 0;

    // Cleanup audio context on unmount
    useEffect(() => {
        return () => {
            stopTTS();
        };
    }, []);

    useEffect(() => {
        if (isOpen && cardRef.current) {
            cardRef.current.focus();
        }
        // Reset local state on new card
        if (!isFinished) {
            setIsFlipped(false);
            setDiagnosis(null);
            setShowMutation(false);
            setRevealMutationAnswer(false);
            stopTTS();
        }
    }, [isOpen, flashcardSession.currentCardIndex, isFinished]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || isFinished || !hasDeck) return;

            if (e.code === 'Space') {
                e.preventDefault();
                setIsFlipped(prev => !prev);
            } else if (isFlipped) {
                if (e.key === '1') handleRate(1); 
                if (e.key === '2') handleRate(3); 
                if (e.key === '3') handleRate(4); 
                if (e.key === '4') handleRate(5); 
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFlipped, isFinished, hasDeck]);

    const handleRate = (quality: number) => {
        rateCurrentCard(quality);
    };

    const handleClose = () => {
        closeFlashcardSession();
        onClose();
    };

    const handleDiagnosis = (reason: string) => {
        setDiagnosis(reason);
        setIsFlipped(true);
    };

    const handlePlayAudio = async (text: string) => {
        if (!text || isAudioLoading) return;
        
        setIsAudioLoading(true);
        try {
            await playTTS(text, apiKey);
        } catch (e) {
            console.error(e);
            alert("Failed to play audio.");
        } finally {
            setIsAudioLoading(false);
        }
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
                        <div className="glass-panel p-4 rounded-2xl">
                            <p className="text-xs text-gray-400 uppercase">Mastery</p>
                            <p className="text-2xl font-bold text-white">{flashcardSession.masteredCards}/{flashcardSession.deck.length}</p>
                        </div>
                        <div className="glass-panel p-4 rounded-2xl">
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
    
    // Symptom Checker Options
    const diagnosisOptions = [
        { label: 'Recall', icon: '🧠', color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
        { label: 'Concept', icon: '💡', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
        { label: 'Calculation', icon: '🔢', color: 'bg-red-500/20 text-red-300 border-red-500/50' },
        { label: 'Panic/Rush', icon: '😰', color: 'bg-purple-500/20 text-purple-300 border-purple-500/50' },
    ];

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
                className="relative w-full max-w-3xl h-[75vh] min-h-[600px] max-h-[800px] [perspective:1000px] group"
            >
                <div 
                    className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                >
                    {/* FRONT (Question) */}
                    <div className="absolute inset-0 [backface-visibility:hidden] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col p-8 group-hover:shadow-cyan-500/20 transition-shadow">
                        <div className="flex justify-between items-start mb-6 shrink-0">
                            <span className="px-3 py-1 bg-cyan-900/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold rounded-full uppercase tracking-wider">
                                {currentCard.topic}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">Q.{flashcardSession.currentCardIndex + 1}</span>
                        </div>
                        
                        {/* Scrollable Content Area */}
                        <div className="flex-grow flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar p-2">
                            <div className="prose prose-invert prose-lg max-w-none w-full">
                                <MarkdownRenderer content={currentCard.front} baseTextSize="text-xl md:text-2xl" baseTextColor="text-white" />
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePlayAudio(currentCard.front); }} 
                                disabled={isAudioLoading}
                                className="mt-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold py-1.5 px-3 rounded-full transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAudioLoading ? <span className="animate-pulse">Generating...</span> : <span>🔊 Read Aloud</span>}
                            </button>
                        </div>

                        {/* Symptom Checker (Active Diagnosis) */}
                        <div className="mt-8 shrink-0">
                            <p className="text-center text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">Symptom Checker: Why did you miss this?</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {diagnosisOptions.map(opt => (
                                    <button 
                                        key={opt.label}
                                        onClick={() => handleDiagnosis(opt.label)}
                                        className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105 ${opt.color} hover:bg-opacity-30`}
                                    >
                                        <span className="text-xl">{opt.icon}</span>
                                        <span className="text-xs font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Decorative Elements */}
                        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-cyan-500/20 rounded-bl-2xl pointer-events-none"></div>
                        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/20 rounded-tr-2xl pointer-events-none"></div>
                    </div>

                    {/* BACK (Answer) */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col p-8 overflow-hidden">
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">
                            {/* Solution Section */}
                            <div>
                                <div className="flex justify-between items-center border-b border-cyan-900/50 pb-2 mb-2 shrink-0">
                                    <h4 className="text-xs uppercase tracking-widest text-cyan-500 font-bold">
                                        Solution Protocol
                                    </h4>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handlePlayAudio(currentCard.back); }} 
                                        disabled={isAudioLoading}
                                        className="bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold py-1 px-2 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isAudioLoading ? <span className="animate-pulse">...</span> : <span>🔊</span>}
                                    </button>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none w-full text-left">
                                    <MarkdownRenderer content={currentCard.back} />
                                </div>
                            </div>

                             {/* Feature E: Multimodal Vaccine (SVG Diagram) */}
                             {currentCard.visual_aid && (
                                <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Visual Aid</h4>
                                    <div 
                                        className="w-full flex justify-center overflow-hidden rounded-lg bg-white p-2"
                                        dangerouslySetInnerHTML={{ __html: currentCard.visual_aid.svg }}
                                    />
                                    <p className="text-xs text-gray-400 mt-2 text-center italic">{currentCard.visual_aid.description}</p>
                                </div>
                            )}

                            {/* Active Reconstruction: Viral Mutation */}
                            {currentCard.mutation && (
                                <div className="mt-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 animate-fade-in">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                                            <span>🧬</span> Viral Mutation Detected
                                        </h4>
                                        {!showMutation && (
                                            <button 
                                                onClick={() => setShowMutation(true)}
                                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full shadow transition-transform hover:scale-105"
                                            >
                                                Test Immunity
                                            </button>
                                        )}
                                    </div>
                                    
                                    {showMutation && (
                                        <div className="animate-scale-in">
                                            <p className="text-sm text-gray-200 mb-4 font-medium italic">
                                                "{currentCard.mutation.question}"
                                            </p>
                                            
                                            {currentCard.mutation.options && (
                                                <div className="grid grid-cols-2 gap-2 mb-4">
                                                    {Object.entries(currentCard.mutation.options).map(([key, val]) => (
                                                        <div key={key} className="text-xs p-2 rounded bg-slate-800 border border-slate-700 text-gray-300">
                                                            <strong className="text-indigo-400">{key})</strong> {val}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!revealMutationAnswer ? (
                                                <button 
                                                    onClick={() => setRevealMutationAnswer(true)}
                                                    className="w-full py-2 border border-dashed border-indigo-500/50 text-indigo-400 text-xs rounded hover:bg-indigo-900/30 transition-colors"
                                                >
                                                    Reveal Answer
                                                </button>
                                            ) : (
                                                <div className="bg-green-900/20 p-2 rounded border border-green-500/30 text-green-300 text-sm font-bold text-center animate-fade-in">
                                                    ✅ {currentCard.mutation.answer}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-4 gap-3 shrink-0">
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
