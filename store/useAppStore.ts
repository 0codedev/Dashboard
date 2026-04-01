import { create } from 'zustand';
import { 
    UserProfile,
    GamificationState,
    GlobalFilter,
    AiAssistantPreferences,
    NotificationPreferences,
    AppearancePreferences
} from '../types';
import { dbService } from '../services/dbService';

interface AppState {
    isInitialized: boolean;
    apiKey: string | null;
    userProfile: UserProfile;
    gamificationState: GamificationState;
    globalFilter: GlobalFilter;
    aiPreferences: AiAssistantPreferences;
    notificationPreferences: NotificationPreferences;
    appearancePreferences: AppearancePreferences;
    theme: 'cyan' | 'indigo' | 'green' | 'red';
    isFlashcardModalOpen: boolean;
    shieldActive: boolean;
    // Timer State
    timerState: {
        isActive: boolean;
        mode: 'focus' | 'short' | 'long' | 'custom';
        timeLeft: number;
        endTime: number | null;
        activeTaskId: string | null;
    };
}

interface AppActions {
    setInitialized: (val: boolean) => void;
    setApiKey: (key: string | null) => void;
    updateUserProfile: (profile: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
    setGlobalFilter: (filter: GlobalFilter) => void;
    setGamificationState: (state: GamificationState | ((prev: GamificationState) => GamificationState)) => void;
    setAiPreferences: (prefs: AiAssistantPreferences | ((prev: AiAssistantPreferences) => AiAssistantPreferences)) => void;
    setNotificationPreferences: (prefs: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)) => void;
    setAppearancePreferences: (prefs: AppearancePreferences | ((prev: AppearancePreferences) => AppearancePreferences)) => void;
    setTheme: (theme: 'cyan' | 'indigo' | 'green' | 'red') => void;
    clearGamification: () => Promise<void>;
    setFlashcardModalOpen: (isOpen: boolean) => void;
    setShieldActive: (isActive: boolean) => void;
    setTimerState: (state: Partial<AppState['timerState']>) => void;
    // For initialization
    hydrateApp: (data: Partial<AppState>) => void;
}

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

export const useAppStore = create<AppState & AppActions>((set, get) => ({
    isInitialized: false,
    apiKey: null,
    userProfile: defaultUserProfile,
    gamificationState: initialGamificationState,
    globalFilter: { subjects: [], types: [], subTypes: [], startDate: '', endDate: '' },
    aiPreferences: { model: 'gemini-3.1-flash-lite-preview', responseLength: 'medium', tone: 'encouraging' },
    notificationPreferences: { achievements: true, proactiveInsights: true, proactiveInsightSensitivity: 'medium', flashcardReminders: true, bioCheckReminders: true },
    appearancePreferences: { disableParticles: true, reduceMotion: false, highContrast: false, largeText: false, dyslexicFont: false },
    theme: 'cyan',
    isFlashcardModalOpen: false,
    shieldActive: false,
    timerState: {
        isActive: false,
        mode: 'focus',
        timeLeft: 25 * 60,
        endTime: null,
        activeTaskId: null,
    },

    setInitialized: (val) => set({ isInitialized: val }),
    
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
            document.body.classList.toggle('large-text', newPrefs.largeText);
            document.body.classList.toggle('dyslexic-font', newPrefs.dyslexicFont);
            return { appearancePreferences: newPrefs };
        });
    },

    setTheme: (theme) => {
        localStorage.setItem('theme_v1', JSON.stringify(theme));
        document.documentElement.className = `theme-${theme}`;
        set({ theme });
    },

    clearGamification: async () => {
        await dbService.clearStore('gamificationState');
        set({ gamificationState: initialGamificationState });
    },

    setFlashcardModalOpen: (isOpen) => set({ isFlashcardModalOpen: isOpen }),
    setShieldActive: (isActive) => set({ shieldActive: isActive }),
    
    setTimerState: (newState) => set(state => {
        const updated = { ...state.timerState, ...newState };
        localStorage.setItem('jee_timer_state', JSON.stringify(updated));
        return { timerState: updated };
    }),

    hydrateApp: (data) => set(data)
}));
