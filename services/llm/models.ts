
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
    // --- GOOGLE (Native - The Ultimate Safety Net) ---
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Best all-rounder. Multimodal & reliable.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', description: 'Extremely fast. Good for simple tasks.', contextWindow: 1000000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🐇' },
    
    // --- GROQ (Speed Layer - Instant Inference) ---
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq', description: 'High intelligence, instant speed.', contextWindow: 32768, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🏎️' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', provider: 'groq', description: 'Blazing fast. Best for UI tooltips.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '⚡' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', provider: 'groq', description: 'Balanced Google model on LPU.', contextWindow: 8192, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '💎' },

    // --- OPENROUTER (SOTA Reasoning & Specialized) ---
    
    // 1. DeepSeek R1 (The 671B Monster)
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Full)', provider: 'openrouter', description: 'SOTA Reasoning. 671B Params.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧠' },
    
    // 2. DeepSeek R1 Distill (Reliable Backup)
    { id: 'deepseek/deepseek-r1-distill-llama-70b:free', name: 'DeepSeek R1 Distill', provider: 'openrouter', description: 'Reasoning specialist. Very smart.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🧪' },
    
    // 3. Qwen 2.5 72B (The Math Wizard)
    { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', description: 'SOTA Math & Logic. Better than 32B.', contextWindow: 32000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '📐' },
    
    // 4. Llama 3.3 70B (The Generalist)
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (OR)', provider: 'openrouter', description: 'Great open model fallback.', contextWindow: 64000, isFree: true, supportsVision: false, supportsJson: true, costCategory: 'free', icon: '🦙' },
    
    // 5. Gemini 2.0 Flash Lite (New Preview)
    { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (Preview)', provider: 'openrouter', description: 'New generation. Very fast.', contextWindow: 1000000, isFree: true, supportsVision: true, supportsJson: true, costCategory: 'free', icon: '✨' },
    
    // 6. Mistral Nemo (Creative)
    { id: 'mistralai/mistral-nemo:free', name: 'Mistral Nemo', provider: 'openrouter', description: 'Creative and efficient.', contextWindow: 128000, isFree: true, supportsVision: false, supportsJson: false, costCategory: 'free', icon: '🎭' },
];

// Fallback Chains: [Primary SOTA, Reliable Backup, Fast Backup, Safety Net]
export const TASK_DEFAULTS: Record<LlmTaskCategory, string[]> = {
    // Deep Analysis: R1 (Full) -> R1 (Distill) -> Llama 3.3 -> Gemini Flash
    analysis: [
        'deepseek/deepseek-r1:free', 
        'deepseek/deepseek-r1-distill-llama-70b:free', 
        'llama-3.3-70b-versatile', 
        'gemini-2.5-flash'
    ], 
    
    // Math/STEM: Qwen 72B (SOTA) -> DeepSeek Distill -> Gemini Flash
    math: [
        'qwen/qwen-2.5-72b-instruct:free', 
        'deepseek/deepseek-r1-distill-llama-70b:free', 
        'gemini-2.5-flash'
    ], 
    
    // Planning: Qwen 72B (Constraint Holding) -> Llama 3.3 -> Gemini Flash
    planning: [
        'qwen/qwen-2.5-72b-instruct:free', 
        'llama-3.3-70b-versatile', 
        'gemini-2.5-flash'
    ], 
    
    // Creative/Persona: Llama 3.3 (Nuance) -> Gemini 2.0 Lite -> Mistral Nemo
    creative: [
        'meta-llama/llama-3.3-70b-instruct:free', 
        'google/gemini-2.0-flash-lite-preview-02-05:free', 
        'mistralai/mistral-nemo:free'
    ], 
    
    // General Chat: Groq Llama 3.3 (Speed) -> Gemini 2.0 Lite -> Gemini Flash
    chat: [
        'llama-3.3-70b-versatile', 
        'google/gemini-2.0-flash-lite-preview-02-05:free', 
        'gemini-2.5-flash'
    ], 
    
    // Coding/JSON: Qwen 72B -> Gemini Flash (Reliable JSON)
    coding: [
        'qwen/qwen-2.5-72b-instruct:free', 
        'gemini-2.5-flash'
    ], 
};

export const getModelById = (id: string): AIModel | undefined => {
    return MODEL_REGISTRY.find(m => m.id === id);
};
