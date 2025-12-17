
import { GoogleGenAI } from "@google/genai";
import { AiAssistantPreferences, LlmTaskCategory } from "../../types";
import { TASK_DEFAULTS, getModelById } from "./models";
import { generateTextOpenAI } from "./providers";

interface GenerationOptions {
    task: LlmTaskCategory;
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: any; // For Gemini
    expectJson?: boolean; // For OpenAI/Groq
    userPreferences: AiAssistantPreferences;
    googleApiKey: string;
    includeFooter?: boolean;
}

export const llmPipeline = async (options: GenerationOptions): Promise<string> => {
    const { task, prompt, systemInstruction, jsonSchema, expectJson, userPreferences, googleApiKey, includeFooter } = options;

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
    // Fallback to Gemini Flash as it is the most reliable generalist
    if (!candidates.includes('gemini-2.5-flash')) {
        candidates.push('gemini-2.5-flash');
    }

    const primaryModel = candidates[0];
    let lastError: Error | null = null;
    let usedModelId: string | null = null;
    let resultText = "";

    // 2. Iterate and Try
    for (const modelId of candidates) {
        const modelDef = getModelById(modelId);
        
        // If model definition is missing but ID looks like a Google model, assume Google (legacy compatibility)
        const isImplicitGoogle = !modelDef && (modelId.includes('gemini') || modelId.includes('gemma'));
        const provider = modelDef ? modelDef.provider : (isImplicitGoogle ? 'google' : null);

        if (!provider) continue;

        // Retrieve the correct API Key based on provider
        let currentApiKey = '';
        if (provider === 'google') currentApiKey = googleApiKey;
        else if (provider === 'groq') currentApiKey = userPreferences.groqApiKey || '';
        else if (provider === 'openrouter') currentApiKey = userPreferences.openRouterApiKey || '';

        // Skip if missing key (Exception: Google key is mandatory for app, so we assume it exists if we are here, but good to check)
        if (!currentApiKey) {
            console.warn(`[LLM Pipeline] Skipping ${modelId}: Missing API Key for ${provider}`);
            continue;
        }

        try {
            // console.log(`[LLM Pipeline] Executing ${task} via ${modelId} (${provider})...`);
            
            if (provider === 'google') {
                // --- NATIVE GOOGLE SDK ---
                const ai = new GoogleGenAI({ apiKey: currentApiKey });
                const config: any = {};
                
                // Gemma specific handling: No systemInstruction in config
                const isGemma = modelId.toLowerCase().includes('gemma');
                
                let finalContents: any[] = [];
                
                if (isGemma && systemInstruction) {
                    // Prepend system instruction to prompt for Gemma
                    finalContents = [{ role: 'user', parts: [{ text: `SYSTEM: ${systemInstruction}\n\nUSER: ${prompt}` }] }];
                } else {
                    if (systemInstruction) config.systemInstruction = systemInstruction;
                    finalContents = [{ role: 'user', parts: [{ text: prompt }] }];
                }
                
                // Handle JSON schema
                if (jsonSchema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = jsonSchema;
                } else if (expectJson) {
                    config.responseMimeType = "application/json";
                }

                const response = await ai.models.generateContent({
                    model: modelId,
                    contents: finalContents,
                    config: config
                });
                
                resultText = response.text || "";
                usedModelId = modelId;
                break; // Success

            } else {
                // --- OPENAI COMPATIBLE (Groq / OpenRouter) ---
                
                const result = await generateTextOpenAI(
                    provider as 'groq' | 'openrouter',
                    currentApiKey,
                    modelId,
                    prompt,
                    systemInstruction,
                    expectJson || !!jsonSchema // Enable JSON mode if schema was requested
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
        throw new Error(`All AI models failed for task '${task}'. Please check API keys in Settings. Last error: ${lastError?.message}`);
    }

    // 3. Attribution (Footer)
    // Only append footer if explicitly requested AND not JSON
    if (includeFooter && !expectJson && !jsonSchema && usedModelId) {
        const modelDef = getModelById(usedModelId);
        const modelName = modelDef ? modelDef.name : usedModelId;
        
        let footerHtml = '';
        if (usedModelId === primaryModel) {
             footerHtml = `\n\n<div class="text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-700/50 flex items-center gap-1"><span>⚡</span> Generated by <strong>${modelName}</strong></div>`;
        } else {
             const primaryDef = getModelById(primaryModel);
             const primaryName = primaryDef ? primaryDef.name : primaryModel;
             footerHtml = `\n\n<div class="text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-700/50 flex items-center gap-1"><span class="text-amber-500">⚠️</span> Fallback to <strong>${modelName}</strong> <span class="text-slate-500">(${primaryName} unavailable)</span></div>`;
        }
        
        resultText += footerHtml;
    }

    return resultText;
};
