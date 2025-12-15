
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
    // Updated to 2.5 as requested
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Latest reasoning & multimodal workhorse.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', description: 'Ultra-fast, lightweight, low latency.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐇' },
    // Updated to Gemma 3-27b
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

// Optimized Fallback Chains
// STRATEGY: Put Gemini 2.5 and Llama 3.3 (Stable) higher than DeepSeek/Free models to reduce error rates.
export const TASK_DEFAULTS: Record<LlmTaskCategory, string[]> = {
    // Deep Analysis: Llama 3.3 -> Gemini 2.5 -> DeepSeek (Fallback)
    analysis: [
        'gemini-2.5-flash',
        'llama-3.3-70b-versatile', 
        'deepseek-r1-distill-llama-70b',
        'deepseek/deepseek-r1:free' 
    ], 
    
    // Math/STEM: DeepSeek (Groq) -> Gemini 2.5 -> Qwen
    math: [
        'deepseek-r1-distill-llama-70b',
        'gemini-2.5-flash', 
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b'
    ], 
    
    // Planning: Qwen Coder (Best JSON) -> Gemini -> Llama
    planning: [
        'qwen/qwen-2.5-coder-32b-instruct:free',
        'gemini-2.5-flash', 
        'llama-3.3-70b-versatile'
    ], 
    
    // Creative/Persona: Mistral Nemo -> Gemma 3 -> Gemini Lite
    creative: [
        'mistralai/mistral-nemo:free',
        'gemma-3-27b',
        'gemini-2.5-flash-lite',
        'moonshotai/kimi-k2-instruct'
    ], 
    
    // General Chat: Gemini Lite -> Llama Instant
    chat: [
        'gemini-2.5-flash-lite',
        'llama-3.1-8b-instant', 
        'gemma-3-27b',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ], 
    
    // Coding/JSON: Qwen -> Gemini -> Llama
    coding: [
        'qwen/qwen-2.5-coder-32b-instruct:free',
        'gemini-2.5-flash', 
        'llama-3.3-70b-versatile'
    ], 
};

export const getModelById = (id: string): AIModel | undefined => {
    return MODEL_REGISTRY.find(m => m.id === id);
};
