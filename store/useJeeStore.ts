import { create } from 'zustand';
import { 
    FlashcardSession,
    Flashcard,
    UserProfile,
    TestReport,
    QuestionLog,
    StudyGoal,
    LongTermGoal,
    DailyTask,
    ChatMessage,
    GamificationState,
    GlobalFilter,
    AiAssistantPreferences,
    NotificationPreferences,
    AppearancePreferences,
    Toast
} from '../types';
import { dbService } from '../services/dbService';
import { MOCK_TEST_REPORTS, MOCK_QUESTION_LOGS } from '../constants';

// --- Types ---

interface JeeState {
    // Session State (Flashcards)
    flashcardSession: FlashcardSession;
    isFlashcardModalOpen: boolean;

    // Global App State
    isInitialized: boolean;
    apiKey: string | null;
    userProfile: UserProfile;
    
    // Data Collections
    testReports: TestReport[];
    questionLogs: QuestionLog[];
    studyGoals: StudyGoal[];
    longTermGoals: LongTermGoal[];
    dailyTasks: DailyTask[];
    chatHistory: ChatMessage[];
    
    // State & Config
    gamificationState: GamificationState;
    globalFilter: GlobalFilter;
    
    // Preferences
    aiPreferences: AiAssistantPreferences;
    notificationPreferences: NotificationPreferences;
    appearancePreferences: AppearancePreferences;
    theme: 'cyan' | 'indigo' | 'green' | 'red';
}

interface JeeActions {
    // Initialization
    initialize: () => Promise<void>;
    
    // Flashcard Actions
    startFlashcardSession: (cards: Flashcard[]) => void;
    rateCurrentCard: (quality: number) => void;
    closeFlashcardSession: () => void;
    getSessionResults: () => Flashcard[]; 

    // Global Setters (with Persistence)
    setApiKey: (key: string | null) => void;
    updateUserProfile: (profile: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
    setGlobalFilter: (filter: GlobalFilter) => void;
    
    // Data Actions
    addTestReport: (report: TestReport, logs: QuestionLog[]) => void;
    setTestReports: (reports: TestReport[] | ((prev: TestReport[]) => TestReport[])) => void;
    setQuestionLogs: (logs: QuestionLog[] | ((prev: QuestionLog[]) => QuestionLog[])) => void;
    
    // Task & Goal Actions
    setDailyTasks: (tasks: DailyTask[] | ((prev: DailyTask[]) => DailyTask[])) => void;
    setStudyGoals: (goals: StudyGoal[] | ((prev: StudyGoal[]) => StudyGoal[])) => void;
    setLongTermGoals: (goals: LongTermGoal[] | ((prev: LongTermGoal[]) => LongTermGoal[])) => void;
    
    // Chat & Gamification
    setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    setGamificationState: (state: GamificationState | ((prev: GamificationState) => GamificationState)) => void;
    
    // Preferences Actions
    setAiPreferences: (prefs: AiAssistantPreferences | ((prev: AiAssistantPreferences) => AiAssistantPreferences)) => void;
    setNotificationPreferences: (prefs: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)) => void;
    setAppearancePreferences: (prefs: AppearancePreferences | ((prev: AppearancePreferences) => AppearancePreferences)) => void;
    setTheme: (theme: 'cyan' | 'indigo' | 'green' | 'red') => void;

    // Reset
    fullReset: () => Promise<void>;
    clearReportsAndLogs: () => Promise<void>;
    clearChatHistory: () => Promise<void>;
    clearGamification: () => Promise<void>;
}

// --- Initial Values ---

const initialFlashcardSession: FlashcardSession = {
    currentCardIndex: 0,
    streak: 0,
    masteredCards: 0,
    deck: [],
    startTime: 0
};

const initialGamificationState: GamificationState = {
    level: 1,
    xp: 0,
    unlockedAchievements: {} as any,
    completedTasks: 0,
    streakData: { count: 0, date: '' },
    events: {},
};

const defaultUserProfile: UserProfile = { 
    name: '', 
    targetExams: [], 
    studyTimes: { morning: "7 AM - 10 AM", afternoon: "2 PM - 5 PM", evening: "8 PM - 11 PM" }, 
    syllabus: {}, 
    cohortSizes: { 'JEE Mains': 10000, 'JEE Advanced': 2500 }, 
    targetTimePerQuestion: { physics: 120, chemistry: 60, maths: 150 } 
};

// --- SM-2 Logic (unchanged) ---
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

export const useJeeStore = create<JeeState & JeeActions>((set, get) => ({
    // --- State ---
    flashcardSession: initialFlashcardSession,
    isFlashcardModalOpen: false,
    
    isInitialized: false,
    apiKey: null,
    userProfile: defaultUserProfile,
    testReports: [],
    questionLogs: [],
    studyGoals: [],
    longTermGoals: [],
    dailyTasks: [],
    chatHistory: [],
    gamificationState: initialGamificationState,
    globalFilter: { type: 'all', subType: 'all', startDate: '', endDate: '' },
    
    aiPreferences: { model: 'gemini-2.5-flash', responseLength: 'medium', tone: 'encouraging' },
    notificationPreferences: { achievements: true, proactiveInsights: true, proactiveInsightSensitivity: 'medium' },
    appearancePreferences: { disableParticles: true, reduceMotion: false, highContrast: false },
    theme: 'cyan',

    // --- Actions ---

    initialize: async () => {
        if (get().isInitialized) return;

        // 1. Load LocalStorage Items (Sync)
        const apiKey = localStorage.getItem('gemini-api-key');
        const savedProfile = localStorage.getItem('userProfile_v2');
        const savedAiPrefs = localStorage.getItem('aiAssistantPreferences_v1');
        const savedNotifPrefs = localStorage.getItem('notificationPreferences_v1');
        const savedAppearPrefs = localStorage.getItem('appearancePreferences_v1');
        const savedTheme = localStorage.getItem('theme_v1');
        const savedFilter = localStorage.getItem('jeeGlobalFilter_v2');

        // 2. Load IndexedDB Items (Async)
        await dbService.initDB();
        const reportsCount = await dbService.getCount('testReports');

        if (reportsCount === 0) {
            // Seed Mock Data if empty
            await dbService.putBulk('testReports', MOCK_TEST_REPORTS);
            await dbService.putBulk('questionLogs', MOCK_QUESTION_LOGS);
            await dbService.putBulk('chatHistory', [{ role: 'model', content: "Hello! I'm your AI performance coach. Ask me anything about your test reports, or generate a study plan." }]);
            await dbService.putBulk('gamificationState', [initialGamificationState]);
        }

        const [reports, logs, goals, history, gStateArray, tasks, longGoals] = await Promise.all([
            dbService.getAll<TestReport>('testReports'),
            dbService.getAll<QuestionLog>('questionLogs'),
            dbService.getAll<StudyGoal>('studyGoals'),
            dbService.getAll<ChatMessage>('chatHistory'),
            dbService.getAll<GamificationState>('gamificationState'),
            dbService.getAll<DailyTask>('dailyTasks'),
            dbService.getAll<LongTermGoal>('longTermGoals'),
        ]);

        // Daily Task Reset Logic
        const today = new Date().toISOString().split('T')[0];
        const savedDate = await dbService.get<string>('appState', 'dailyTasksDate');
        const currentTasks = savedDate === today ? tasks : [];

        // Apply visual preferences immediately
        const appearance = savedAppearPrefs ? JSON.parse(savedAppearPrefs) : get().appearancePreferences;
        const themeVal = savedTheme ? JSON.parse(savedTheme) : 'cyan';
        document.body.classList.toggle('reduce-motion', appearance.reduceMotion);
        document.body.classList.toggle('high-contrast', appearance.highContrast);
        document.documentElement.className = `theme-${themeVal}`;

        set({
            isInitialized: true,
            apiKey,
            userProfile: savedProfile ? JSON.parse(savedProfile) : defaultUserProfile,
            aiPreferences: savedAiPrefs ? JSON.parse(savedAiPrefs) : get().aiPreferences,
            notificationPreferences: savedNotifPrefs ? JSON.parse(savedNotifPrefs) : get().notificationPreferences,
            appearancePreferences: appearance,
            theme: themeVal,
            globalFilter: savedFilter ? JSON.parse(savedFilter) : get().globalFilter,
            testReports: reports,
            questionLogs: logs,
            studyGoals: goals,
            longTermGoals: longGoals,
            chatHistory: history.length > 0 ? history : [{ role: 'model', content: "Hello! I'm your AI performance coach." }],
            gamificationState: gStateArray[0] || initialGamificationState,
            dailyTasks: currentTasks
        });
    },

    setApiKey: (key) => {
        if (key) localStorage.setItem('gemini-api-key', key);
        else localStorage.removeItem('gemini-api-key');
        set({ apiKey: key });
    },

    updateUserProfile: (profileOrFn) => {
        set(state => {
            const newProfile = typeof profileOrFn === 'function' ? profileOrFn(state.userProfile) : profileOrFn;
            localStorage.setItem('userProfile_v2', JSON.stringify(newProfile));
            return { userProfile: newProfile };
        });
    },

    setGlobalFilter: (filter) => {
        localStorage.setItem('jeeGlobalFilter_v2', JSON.stringify(filter));
        set({ globalFilter: filter });
    },

    addTestReport: (report, logs) => {
        set(state => {
            const newReports = [...state.testReports, report];
            const newLogs = [...state.questionLogs, ...logs];
            
            // Side Effects
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

    setChatHistory: (historyOrFn) => {
        set(state => {
            const newHistory = typeof historyOrFn === 'function' ? historyOrFn(state.chatHistory) : historyOrFn;
            dbService.syncStore('chatHistory', newHistory);
            return { chatHistory: newHistory };
        });
    },

    setGamificationState: (stateOrFn) => {
        set(current => {
            const newState = typeof stateOrFn === 'function' ? stateOrFn(current.gamificationState) : stateOrFn;
            dbService.syncStore('gamificationState', [newState]);
            return { gamificationState: newState };
        });
    },

    setAiPreferences: (prefsOrFn) => {
        set(state => {
            const newPrefs = typeof prefsOrFn === 'function' ? prefsOrFn(state.aiPreferences) : prefsOrFn;
            localStorage.setItem('aiAssistantPreferences_v1', JSON.stringify(newPrefs));
            return { aiPreferences: newPrefs };
        });
    },

    setNotificationPreferences: (prefsOrFn) => {
        set(state => {
            const newPrefs = typeof prefsOrFn === 'function' ? prefsOrFn(state.notificationPreferences) : prefsOrFn;
            localStorage.setItem('notificationPreferences_v1', JSON.stringify(newPrefs));
            return { notificationPreferences: newPrefs };
        });
    },

    setAppearancePreferences: (prefsOrFn) => {
        set(state => {
            const newPrefs = typeof prefsOrFn === 'function' ? prefsOrFn(state.appearancePreferences) : prefsOrFn;
            localStorage.setItem('appearancePreferences_v1', JSON.stringify(newPrefs));
            document.body.classList.toggle('reduce-motion', newPrefs.reduceMotion);
            document.body.classList.toggle('high-contrast', newPrefs.highContrast);
            return { appearancePreferences: newPrefs };
        });
    },

    setTheme: (theme) => {
        localStorage.setItem('theme_v1', JSON.stringify(theme));
        document.documentElement.className = `theme-${theme}`;
        set({ theme });
    },

    // --- Reset Actions ---

    fullReset: async () => {
        await dbService.clearAllStores();
        localStorage.clear();
        window.location.reload();
    },

    clearReportsAndLogs: async () => {
        await dbService.clearStore('testReports');
        await dbService.clearStore('questionLogs');
        set({ testReports: [], questionLogs: [] });
    },

    clearChatHistory: async () => {
        await dbService.clearStore('chatHistory');
        set({ chatHistory: [{ role: 'model', content: "Chat history cleared." }] });
    },

    clearGamification: async () => {
        await dbService.clearStore('gamificationState');
        set({ gamificationState: initialGamificationState });
    },

    // --- Flashcard Actions ---
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

    closeFlashcardSession: () => set({ isFlashcardModalOpen: false }),
    getSessionResults: () => get().flashcardSession.deck
}));