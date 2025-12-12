
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
    
    let messages: any[] = [];
    
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }

    if (Array.isArray(input)) {
        // It's a chat history
        messages = [...messages, ...input];
    } else {
        // It's a single prompt
        messages.push({ role: "user", content: input });
    }

    const body: any = {
        model: model,
        messages: messages,
        temperature: 0.7,
    };

    if (jsonMode) {
        body.response_format = { type: "json_object" };
        // Ensure prompt asks for JSON to avoid provider errors
        const lastContent = messages[messages.length - 1].content;
        if (typeof lastContent === 'string' && !lastContent.toLowerCase().includes("json") && !systemInstruction?.toLowerCase().includes("json")) {
             messages[messages.length - 1].content += " \n\nIMPORTANT: Return valid JSON.";
        }
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                ...(provider === 'openrouter' ? { 
                    "HTTP-Referer": window.location.href, 
                    "X-Title": "JEE Dashboard" 
                } : {})
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${provider} API Error (${response.status}): ${errText}`);
        }

        const data: OpenAIChatResponse = await response.json();
        return data.choices[0]?.message?.content || "";

    } catch (error) {
        console.error(`${provider} Generation Failed:`, error);
        throw error;
    }
};
