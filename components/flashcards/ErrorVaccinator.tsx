
import React, { useState, useEffect } from 'react';
import { QuestionLog, Flashcard, QuestionStatus } from '../../types';
import { Button } from '../common/Button';
import { useJeeStore } from '../../store/useJeeStore';

interface ErrorVaccinatorProps {
    logs: QuestionLog[];
    apiKey: string;
    modelName?: string; // Kept for compatibility if needed later, though Syllabus generates cards mostly now
}

export const ErrorVaccinator: React.FC<ErrorVaccinatorProps> = ({ logs }) => {
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const { startFlashcardSession, isFlashcardModalOpen, getSessionResults } = useJeeStore();
    
    // Stats
    const [stats, setStats] = useState({ total: 0, due: 0, new: 0, mastered: 0 });

    // Load & Hydrate Data
    useEffect(() => {
        const loadCards = () => {
            // 1. Load existing
            const storedCardsStr = localStorage.getItem('errorFlashcards_v1');
            let allCards: Flashcard[] = storedCardsStr ? JSON.parse(storedCardsStr) : [];
            
            // 2. Hydrate from logs (Auto-generate "stub" cards from new errors)
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
                    // Simple default front/back for auto-generated cards. 
                    // ideally user should "Generate" these via AI in the Syllabus or Review mode.
                    front: `**Topic:** ${e.topic}\n\n**Error:** ${e.reasonForError || 'Incorrect Answer'}\n\n*Review your mistake in Test: ${e.testId}*`,
                    back: `**Solution Needed:**\n\nYou haven't generated a specific vaccine for this error yet. Go to the Syllabus tab or use the 'Generate' button to create a specific conceptual flashcard.`, 
                    nextReview: new Date().toISOString(),
                    interval: 0,
                    easeFactor: 2.5,
                    reviews: 0
                }));
                allCards = [...allCards, ...newCards];
                localStorage.setItem('errorFlashcards_v1', JSON.stringify(allCards));
            }

            setFlashcards(allCards);
            
            // 3. Calc Stats
            const now = new Date();
            const due = allCards.filter(c => new Date(c.nextReview) <= now).length;
            const mastered = allCards.filter(c => c.interval > 21).length;
            const newCount = allCards.filter(c => c.reviews === 0).length;
            
            setStats({ total: allCards.length, due, new: newCount, mastered });
        };
        
        loadCards();
    }, [logs, isFlashcardModalOpen]); // Reload when modal closes to reflect updates

    // Sync Logic: When modal closes, we must save the updated deck state back to LocalStorage
    useEffect(() => {
        if (!isFlashcardModalOpen && flashcards.length > 0) {
            // Check if we have a session result pending in the store
            const sessionDeck = getSessionResults();
            if (sessionDeck.length > 0) {
                // Merge session deck results back into main deck
                const updatedMainDeck = flashcards.map(card => {
                    const sessionCard = sessionDeck.find(sc => sc.id === card.id);
                    return sessionCard || card;
                });
                
                // Only save if there's an actual change (optimization check omitted for brevity, just save)
                localStorage.setItem('errorFlashcards_v1', JSON.stringify(updatedMainDeck));
                setFlashcards(updatedMainDeck);
            }
        }
    }, [isFlashcardModalOpen]);

    const startSession = () => {
        const now = new Date();
        // Priority: Due date ascending (overdue first)
        const dueCards = flashcards
            .filter(c => new Date(c.nextReview) <= now)
            .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime())
            .slice(0, 20); // Cap session size for focus

        if (dueCards.length === 0) {
            alert("No cards due for review! Great job.");
            return;
        }

        // Bridge to the global store -> This opens the 3D Modal
        startFlashcardSession(dueCards);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.1)_0%,_transparent_70%)] pointer-events-none"></div>
            
            <div className="text-center z-10 space-y-6 max-w-2xl w-full">
                <div className="w-24 h-24 mx-auto bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-2xl relative group">
                    <span className="text-5xl group-hover:scale-110 transition-transform cursor-default">🛡️</span>
                    {stats.due > 0 && <span className="absolute top-0 right-0 w-6 h-6 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                </div>
                
                <div>
                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Error Vaccinator</h2>
                    <p className="text-gray-400">Convert your mistakes into permanent immunity using AI-powered spaced repetition.</p>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Errors</p>
                        <p className="text-2xl font-bold text-white">{stats.total}</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Due Now</p>
                        <p className="text-2xl font-bold text-green-400">{stats.due}</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Mastered</p>
                        <p className="text-2xl font-bold text-blue-400">{stats.mastered}</p>
                    </div>
                </div>

                <Button 
                    onClick={startSession} 
                    disabled={stats.due === 0}
                    className={`w-full py-4 text-lg font-bold shadow-xl transition-transform hover:scale-[1.02] ${stats.due === 0 ? 'opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white'}`}
                >
                    {stats.due > 0 ? `Review ${Math.min(20, stats.due)} Cards` : "All Caught Up!"}
                </Button>
            </div>
        </div>
    );
};
