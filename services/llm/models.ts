
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
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'openrouter', description: 'Top-tier reasoning. Often busy/rate-limited.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐳' },

    // --- NEW OPENROUTER FREE MODELS ---
    { id: 'minimax/minimax-m2.5:free', name: 'MiniMax: MiniMax M2.5 (free)', provider: 'openrouter', description: 'MiniMax M2.5', contextWindow: 196608, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟨' },
    { id: 'stepfun/step-3.5-flash:free', name: 'StepFun: Step 3.5 Flash (free)', provider: 'openrouter', description: 'Step 3.5 Flash', contextWindow: 256000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'arcee-ai/trinity-large-preview:free', name: 'Arcee AI: Trinity Large Preview (free)', provider: 'openrouter', description: 'Trinity Large Preview', contextWindow: 131000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🔵' },
    { id: 'liquid/lfm-2.5-1.2b-thinking:free', name: 'LiquidAI: LFM2.5-1.2B-Thinking (free)', provider: 'openrouter', description: 'LFM2.5-1.2B-Thinking', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💧' },
    { id: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'LiquidAI: LFM2.5-1.2B-Instruct (free)', provider: 'openrouter', description: 'LFM2.5-1.2B-Instruct', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💧' },
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'NVIDIA: Nemotron 3 Nano 30B A3B (free)', provider: 'openrouter', description: 'Nemotron 3 Nano 30B A3B', contextWindow: 256000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟢' },
    { id: 'arcee-ai/trinity-mini:free', name: 'Arcee AI: Trinity Mini (free)', provider: 'openrouter', description: 'Trinity Mini', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🔵' },
    { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen: Qwen3 Next 80B A3B Instruct (free)', provider: 'openrouter', description: 'Qwen3 Next 80B A3B Instruct', contextWindow: 262144, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟣' },
    { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'NVIDIA: Nemotron Nano 9B V2 (free)', provider: 'openrouter', description: 'Nemotron Nano 9B V2', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟢' },
    { id: 'z-ai/glm-4.5-air:free', name: 'Z.ai: GLM 4.5 Air (free)', provider: 'openrouter', description: 'GLM 4.5 Air', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🌐' },
    { id: 'qwen/qwen3-coder-480b-a35b:free', name: 'Qwen: Qwen3 Coder 480B A35B (free)', provider: 'openrouter', description: 'Qwen3 Coder 480B A35B', contextWindow: 262000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💻' },
    { id: 'venice/uncensored:free', name: 'Venice: Uncensored (free)', provider: 'openrouter', description: 'Venice Uncensored', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🎭' },
    { id: 'google/gemma-3n-2b:free', name: 'Google: Gemma 3n 2B (free)', provider: 'openrouter', description: 'Gemma 3n 2B', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },
    { id: 'google/gemma-3n-4b:free', name: 'Google: Gemma 3n 4B (free)', provider: 'openrouter', description: 'Gemma 3n 4B', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },
    { id: 'qwen/qwen3-4b:free', name: 'Qwen: Qwen3 4B (free)', provider: 'openrouter', description: 'Qwen3 4B', contextWindow: 40960, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟣' },
    { id: 'mistralai/mistral-small-3.1-24b:free', name: 'Mistral: Mistral Small 3.1 24B (free)', provider: 'openrouter', description: 'Mistral Small 3.1 24B', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🌪️' },
    { id: 'google/gemma-3-4b:free', name: 'Google: Gemma 3 4B (free)', provider: 'openrouter', description: 'Gemma 3 4B', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },
    { id: 'google/gemma-3-12b:free', name: 'Google: Gemma 3 12B (free)', provider: 'openrouter', description: 'Gemma 3 12B', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },
    { id: 'google/gemma-3-27b:free', name: 'Google: Gemma 3 27B (free)', provider: 'openrouter', description: 'Gemma 3 27B', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta: Llama 3.3 70B Instruct (free)', provider: 'openrouter', description: 'Llama 3.3 70B Instruct', contextWindow: 65536, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦙' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Meta: Llama 3.2 3B Instruct (free)', provider: 'openrouter', description: 'Llama 3.2 3B Instruct', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦙' },
    { id: 'nousresearch/hermes-3-405b-instruct:free', name: 'Nous: Hermes 3 405B Instruct (free)', provider: 'openrouter', description: 'Hermes 3 405B Instruct', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦉' },

    // --- FAILING / UNAVAILABLE MODELS (Moved to end) ---
    { id: 'mistralai/mistral-nemo:free', name: 'Mistral Nemo (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: false, costCategory: 'free', icon: '⚠️' },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚠️' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 32000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚠️' },
    { id: 'nvidia/nemotron-3-super:free', name: 'NVIDIA: Nemotron 3 Super (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 262144, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚠️' },
    { id: 'nvidia/nemotron-nano-12b-2-vl:free', name: 'NVIDIA: Nemotron Nano 12B 2 VL (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 128000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚠️' },
    { id: 'openai/gpt-oss-120b:free', name: 'OpenAI: gpt-oss-120b (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚠️' },
    { id: 'openai/gpt-oss-20b:free', name: 'OpenAI: gpt-oss-20b (Unavailable)', provider: 'openrouter', description: 'Currently unavailable on OpenRouter.', contextWindow: 131072, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚠️' },
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
