
import { LlmTaskCategory } from "../../types";

export interface AIModel {
    id: string;
    name: string;
    provider: 'google' | 'groq' | 'openrouter';
    description: string;
    contextWindow: number;
    isFree?: boolean;
    supportsVision?: boolean;
    supportsJson?: boolean;
    costCategory: 'free' | 'low' | 'medium' | 'high';
    icon?: string;
}

export const MODEL_REGISTRY: AIModel[] = [
    // --- TIER 1: GOOGLE NATIVE (Primary - High Reliability) ---
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Complex reasoning, coding, math, STEM.', contextWindow: 2000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '🧠' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Next-gen multimodal reasoning & speed.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'google', description: 'Ultra-fast, lightweight, low latency.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐇' },
    { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', provider: 'google', description: 'High-quality image generation.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: false, costCategory: 'free', icon: '🖼️' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', provider: 'google', description: 'High-quality image generation.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: false, costCategory: 'free', icon: '🖼️' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash TTS', provider: 'google', description: 'Text-to-speech generation.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: false, costCategory: 'free', icon: '🗣️' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Latest reasoning & multimodal workhorse.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', description: 'Ultra-fast, lightweight, low latency.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐇' },
    { id: 'gemma-3-27b', name: 'Gemma 3 27B', provider: 'google', description: 'Latest open weights model from Google.', contextWindow: 8192, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '💎' },

    // --- TIER 2: GROQ (Ultra-Fast Inference) ---
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'GPT-4 class intelligence. Extremely fast.', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🏎️' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill (Groq)', provider: 'groq', description: 'Strong reasoning model distilled from R1.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧠' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', provider: 'groq', description: 'Instant response. Best for UI interaction.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚡' },
    
    // Legacy/Fallback Groq
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', provider: 'groq', description: 'Balanced Google open model on Groq.', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧬' },

    // --- GROQ EXTENDED (From Console) ---
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', provider: 'groq', description: 'Next-gen preview model.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦄' },
    { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', provider: 'groq', description: 'High context capabilities.', contextWindow: 200000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🌕' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B', provider: 'groq', description: 'Advanced reasoning.', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐉' },

    // --- TIER 3: OPENROUTER (Reliable Free Tier) ---
    { id: 'mistralai/mistral-nemo:free', name: 'Mistral Nemo', provider: 'openrouter', description: 'Great for creative writing and persona.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: false, costCategory: 'free', icon: '🎭' },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini', provider: 'openrouter', description: 'High logic density for small size.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🔬' },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'openrouter', description: 'Top-tier reasoning. Often busy/rate-limited.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐳' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', description: 'Excellent for structured output/JSON.', contextWindow: 32000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💻' },
];

// Optimized Fallback Chains for Granular Tasks
export const TASK_DEFAULTS: Record<LlmTaskCategory, string[]> = {
    // 1. General Chat
    chat_general: [
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
        'llama-3.1-8b-instant', 
        'gemma-3-27b',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ], 

    // 2. Deep Analysis (Dashboard Reports)
    analysis_deep: [
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        'llama-3.3-70b-versatile', 
        'deepseek-r1-distill-llama-70b',
        'deepseek/deepseek-r1:free' 
    ],

    // 3. Root Cause Analysis (5-Whys)
    analysis_root_cause: [
        'gemini-3-flash-preview',
        'deepseek-r1-distill-llama-70b', // R1 is excellent for causal reasoning
        'gemini-3.1-flash-lite-preview',
        'llama-3.3-70b-versatile'
    ],

    // 4. Executive Briefing
    analysis_briefing: [
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview', // Good formatting and summarization
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b'
    ],

    // 5. Routine Planning (Daily Schedule)
    planning_routine: [
        'gemini-3.1-flash-lite-preview',
        'qwen/qwen-2.5-coder-32b-instruct:free', // Structured output
        'gemini-3-flash-preview', 
        'llama-3.3-70b-versatile'
    ],

    // 6. Sorting & Optimization (Smart Sort)
    planning_sorting: [
        'gemma-3-27b',
        'gemini-3.1-flash-lite-preview', // Speed is key here
        'llama-3.1-8b-instant',
        'qwen/qwen-2.5-coder-32b-instruct:free'
    ],

    // 7. Creative Writing (Quotes, Persona)
    creative_writing: [
        'gemini-3.1-flash-lite-preview',
        'mistralai/mistral-nemo:free',
        'gemma-3-27b',
        'gemini-3-flash-preview',
        'moonshotai/kimi-k2-instruct'
    ],

    // 8. STEM Core (Math/Physics Solving)
    stem_core: [
        'gemini-3-flash-preview',
        'deepseek-r1-distill-llama-70b', // Math powerhouse
        'gemini-3.1-flash-lite-preview', 
        'qwen/qwen3-32b'
    ],

    // 9. Flashcard Generation (Error Vaccinator)
    flashcard_gen: [
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        'llama-3.3-70b-versatile',
        'deepseek-r1-distill-llama-70b'
    ],

    // 10. Technical Ops (Data Cleaning)
    technical_ops: [
        'gemma-3-27b',
        'gemini-3-flash-preview', 
        'qwen/qwen-2.5-coder-32b-instruct:free', 
        'llama-3.3-70b-versatile'
    ],

    // 11. OCR Image Processing
    ocr_extraction: [
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash',
        'gemma-3-27b'
    ]
};

export const getModelById = (id: string): AIModel | undefined => {
    return MODEL_REGISTRY.find(m => m.id === id);
};
