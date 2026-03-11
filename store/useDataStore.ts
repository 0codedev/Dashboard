import { create } from 'zustand';
import { 
    TestReport,
    QuestionLog,
    StudyGoal,
    LongTermGoal,
    DailyTask,
    FlashcardSession,
    Flashcard
} from '../types';
import { dbService } from '../services/dbService';

interface DataState {
    testReports: TestReport[];
    questionLogs: QuestionLog[];
    studyGoals: StudyGoal[];
    longTermGoals: LongTermGoal[];
    dailyTasks: DailyTask[];
    flashcardSession: FlashcardSession;
}

interface DataActions {
    addTestReport: (report: TestReport, logs: QuestionLog[]) => void;
    setTestReports: (reports: TestReport[] | ((prev: TestReport[]) => TestReport[])) => void;
    setQuestionLogs: (logs: QuestionLog[] | ((prev: QuestionLog[]) => QuestionLog[])) => void;
    setDailyTasks: (tasks: DailyTask[] | ((prev: DailyTask[]) => DailyTask[])) => void;
    setStudyGoals: (goals: StudyGoal[] | ((prev: StudyGoal[]) => StudyGoal[])) => void;
    setLongTermGoals: (goals: LongTermGoal[] | ((prev: LongTermGoal[]) => LongTermGoal[])) => void;
    clearReportsAndLogs: () => Promise<void>;
    
    startFlashcardSession: (cards: Flashcard[]) => void;
    rateCurrentCard: (quality: number) => void;
    getSessionResults: () => Flashcard[];
    
    hydrateData: (data: Partial<DataState>) => void;
}

const initialFlashcardSession: FlashcardSession = {
    currentCardIndex: 0,
    streak: 0,
    masteredCards: 0,
    deck: [],
    startTime: 0
};

// --- SM-2 Logic ---
const calculateNextReview = (card: Flashcard, quality: number) => {
    let interval = card.interval;
    let easeFactor = card.easeFactor;
    let reviews = card.reviews;

    if (quality < 3) {
        reviews = 0;
        interval = 1; 
        easeFactor = Math.max(1.3, easeFactor - 0.2); 
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

export const useDataStore = create<DataState & DataActions>((set, get) => ({
    testReports: [],
    questionLogs: [],
    studyGoals: [],
    longTermGoals: [],
    dailyTasks: [],
    flashcardSession: initialFlashcardSession,

    addTestReport: (report, logs) => {
        set(state => {
            const newReports = [...state.testReports, report];
            const newLogs = [...state.questionLogs, ...logs];
            
            dbService.put('testReports', report);
            dbService.putBulk('questionLogs', logs);
            
            return { testReports: newReports, questionLogs: newLogs };
        });
    },

    setTestReports: (reportsOrFn) => {
        set(state => {
            const newReports = typeof reportsOrFn === 'function' ? reportsOrFn(state.testReports) : reportsOrFn;
            dbService.syncStore('testReports', newReports);
            return { testReports: newReports };
        });
    },

    setQuestionLogs: (logsOrFn) => {
        set(state => {
            const newLogs = typeof logsOrFn === 'function' ? logsOrFn(state.questionLogs) : logsOrFn;
            dbService.syncStore('questionLogs', newLogs);
            return { questionLogs: newLogs };
        });
    },

    setDailyTasks: (tasksOrFn) => {
        set(state => {
            const newTasks = typeof tasksOrFn === 'function' ? tasksOrFn(state.dailyTasks) : tasksOrFn;
            dbService.syncStore('dailyTasks', newTasks);
            dbService.put('appState', new Date().toISOString().split('T')[0], 'dailyTasksDate');
            return { dailyTasks: newTasks };
        });
    },

    setStudyGoals: (goalsOrFn) => {
        set(state => {
            const newGoals = typeof goalsOrFn === 'function' ? goalsOrFn(state.studyGoals) : goalsOrFn;
            dbService.syncStore('studyGoals', newGoals);
            return { studyGoals: newGoals };
        });
    },

    setLongTermGoals: (goalsOrFn) => {
        set(state => {
            const newGoals = typeof goalsOrFn === 'function' ? goalsOrFn(state.longTermGoals) : goalsOrFn;
            dbService.syncStore('longTermGoals', newGoals);
            return { longTermGoals: newGoals };
        });
    },

    clearReportsAndLogs: async () => {
        await dbService.clearStore('testReports');
        await dbService.clearStore('questionLogs');
        set({ testReports: [], questionLogs: [] });
    },

    startFlashcardSession: (cards) => set({
        flashcardSession: {
            currentCardIndex: 0,
            streak: 0,
            masteredCards: 0,
            deck: cards,
            startTime: Date.now()
        }
    }),

    rateCurrentCard: (quality) => set((state) => {
        const session = state.flashcardSession;
        const currentCard = session.deck[session.currentCardIndex];
        
        if (!currentCard) return state;

        const updatedCard = calculateNextReview(currentCard, quality);
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

    getSessionResults: () => get().flashcardSession.deck,

    hydrateData: (data) => set(data)
}));
