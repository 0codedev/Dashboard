import { create } from 'zustand';
import { 
    TestReport,
    QuestionLog,
    StudyGoal,
    LongTermGoal,
    DailyTask,
    FlashcardSession,
    Flashcard,
    Reflection
} from '../types';
import { dbService } from '../services/dbService';

interface DataState {
    testReports: TestReport[];
    questionLogs: QuestionLog[];
    studyGoals: StudyGoal[];
    longTermGoals: LongTermGoal[];
    dailyTasks: DailyTask[];
    flashcardSession: FlashcardSession;
    reflections: Reflection[];
    
    // DailyPlanner specific state
    bioStats: { sleep: number; stress: number; energy: number; date: string; skipped?: boolean } | null;
    dailyQuote: { text: string; date: string } | null;
    streakData: { count: number; date: string };
    endOfDaySummaries: Record<string, string>;
    dailyPlansHistory: Record<string, DailyTask[]>;
}

interface DataActions {
    addTestReport: (report: TestReport, logs: QuestionLog[]) => void;
    setTestReports: (reports: TestReport[] | ((prev: TestReport[]) => TestReport[])) => void;
    setQuestionLogs: (logs: QuestionLog[] | ((prev: QuestionLog[]) => QuestionLog[])) => void;
    setDailyTasks: (tasks: DailyTask[] | ((prev: DailyTask[]) => DailyTask[])) => void;
    setStudyGoals: (goals: StudyGoal[] | ((prev: StudyGoal[]) => StudyGoal[])) => void;
    setLongTermGoals: (goals: LongTermGoal[] | ((prev: LongTermGoal[]) => LongTermGoal[])) => void;
    setReflections: (reflections: Reflection[] | ((prev: Reflection[]) => Reflection[])) => void;
    
    setBioStats: (stats: DataState['bioStats']) => void;
    setDailyQuote: (quote: DataState['dailyQuote']) => void;
    setStreakData: (data: DataState['streakData']) => void;
    setEndOfDaySummaries: (summaries: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
    setDailyPlansHistory: (history: Record<string, DailyTask[]> | ((prev: Record<string, DailyTask[]>) => Record<string, DailyTask[]>)) => void;
    
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
    reflections: [],
    bioStats: null,
    dailyQuote: null,
    streakData: { count: 0, date: '' },
    endOfDaySummaries: {},
    dailyPlansHistory: {},

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
            const getLocalDateStr = (date: Date = new Date()) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            dbService.put('appState', getLocalDateStr(), 'dailyTasksDate');
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

    setReflections: (reflectionsOrFn) => {
        set(state => {
            const newReflections = typeof reflectionsOrFn === 'function' ? reflectionsOrFn(state.reflections) : reflectionsOrFn;
            dbService.syncStore('reflections', newReflections);
            return { reflections: newReflections };
        });
    },

    setBioStats: (stats) => {
        set({ bioStats: stats });
        if (stats) localStorage.setItem(`bioLog_${stats.date}`, JSON.stringify(stats));
    },
    setDailyQuote: (quote) => {
        set({ dailyQuote: quote });
        if (quote) localStorage.setItem('dailyQuote', JSON.stringify(quote));
    },
    setStreakData: (data) => {
        set({ streakData: data });
        localStorage.setItem('streakData_v1', JSON.stringify(data));
    },
    setEndOfDaySummaries: (summariesOrFn) => {
        set(state => {
            const newSummaries = typeof summariesOrFn === 'function' ? summariesOrFn(state.endOfDaySummaries) : summariesOrFn;
            localStorage.setItem('endOfDaySummaries_v1', JSON.stringify(newSummaries));
            return { endOfDaySummaries: newSummaries };
        });
    },
    setDailyPlansHistory: (historyOrFn) => {
        set(state => {
            const newHistory = typeof historyOrFn === 'function' ? historyOrFn(state.dailyPlansHistory) : historyOrFn;
            localStorage.setItem('dailyPlansHistory_v1', JSON.stringify(newHistory));
            return { dailyPlansHistory: newHistory };
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
