
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
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Standard reasoning & multimodal.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite', provider: 'google', description: 'Fast, lightweight, low latency.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐇' },
    { id: 'gemma-2-27b-it', name: 'Gemma 2 27B (High Limit)', provider: 'google', description: 'High API limits (15k/day). Great for chat.', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },

    // --- TIER 2: GROQ (Ultra-Fast Inference) ---
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'GPT-4 class intelligence. Extremely fast.', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🏎️' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill (Groq)', provider: 'groq', description: 'Strong reasoning model distilled from R1.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧠' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', provider: 'groq', description: 'Instant response. Best for UI interaction.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', provider: 'groq', description: 'Balanced Google open model on Groq.', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧬' },

    // --- TIER 3: OPENROUTER (Reliable Free Tier) ---
    { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (OR)', provider: 'openrouter', description: 'Free tier fallback via OpenRouter.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '✨' },
    { id: 'mistralai/mistral-nemo:free', name: 'Mistral Nemo', provider: 'openrouter', description: 'Great for creative writing and persona.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: false, costCategory: 'free', icon: '🎭' },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini', provider: 'openrouter', description: 'High logic density for small size.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🔬' },
    
    // --- TIER 4: EXPERIMENTAL / HIGH LOAD (Taste of the Future) ---
    // These models may have queues, lower rate limits, or lower uptime, but offer unique capabilities.
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'openrouter', description: 'Top-tier reasoning. Often busy/rate-limited.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐳' },
    { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B (Free)', provider: 'openrouter', description: 'Massive model. Very low availability.', contextWindow: 8000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🌌' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B (Free)', provider: 'openrouter', description: 'NVIDIA optimized. Strong alignment.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🟢' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', description: 'Excellent for structured output/JSON.', contextWindow: 32000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💻' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (OR)', provider: 'openrouter', description: 'OpenRouter fallback for Llama 3.3.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦙' },
];

// Optimized Fallback Chains
export const TASK_DEFAULTS: Record<LlmTaskCategory, string[]> = {
    // Deep Analysis: Try Llama 3.3 (Groq), then DeepSeek R1 (Groq), then Flash
    analysis: [
        'llama-3.3-70b-versatile', 
        'deepseek-r1-distill-llama-70b',
        'gemini-2.5-flash',
        'deepseek/deepseek-r1:free' // Experimental fallback
    ], 
    
    // Math/STEM: Gemini Native (Best formatting), then DeepSeek Distill
    math: [
        'gemini-2.5-flash', 
        'deepseek-r1-distill-llama-70b',
        'llama-3.3-70b-versatile',
        'nvidia/llama-3.1-nemotron-70b-instruct:free'
    ], 
    
    // Planning: Llama 3.3 is excellent at following structured constraints.
    planning: [
        'llama-3.3-70b-versatile', 
        'gemini-2.5-flash',
        'qwen/qwen-2.5-coder-32b-instruct:free'
    ], 
    
    // Creative/Persona: Gemma 2 and Flash Lite are great here.
    creative: [
        'gemma-2-27b-it',
        'gemini-2.0-flash-lite-preview-02-05',
        'mistralai/mistral-nemo:free',
        'nousresearch/hermes-3-llama-3.1-405b:free' // Try the big model for creative
    ], 
    
    // General Chat: Speed is key.
    chat: [
        'gemini-2.0-flash-lite-preview-02-05',
        'llama-3.1-8b-instant', 
        'gemma-2-27b-it'
    ], 
    
    // Coding/JSON: Needs strict instruction following.
    coding: [
        'gemini-2.5-flash', // Native JSON mode is strongest here
        'llama-3.3-70b-versatile',
        'qwen/qwen-2.5-coder-32b-instruct:free'
    ], 
};

export const getModelById = (id: string): AIModel | undefined => {
    return MODEL_REGISTRY.find(m => m.id === id);
};
