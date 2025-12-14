
// ... [Previous imports]
import { GoogleGenAI, Type } from "@google/genai";
import { QuestionStatus, type TestReport, type QuestionLog, QuizQuestion, DailyTask, UserProfile, TestType, TestSubType, ModelInfo, AiAssistantPreferences, Flashcard } from "../types";
import { getMarkingScheme } from "../utils/metrics";
import { llmPipeline } from "./llm";
import { semanticSearch } from "./vectorStore";

// ... [Existing helper functions: fileToGenerativePart, encodeAudio, decodeAudio, decodeAudioData - NO CHANGES]

export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export function encodeAudio(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// ... [RAG Service - NO CHANGES]

export const retrieveRelevantContext = async (
    query: string, 
    logs: QuestionLog[], 
    apiKey: string
): Promise<string> => {
    try {
        const semanticResults = await semanticSearch(query, 5);
        if (semanticResults.length > 0) {
            return `Relevant Past Performance History:\n${semanticResults.map(r => r.content).join('\n---\n')}`;
        }
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
        const relevantLogs = logs.filter(l => {
            const content = `${l.topic} ${l.reasonForError} ${l.subject}`.toLowerCase();
            return keywords.some(k => content.includes(k));
        }).slice(-10);

        if (relevantLogs.length === 0) {
             const recentErrors = logs.filter(l => l.status === QuestionStatus.Wrong).slice(-5);
             return recentErrors.length ? `Recent Errors:\n${recentErrors.map(l => `${l.topic}: ${l.reasonForError}`).join('\n')}` : "";
        }
        return `Context based on keywords:\n${relevantLogs.map(l => `${l.topic} (${l.subject}): ${l.reasonForError || 'Error'}`).join('\n')}`;
    } catch (e) {
        console.error("RAG Retrieval failed:", e);
        return "";
    }
};

// ... [LLM Helper functions like validateOCRData, inferTestMetadata, etc. - NO CHANGES]
// Helper to get dummy prefs for internal calls if not passed
const getMockPrefs = (apiKey: string): AiAssistantPreferences => {
    try {
        const stored = localStorage.getItem('aiAssistantPreferences_v1');
        if (stored) return JSON.parse(stored);
    } catch {}
    return { model: 'gemini-2.5-flash', responseLength: 'medium', tone: 'neutral' };
}

export const validateOCRData = async (report: Partial<TestReport>, logs: Partial<QuestionLog>[], apiKey: string): Promise<string[]> => {
    const prompt = `Perform a sanity check on JEE test data. Report: ${JSON.stringify(report)}. Logs count: ${logs.length}. Check for mark mismatches and logic errors. Return JSON with 'warnings' array of strings.`;
    try {
        const res = await llmPipeline({
            task: 'analysis',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).warnings || [];
    } catch { return []; }
};

export const inferTestMetadata = async (testName: string, apiKey: string): Promise<{ type: TestType, subType: TestSubType }> => {
    // This is now redundant for OCR flow but kept for manual entry if needed
    const prompt = `Infer JEE Test Type/SubType from name "${testName}". Return JSON {type: string, subType: string}.`;
    try {
        const res = await llmPipeline({
            task: 'planning', 
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        const json = JSON.parse(res);
        return { 
            type: json.type as TestType || TestType.ChapterTest, 
            subType: json.subType as TestSubType || TestSubType.JEEMains 
        };
    } catch { return { type: TestType.ChapterTest, subType: TestSubType.JEEMains }; }
};

export const getAIAnalysis = async (reports: TestReport[], logs: QuestionLog[], apiKey: string, modelName?: string): Promise<string> => {
    const prompt = `Analyze this JEE student performance. Reports: ${JSON.stringify(reports.slice(-3))}. Weak Topics: ${JSON.stringify(logs.slice(-20))}. Provide comprehensive Markdown report with strategy.`;
    return await llmPipeline({
        task: 'analysis',
        prompt,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateStudyPlan = async (reports: TestReport[], logs: QuestionLog[], apiKey: string, modelName?: string): Promise<string> => {
    const prompt = `Create a 7-day JEE study plan based on this data. Output Markdown. Data: ${JSON.stringify(reports.slice(-2))}`;
    return await llmPipeline({
        task: 'planning',
        prompt,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateContextualInsight = async (promptData: string, apiKey: string): Promise<string> => {
    return await llmPipeline({
        task: 'chat',
        prompt: `Analyze data and give 1 sentence insight: ${promptData}`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateDashboardInsight = async (reports: TestReport[], apiKey: string): Promise<string> => {
    return await llmPipeline({
        task: 'creative',
        prompt: `Review these 3 recent scores: ${JSON.stringify(reports.slice(-3))}. Give 1 motivating sentence.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateChartAnalysis = async (chartTitle: string, dataSummary: string, apiKey: string): Promise<string> => {
    return await llmPipeline({
        task: 'chat',
        prompt: `Analyze chart "${chartTitle}": ${dataSummary}. 1 sentence summary.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const getDailyQuote = async (apiKey: string): Promise<string> => {
    return await llmPipeline({
        task: 'creative',
        prompt: "Give me a short, powerful motivation quote for a student. No author name.",
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateChecklistFromPlan = async (weakTopics: string[], apiKey: string): Promise<string[]> => {
    const prompt = `Create 5 checklist items for these weak topics: ${weakTopics.join(', ')}. Return JSON { checklist: string[] }`;
    try {
        const res = await llmPipeline({
            task: 'planning',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).checklist || [];
    } catch { return ["Review notes", "Solve problems"]; }
};

export const generateEndOfDaySummary = async (goals: any[], checklist: any[], apiKey: string): Promise<string> => {
    return await llmPipeline({
        task: 'creative',
        prompt: `Summarize my study day. Goals: ${JSON.stringify(goals)}. Checklist: ${JSON.stringify(checklist)}. Be encouraging.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const getAIChiefAnalystSummary = async (weakTopics: any, errorReasons: any, correlations: any, apiKey: string, improvise: boolean, model?: string): Promise<string> => {
    const prompt = `Act as Chief Analyst. Data: Weakness ${JSON.stringify(weakTopics)}, Errors ${JSON.stringify(errorReasons)}. ${improvise ? 'Provide a counter-intuitive insight.' : 'Provide executive summary.'}`;
    return await llmPipeline({
        task: 'analysis', 
        prompt,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateFocusedStudyPlan = async (subject: string, weakTopics: string[], apiKey: string, model?: string): Promise<string> => {
    return await llmPipeline({
        task: 'planning',
        prompt: `Create 3-day recovery plan for ${subject}. Weakness: ${weakTopics.join(', ')}. Markdown format.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const explainTopic = async (topic: string, apiKey: string, complexity: 'standard'|'simple', model?: string): Promise<string> => {
    return await llmPipeline({
        task: 'chat',
        prompt: `Explain '${topic}' for JEE student. Complexity: ${complexity}. Markdown.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateGatekeeperQuiz = async (topic: string, apiKey: string, model?: string): Promise<QuizQuestion[]> => {
    const prompt = `Generate 3 conceptual MCQ for '${topic}' JEE level. Return JSON { quiz: [{question, options:{A,B,C,D}, answer: "A", explanation}] }`;
    try {
        const res = await llmPipeline({
            task: 'math',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).quiz || [];
    } catch { return []; }
};

export const generateTasksFromGoal = async (goalText: string, apiKey: string, model?: string): Promise<{ task: string, time: number }[]> => {
    const prompt = `Break goal '${goalText}' into 3 tasks with time. Return JSON { tasks: [{task, time}] }`;
    try {
        const res = await llmPipeline({
            task: 'planning',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).tasks || [];
    } catch { return []; }
};

export const generateSmartTasks = async (weakTopics: string[], apiKey: string, model?: string): Promise<{ task: string; time: number; topic: string; }[]> => {
    const prompt = `Suggest 3 tasks for weak topics: ${weakTopics.join(', ')}. Return JSON { tasks: [{task, time, topic}] }`;
    try {
        const res = await llmPipeline({
            task: 'planning',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).tasks || [];
    } catch { return []; }
};

export const generateSmartTaskOrder = async (tasks: DailyTask[], userProfile: UserProfile, logs: QuestionLog[], apiKey: string, model?: string): Promise<string[]> => {
    const prompt = `Reorder tasks for max efficiency. Profile: ${JSON.stringify(userProfile.studyTimes)}. Tasks: ${JSON.stringify(tasks)}. Return JSON { orderedIds: string[] }`;
    try {
        const res = await llmPipeline({
            task: 'planning',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).orderedIds || tasks.map(t => t.id);
    } catch { return tasks.map(t => t.id); }
};

export const generateLearningPath = async (topic: string, weaknesses: string[], apiKey: string, model?: string): Promise<{ task: string; time: number; topic: string; }[]> => {
    const prompt = `Create learning path for '${topic}'. Weak prerequisites: ${weaknesses.join(', ')}. Return JSON { path: [{task, time, topic}] }`;
    try {
        const res = await llmPipeline({
            task: 'planning',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).path || [];
    } catch { return []; }
};

export const generateNextWhy = async (context: string, prevAnswer: string, step: number, apiKey: string, model?: string): Promise<{ question: string; isFinal: boolean; solution?: string }> => {
    const prompt = `Socratic 5 Whys. Context: ${context}. Prev: ${prevAnswer}. Step ${step}/5. Return JSON { question, isFinal, solution? }`;
    try {
        const res = await llmPipeline({
            task: 'analysis',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res);
    } catch { return { question: "Why?", isFinal: false }; }
};

export const generatePreMortem = async (topic: string, prereqs: string[], errors: string[], apiKey: string, model?: string): Promise<string> => {
    return await llmPipeline({
        task: 'analysis',
        prompt: `Pre-mortem for '${topic}'. Prereq errors: ${errors.join('; ')}. Predict hurdles.`,
        userPreferences: getMockPrefs(apiKey),
        googleApiKey: apiKey
    });
};

export const generateOracleDrill = async (
    errorStats: { topic: string; reason: string; count: number }[], 
    apiKey: string, 
    model?: string
): Promise<QuizQuestion[]> => {
    const topWeaknesses = errorStats.slice(0, 3);
    const topicsContext = topWeaknesses.map(w => `${w.topic} (Failure Pattern: ${w.reason})`).join(', ');
    
    const prompt = `
    Generate a 'Predictive Drill' of 5 JEE Advanced level Multiple Choice Questions.
    Focus specifically on these student weaknesses: ${topicsContext}.
    Design questions that trap the student into making the specific errors listed.
    Return strictly JSON: { "quiz": [ { "question": "", "options": {"A":"", "B":""...}, "answer": "A", "explanation": "" } ] }
    `;
    
    try {
        const res = await llmPipeline({
            task: 'math',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        return JSON.parse(res).quiz || [];
    } catch (e) {
        console.error("Oracle Generation Failed", e);
        return [];
    }
};

export const generateFlashcards = async (topics: string[], apiKey: string): Promise<Flashcard[]> => {
    const prompt = `
    Generate 3 conceptual JEE flashcards for: ${topics.join(', ')}.
    Return JSON array: [ { "topic": "", "front": "", "back": "", "difficulty": "Medium" } ]
    `;

    try {
        const res = await llmPipeline({
            task: 'math',
            prompt,
            expectJson: true,
            userPreferences: getMockPrefs(apiKey),
            googleApiKey: apiKey
        });
        const parsed = JSON.parse(res);
        return (parsed.flashcards || parsed || []).map((card: any, index: number) => ({
            id: `fc-${Date.now()}-${index}`,
            topic: card.topic,
            front: card.front,
            back: card.back,
            difficulty: card.difficulty,
            nextReview: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
            reviews: 0
        }));
    } catch (e) {
        console.error("Flashcard generation failed", e);
        throw new Error("Failed to generate flashcards.");
    }
};

// ... [GENUI_TOOLS, getAvailableModels - NO CHANGES]
export const GENUI_TOOLS = [
    {
        name: "renderChart",
        description: "Renders a visual chart in the chat.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                chartType: { type: Type.STRING, enum: ["bar", "line", "pie"] },
                data: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER }, label: { type: Type.STRING } }
                    }
                },
                xAxisLabel: { type: Type.STRING }
            },
            required: ["title", "chartType", "data"]
        }
    },
    {
        name: "createActionPlan",
        description: "Creates an interactive checklist.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { task: { type: Type.STRING }, priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] } }
                    }
                }
            },
            required: ["title", "items"]
        }
    },
    {
        name: "renderDiagram",
        description: "Generates SVG diagram code.",
        parameters: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, svgContent: { type: Type.STRING }, description: { type: Type.STRING } },
            required: ["title", "svgContent"]
        }
    },
    {
        name: "createMindMap",
        description: "Creates hierarchical mind map.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                root: { 
                    type: Type.OBJECT,
                    properties: { label: { type: Type.STRING }, children: { type: Type.ARRAY, items: { type: Type.OBJECT } } },
                    required: ["label"]
                }
            },
            required: ["root"]
        }
    }
];

export const getAvailableModels = async (apiKey: string): Promise<ModelInfo[]> => {
    return [
        { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Main Model' },
        { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', description: 'Budget Friendly' }
    ];
};

// --- OCR Function (UPDATED PROMPT) ---
export const extractDataFromImage = async (
    scoreSheetFile: File,
    apiKey: string,
    modelName: string = "gemini-2.5-flash", 
    instructionSheetFile?: File
): Promise<{ report: Partial<TestReport>, questions: Partial<QuestionLog>[], confidence: Record<string, 'high'|'medium'|'low'> }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const scoreSheetPart = await fileToGenerativePart(scoreSheetFile);
    const parts: any[] = [scoreSheetPart];
    
    if (instructionSheetFile) {
        const instructionPart = await fileToGenerativePart(instructionSheetFile);
        parts.push(instructionPart);
    }

    const prompt = `
    You are an expert OCR system for JEE Test Reports. Your task is to extract data and fill in the blanks using a single pass logic.
    
    **INSTRUCTIONS:**
    
    **1. HEADER & SUMMARY (STEP 2):**
       - **TEST NAME**: Look specifically at the 4th row or the main header for "TEST". Extract the code (e.g., "WTA-22", "CTA-15", "WTA-05").
       - **DATE**: Look for the date in the header section. Format as YYYY-MM-DD.
       - **MARKS & RANK**: Look at the top-right summary table.
         - Columns usually are: Subject | Marks | % | Rank.
         - **CRITICAL**: Ignore the '%' or 'Percentage' column. Look for 'MARKS' which are INTEGERS (e.g. 42, 25, 8). Do NOT pick decimals like 13.33.
         - Extract Marks and Ranks for Maths, Physics, Chemistry, and Total.
       - **LOGIC FOR TYPE/SUBTYPE**:
         - If Name contains "CTA" -> type = "Part Test"
         - If Name contains "WTA" -> type = "Chapter Test"
         - If Name contains "Full" or "Mock" -> type = "Full Syllabus Mock"
         - Count the total questions in the grid below.
           - If Total Questions < 75 -> subType = "JEE Advanced"
           - If Total Questions >= 75 -> subType = "JEE Mains"
    
    **2. QUESTION GRID (STEP 3) - DO NOT CHANGE LOGIC:**
       - If an Instruction Sheet is provided, look at columns: "Section Name" | "Question Type" | "+Ve Marks" | "-Ve Marks".
       - Construct \`questionType\` EXACTLY as: \`[Standard Name] (+[Pos], [Neg])\`.
       - Standard Names: "Single Correct", "Multiple Correct", "Integer", "Matrix Match".
       - Example: If instructions say "Sec-I: Single Correct, +3, -1", then for every Q in Sec-I, \`questionType\` is "Single Correct (+3, -1)".
       - Also populate \`positiveMarks\`=3 and \`negativeMarks\`=-1.
       - **STATUS**: Map 'U'/- -> 'Unanswered', 'W' -> 'Wrong', 'C'/'R' -> 'Fully Correct'.
    
    **RETURN JSON:**
    {
      "testName": "string",
      "testDate": "YYYY-MM-DD",
      "type": "Part Test" | "Chapter Test" | "Full Syllabus Mock",
      "subType": "JEE Advanced" | "JEE Mains",
      "physics": { "marks": number, "rank": number, "correct": number, "wrong": number, "unanswered": number, "partial": number },
      "chemistry": { "marks": number, "rank": number, "correct": number, "wrong": number, "unanswered": number, "partial": number },
      "maths": { "marks": number, "rank": number, "correct": number, "wrong": number, "unanswered": number, "partial": number },
      "total": { "marks": number, "rank": number, "correct": number, "wrong": number, "unanswered": number, "partial": number },
      "questions": [
        {
          "questionNumber": number,
          "subject": "physics" | "chemistry" | "maths",
          "status": "Fully Correct" | "Wrong" | "Unanswered" | "Partially Correct",
          "questionType": "string (e.g. Single Correct (+3, -1))",
          "positiveMarks": number,
          "negativeMarks": number,
          "marksAwarded": number
        }
      ]
    }
    `;
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Strict override for Vision
        contents: { parts: parts },
        config: {
            responseMimeType: "application/json",
        },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    return { 
        report: parsedJson || {}, 
        questions: parsedJson.questions || [], 
        confidence: { physics: 'high', chemistry: 'high', maths: 'high', total: 'high' } 
    };
  } catch (error) {
    console.error("Error extracting data:", error);
    throw new Error(`Failed to process image. API Key or Model might be invalid.`);
  }
};
