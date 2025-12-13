
import { create } from 'zustand';
import { 
    FlashcardSession,
    Flashcard
} from '../types';

// SM-2 Algorithm Implementation
const calculateNextReview = (card: Flashcard, quality: number) => {
    // Quality: 0-5 (0=Fail, 3=Hard, 4=Good, 5=Easy)
    // We map UI ratings (Fail/Hard/Good/Easy) to Quality numbers in the component
    
    let interval = card.interval;
    let easeFactor = card.easeFactor;
    let reviews = card.reviews;

    if (quality < 3) {
        reviews = 0;
        interval = 1; // Reset to 1 day
        easeFactor = Math.max(1.3, easeFactor - 0.2); // Penalty
    } else {
        reviews += 1;
        if (interval === 0) interval = 1;
        else if (interval === 1) interval = 3;
        else interval = Math.round(interval * easeFactor);

        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) easeFactor = 1.3;
    }
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
        ...card,
        interval,
        easeFactor,
        reviews,
        nextReview: nextReviewDate.toISOString()
    };
};

interface JeeState {
    // Session State only. Persistent data lives in IndexedDB/LocalStorage via useJeeData
    flashcardSession: FlashcardSession;
    isFlashcardModalOpen: boolean;
}

interface JeeActions {
    // Flashcard Actions
    startFlashcardSession: (cards: Flashcard[]) => void;
    rateCurrentCard: (quality: number) => void; // 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    closeFlashcardSession: () => void;
    
    // Utilities to sync back to storage
    getSessionResults: () => Flashcard[]; 
}

const initialFlashcardSession: FlashcardSession = {
    currentCardIndex: 0,
    streak: 0,
    masteredCards: 0,
    deck: [],
    startTime: 0
};

export const useJeeStore = create<JeeState & JeeActions>((set, get) => ({
    // Initial State
    flashcardSession: initialFlashcardSession,
    isFlashcardModalOpen: false,

    // Actions
    startFlashcardSession: (cards) => set({
        flashcardSession: {
            currentCardIndex: 0,
            streak: 0,
            masteredCards: 0,
            deck: cards,
            startTime: Date.now()
        },
        isFlashcardModalOpen: true
    }),

    rateCurrentCard: (quality) => set((state) => {
        const session = state.flashcardSession;
        const currentCard = session.deck[session.currentCardIndex];
        
        if (!currentCard) return state;

        // Apply SM-2 Logic
        const updatedCard = calculateNextReview(currentCard, quality);
        
        // Update Deck
        const newDeck = [...session.deck];
        newDeck[session.currentCardIndex] = updatedCard;

        const isCorrect = quality >= 3;

        return {
            flashcardSession: {
                ...session,
                deck: newDeck,
                currentCardIndex: session.currentCardIndex + 1,
                streak: isCorrect ? session.streak + 1 : 0,
                masteredCards: isCorrect ? session.masteredCards + 1 : session.masteredCards
            }
        };
    }),

    closeFlashcardSession: () => set({ 
        isFlashcardModalOpen: false,
        // We do NOT clear session immediately, allowing the caller to read the final state for persistence
    }),

    getSessionResults: () => {
        return get().flashcardSession.deck;
    }
}));
