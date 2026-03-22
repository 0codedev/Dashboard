import { create } from 'zustand';
import { ChatMessage } from '../types';
import { dbService } from '../services/dbService';
import { backupChatHistory } from '../services/backupService';

interface AIState {
    chatHistory: ChatMessage[];
    activeSessionId: string | null;
    // Future additions for volatile state:
    // activeStreamingChunks: string;
    // promptStatus: 'idle' | 'loading' | 'error';
}

interface AIActions {
    setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    setActiveSessionId: (id: string | null) => void;
    clearChatHistory: () => Promise<void>;
    hydrateAI: (data: Partial<AIState>) => void;
}

export const useAIStore = create<AIState & AIActions>((set, get) => ({
    chatHistory: [],
    activeSessionId: null,

    setChatHistory: (historyOrFn) => {
        set(state => {
            const newHistory = typeof historyOrFn === 'function' ? historyOrFn(state.chatHistory) : historyOrFn;
            dbService.syncStore('chatHistory', newHistory);
            backupChatHistory(newHistory);
            return { chatHistory: newHistory };
        });
    },

    setActiveSessionId: (id) => {
        set({ activeSessionId: id });
        if (id) {
            localStorage.setItem('active_chat_session_id', id);
        } else {
            localStorage.removeItem('active_chat_session_id');
        }
    },

    clearChatHistory: async () => {
        await dbService.clearStore('chatHistory');
        set({ chatHistory: [{ role: 'model', content: "Chat history cleared." }], activeSessionId: null });
        localStorage.removeItem('active_chat_session_id');
    },

    hydrateAI: (data) => {
        const savedId = localStorage.getItem('active_chat_session_id');
        set({ ...data, activeSessionId: savedId || data.activeSessionId || null });
    }
}));
