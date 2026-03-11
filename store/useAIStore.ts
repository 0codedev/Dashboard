import { create } from 'zustand';
import { ChatMessage } from '../types';
import { dbService } from '../services/dbService';

interface AIState {
    chatHistory: ChatMessage[];
    // Future additions for volatile state:
    // activeStreamingChunks: string;
    // promptStatus: 'idle' | 'loading' | 'error';
}

interface AIActions {
    setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    clearChatHistory: () => Promise<void>;
    hydrateAI: (data: Partial<AIState>) => void;
}

export const useAIStore = create<AIState & AIActions>((set, get) => ({
    chatHistory: [],

    setChatHistory: (historyOrFn) => {
        set(state => {
            const newHistory = typeof historyOrFn === 'function' ? historyOrFn(state.chatHistory) : historyOrFn;
            dbService.syncStore('chatHistory', newHistory);
            return { chatHistory: newHistory };
        });
    },

    clearChatHistory: async () => {
        await dbService.clearStore('chatHistory');
        set({ chatHistory: [{ role: 'model', content: "Chat history cleared." }] });
    },

    hydrateAI: (data) => set(data)
}));
