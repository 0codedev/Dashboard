
interface OpenAIChatResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

const PROVIDER_URLS = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

export const generateTextOpenAI = async (
    provider: 'groq' | 'openrouter',
    apiKey: string,
    model: string,
    input: string | { role: string; content: string }[],
    systemInstruction?: string,
    jsonMode: boolean = false
): Promise<string> => {
    const url = PROVIDER_URLS[provider];
    
    if (!apiKey) {
        throw new Error(`Missing API Key for ${provider}. Please add it in Settings > Connectivity.`);
    }

    let messages: any[] = [];
    
    // System Instruction mapping
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }

    // Input mapping
    if (Array.isArray(input)) {
        messages = [...messages, ...input];
    } else {
        messages.push({ role: "user", content: input });
    }

    const body: any = {
        model: model,
        messages: messages,
        temperature: 0.7,
        stream: false // Explicitly disable streaming for this utility
    };

    // Strict JSON Mode handling
    if (jsonMode) {
        // CRITICAL FIX: Many OpenRouter free models (Mistral, Phi, Gemma) CRASH if response_format is sent.
        // We only enable the API-level JSON mode for models known to support it (OpenAI, Llama 3 on Groq, etc.)
        const modelName = model.toLowerCase();
        const supportsJsonParam = 
            modelName.includes('gpt') || 
            (provider === 'groq' && modelName.includes('llama-3')) ||
            modelName.includes('deepseek-r1') || // R1 usually handles it
            modelName.includes('qwen');

        if (supportsJsonParam) {
            body.response_format = { type: "json_object" };
        }
        
        // Safety: Ensure the prompt actually mentions JSON for ALL models (especially those where we stripped the param)
        const lastMsg = messages[messages.length - 1];
        if (typeof lastMsg.content === 'string' && 
            !lastMsg.content.toLowerCase().includes('json') && 
            !systemInstruction?.toLowerCase().includes('json')) {
             messages[messages.length - 1].content += " \n\nIMPORTANT: Return the result strictly as a valid JSON object. Do not wrap in markdown code blocks.";
        }
    }

    try {
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };

        if (provider === 'openrouter') {
            headers["HTTP-Referer"] = typeof window !== 'undefined' ? window.location.href : "https://jeedashboard.app";
            headers["X-Title"] = "JEE Performance Dashboard";
        }

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            let errMsg = `${provider} API Error (${response.status})`;
            try {
                const errJson = JSON.parse(errText);
                errMsg += `: ${errJson.error?.message || errText}`;
            } catch {
                errMsg += `: ${errText}`;
            }
            throw new Error(errMsg);
        }

        const data: OpenAIChatResponse = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error(`${provider} returned no content choices.`);
        }

        return data.choices[0]?.message?.content || "";

    } catch (error: any) {
        console.error(`${provider} Generation Failed:`, error);
        throw new Error(error.message || `Failed to connect to ${provider}`);
    }
};
