
import { GoogleGenAI, Type } from "@google/genai";
import { AiAssistantPreferences, LlmTaskCategory } from "../../types";
import { MODEL_REGISTRY, TASK_DEFAULTS, getModelById } from "./models";
import { generateTextOpenAI } from "./providers";

interface GenerationOptions {
    task: LlmTaskCategory;
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: any; // For Gemini
    expectJson?: boolean; // For OpenAI/Groq
    userPreferences: AiAssistantPreferences;
    googleApiKey: string;
}

export const llmPipeline = async (options: GenerationOptions): Promise<string> => {
    const { task, prompt, systemInstruction, jsonSchema, expectJson, userPreferences, googleApiKey } = options;

    // 1. Determine Candidate Models (Priority Order)
    const candidates: string[] = [];

    // A. User Override for this specific task
    if (userPreferences.modelOverrides?.[task]) {
        candidates.push(userPreferences.modelOverrides[task]!);
    }

    // B. Task Defaults (Preferred Open Source SOTA Chains)
    TASK_DEFAULTS[task].forEach(m => {
        if (!candidates.includes(m)) candidates.push(m);
    });

    // C. Ultimate Fallback Strategy (The "Safety Net")
    // If it's a complicated task (Analysis, Math), fallback to Gemini Flash (Reasoning).
    // If it's a simple/fast task (Creative, Chat), fallback to Gemini Flash Lite (Speed/Cost).
    const complexTasks: LlmTaskCategory[] = ['analysis', 'math', 'planning', 'coding'];
    const ultimateFallback = complexTasks.includes(task) ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';

    if (!candidates.includes(ultimateFallback)) {
        candidates.push(ultimateFallback);
    }
    
    // Ensure we have at least one Gemini model as absolute last resort if Lite fails or isn't picked
    if (!candidates.includes('gemini-2.5-flash')) {
        candidates.push('gemini-2.5-flash');
    }

    let lastError: Error | null = null;
    let usedModelId: string | null = null;
    let resultText = "";

    // 2. Iterate and Try
    for (const modelId of candidates) {
        const modelDef = getModelById(modelId);
        if (!modelDef) continue;

        // Check if we have the key for this provider
        let apiKey = '';
        if (modelDef.provider === 'google') apiKey = googleApiKey;
        if (modelDef.provider === 'groq') apiKey = userPreferences.groqApiKey || '';
        if (modelDef.provider === 'openrouter') apiKey = userPreferences.openRouterApiKey || '';

        // Skip if missing key, UNLESS it's Google (we assume app requires google key to even start)
        if (!apiKey && modelDef.provider !== 'google') {
            console.debug(`Skipping ${modelId}: Missing ${modelDef.provider} API key.`);
            continue;
        }

        try {
            console.log(`[LLM Pipeline] executing ${task} via ${modelId}...`);
            
            if (modelDef.provider === 'google') {
                // Use Native Gemini
                const ai = new GoogleGenAI({ apiKey });
                const config: any = {
                    systemInstruction: systemInstruction,
                };
                
                // Handle JSON schema
                if (jsonSchema || expectJson) {
                    config.responseMimeType = "application/json";
                    if (jsonSchema) config.responseSchema = jsonSchema;
                }

                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: { parts: [{ text: prompt }] },
                    config: config
                });
                
                resultText = response.text || "";
                usedModelId = modelId;
                break; // Success

            } else {
                // Use OpenAI Compatible (Groq/OpenRouter)
                const result = await generateTextOpenAI(
                    modelDef.provider,
                    apiKey,
                    modelId,
                    prompt,
                    systemInstruction,
                    expectJson || !!jsonSchema
                );
                resultText = result;
                usedModelId = modelId;
                break; // Success
            }

        } catch (e: any) {
            console.warn(`[LLM Pipeline] ${modelId} failed:`, e.message);
            lastError = e;
            // Continue to next candidate
        }
    }

    if (!usedModelId) {
        throw new Error(`All LLM candidates failed for task '${task}'. Last error: ${lastError?.message}`);
    }

    // 3. Attribution Logic (Only for text-heavy, non-JSON tasks)
    // We skip attribution for 'creative' (quotes), 'chat' (short tooltips), and JSON data.
    if (!expectJson && !jsonSchema && usedModelId) {
        const showAttribution = task === 'analysis' || task === 'planning' || task === 'math';
        
        if (showAttribution) {
            const modelDef = getModelById(usedModelId);
            const modelName = modelDef ? modelDef.name : usedModelId;
            resultText += `\n\n<div class="text-[10px] text-gray-500 mt-4 pt-2 border-t border-slate-700/50 flex items-center gap-1"><span>⚡</span> Generated by <strong>${modelName}</strong></div>`;
        }
    }

    return resultText;
};
