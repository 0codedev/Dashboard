
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { QuestionStatus, type TestReport, type QuestionLog, QuizQuestion, DailyTask, UserProfile, TestType, TestSubType } from "../types";


// Helper function to convert a File object to a a base64 string
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

// --- Audio Helpers for Gemini Live ---

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

// --- RAG Service (Client-Side) ---

export const getEmbeddings = async (text: string, apiKey: string): Promise<number[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Corrected API call: contents (plural) and embeddings (plural)
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: [{ parts: [{ text }] }],
        });
        return response.embeddings?.[0]?.values || [];
    } catch (e) {
        console.error("Embedding failed", e);
        return [];
    }
};

const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    return dotProduct / (magnitudeA * magnitudeB);
};

export const retrieveRelevantContext = async (
    query: string, 
    logs: QuestionLog[], 
    apiKey: string
): Promise<string> => {
    // Optimization: In a real app, we would cache embeddings of logs.
    // For now, we create a textual summary of errors and embed that for "topic match"
    // or simple keyword search if embeddings are too expensive per request.
    
    // Lightweight approach:
    const queryEmbedding = await getEmbeddings(query, apiKey);
    if (queryEmbedding.length === 0) return "";

    // Group logs by topic to create searchable chunks
    const topicMap = new Map<string, string[]>();
    logs.forEach(l => {
        if (l.status === QuestionStatus.Wrong) {
            const key = l.topic;
            const entry = `Error in ${l.subject}, ${l.topic}: ${l.reasonForError || 'Unknown reason'}.`;
            if (!topicMap.has(key)) topicMap.set(key, []);
            topicMap.get(key)?.push(entry);
        }
    });

    const chunks: { text: string, embedding?: number[] }[] = [];
    
    // Only take top 10 topics by error count to keep embedding request low
    const topTopics = Array.from(topicMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

    for (const [topic, entries] of topTopics) {
        const summary = `Topic: ${topic}. History: ${entries.slice(0, 5).join(' ')}`;
        chunks.push({ text: summary });
    }

    // Note: Generating embeddings for all chunks in client-side is rate-limit prone.
    // Fallback to simple keyword matching + recent errors for this demo to ensure stability.
    
    const relevantChunks = chunks.filter(c => 
        query.toLowerCase().includes(c.text.split(':')[1].split('.')[0].trim().toLowerCase())
    );

    if (relevantChunks.length > 0) {
        return `RELEVANT PAST MISTAKES FOUND:\n${relevantChunks.map(c => c.text).join('\n')}`;
    }
    
    // Fallback context
    const recentErrors = logs.filter(l => l.status === QuestionStatus.Wrong).slice(-5);
    return `RECENT ERRORS:\n${JSON.stringify(recentErrors.map(l => ({ topic: l.topic, reason: l.reasonForError })))}`;
};

// --- GenUI Tools ---

export const GENUI_TOOLS = [
    {
        name: "renderChart",
        description: "Renders a visual chart in the chat. Use this when the user asks for analysis, trends, or comparisons.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Title of the chart" },
                chartType: { type: Type.STRING, enum: ["bar", "line", "pie"] },
                data: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            value: { type: Type.NUMBER },
                            label: { type: Type.STRING }
                        }
                    }
                },
                xAxisLabel: { type: Type.STRING }
            },
            required: ["title", "chartType", "data"]
        }
    },
    {
        name: "createActionPlan",
        description: "Creates an interactive checklist for a study plan.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            task: { type: Type.STRING },
                            priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
                        }
                    }
                }
            },
            required: ["title", "items"]
        }
    },
    {
        name: "renderDiagram",
        description: "Generates a visual diagram using SVG code. Use this to explain physics concepts (forces, optics), math geometry, or chemistry structures.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Title of the diagram" },
                svgContent: { type: Type.STRING, description: "The full SVG XML code string. Ensure it has a viewBox." },
                description: { type: Type.STRING, description: "Brief explanation of what the diagram shows." }
            },
            required: ["title", "svgContent"]
        }
    },
    {
        name: "createMindMap",
        description: "Creates a hierarchical mind map structure to visualize complex topics.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                root: { 
                    type: Type.OBJECT,
                    description: "The root node of the mind map",
                    properties: {
                        label: { type: Type.STRING },
                        children: { 
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    children: { type: Type.ARRAY, items: { type: Type.OBJECT } } // simplified recursive definition
                                }
                            }
                        }
                    },
                    required: ["label"]
                }
            },
            required: ["root"]
        }
    }
];

// --- Original Service Functions ---

const subjectSchemaWithConfidence = {
    type: Type.OBJECT,
    properties: {
        marks: { type: Type.NUMBER },
        rank: { type: Type.NUMBER },
        correct: { type: Type.NUMBER },
        wrong: { type: Type.NUMBER },
        unanswered: { type: Type.NUMBER },
        partial: { type: Type.NUMBER },
        confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "The AI's confidence in the accuracy of the extracted data for this subject." }
    },
    required: ["marks", "rank", "correct", "wrong", "unanswered", "partial", "confidence"],
};

export const extractDataFromImage = async (imageFile: File, apiKey: string): Promise<{ report: Partial<TestReport>, questions: Partial<QuestionLog>[], confidence: Record<string, 'high'|'medium'|'low'> }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `You are an expert OCR system for academic reports. Extract key data points from the image of a JEE test report.

    1.  **Summary Data:** Extract Test Date, Test Name, and subject-wise details for Physics, Chemistry, Maths, and the Total. For each subject, extract:
        *   \`marks\`: The absolute score. **Crucially, ignore any percentage values (e.g., values with a '%' sign).**
        *   \`rank\`: The rank obtained.
        *   \`correct\`: The count of correct answers.
        *   \`wrong\`: The count of wrong answers.
        *   \`unanswered\`: The count of unanswered questions.
        *   \`partial\`: The count of partially correct answers.
        *   \`confidence\`: Your confidence level ('high', 'medium', or 'low') for the extracted data in this subject block. Be more cautious (medium/low) if the handwriting is messy, the image is blurry, or values are ambiguous.

    2.  **Question Data:** If the image contains a detailed question-by-question breakdown, extract each row. For each question, provide:
        *   \`questionNumber\`: The question number.
        *   \`subject\`: The subject (Physics, Chemistry, or Maths).
        *   \`questionType\`: The type of question (e.g., 'Single Correct (+4 -1)', 'Integer (+3 0)').
        *   \`status\`: The student's result for the question (e.g., 'Unanswered', 'Wrong', 'Fully Correct', 'Partially Correct').

    Return the data as a single JSON object that strictly follows the provided schema. If a value is not found, use a reasonable default like 0 for numbers or an empty string for text.`;

    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    testDate: { type: Type.STRING, description: "Format as YYYY-MM-DD" },
                    testName: { type: Type.STRING },
                    physics: subjectSchemaWithConfidence,
                    chemistry: subjectSchemaWithConfidence,
                    maths: subjectSchemaWithConfidence,
                    total: subjectSchemaWithConfidence,
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                questionNumber: { type: Type.NUMBER },
                                subject: { type: Type.STRING, enum: ["physics", "chemistry", "maths"] },
                                questionType: { type: Type.STRING },
                                status: { type: Type.STRING, description: "Full text status like 'Fully Correct', 'Wrong', 'Unanswered', 'Partially Correct'." },
                                answered: { type: Type.STRING },
                                finalKey: { type: Type.STRING },
                            },
                             required: ["questionNumber", "subject", "status", "questionType"],
                        }
                    }
                },
                 required: ["testDate", "testName", "physics", "chemistry", "maths", "total"],
            },
        },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    const confidence = {
        physics: parsedJson.physics?.confidence,
        chemistry: parsedJson.chemistry?.confidence,
        maths: parsedJson.maths?.confidence,
        total: parsedJson.total?.confidence,
    };

    const cleanSubjectData = (subject: any) => {
        if (!subject) return {};
        const { confidence, ...rest } = subject;
        return rest;
    };

    const report: Partial<TestReport> = {
        testDate: parsedJson.testDate,
        testName: parsedJson.testName,
        physics: cleanSubjectData(parsedJson.physics),
        chemistry: cleanSubjectData(parsedJson.chemistry),
        maths: cleanSubjectData(parsedJson.maths),
        total: cleanSubjectData(parsedJson.total),
    };

    const statusStringToEnum = (statusStr: string): QuestionStatus => {
        const normalizedStatus = (statusStr || '').trim().toLowerCase().replace(/\s+/g, '');
        for (const enumKey in QuestionStatus) {
            const enumValue = QuestionStatus[enumKey as keyof typeof QuestionStatus];
            if (enumValue.toLowerCase().replace(/\s+/g, '') === normalizedStatus) {
                return enumValue;
            }
        }
        if (normalizedStatus === 'c' || normalizedStatus === 'correct') return QuestionStatus.FullyCorrect;
        if (normalizedStatus === 'w') return QuestionStatus.Wrong;
        if (normalizedStatus === 'u') return QuestionStatus.Unanswered;
        
        return QuestionStatus.Unanswered; // Default fallback
    };


    const questions: Partial<QuestionLog>[] = (parsedJson.questions || []).map((q: any) => ({
        subject: q.subject,
        questionNumber: q.questionNumber,
        questionType: q.questionType,
        status: statusStringToEnum(q.status),
        answered: q.answered,
        finalKey: q.finalKey,
    }));

    return { report, questions, confidence };
  } catch (error) {
    console.error("Error extracting data from image:", error);
    throw new Error("Failed to process the image with Gemini API. Please check the console for details.");
  }
};

export const validateOCRData = async (report: Partial<TestReport>, logs: Partial<QuestionLog>[], apiKey: string): Promise<string[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Perform a sanity check on the following extracted JEE test data.
        
        Report Summary: ${JSON.stringify(report)}
        Extracted Question Count: ${logs.length}
        
        Check for:
        1. Mathematical consistency: Does Correct + Wrong + Unanswered roughly match typical paper patterns?
        2. Scoring logic: Does the score seem consistent with the number of correct/wrong answers (assuming approx +4/-1)?
        3. Missing data: Are major fields like Total Score or Rank missing?
        
        Return a JSON object with a list of warning strings. If everything looks good, return an empty list.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        warnings: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["warnings"]
                }
            }
        });

        const json = JSON.parse(response.text.trim());
        return json.warnings || [];
    } catch (e) {
        console.error("Validation failed", e);
        return ["Could not perform AI validation."];
    }
};

export const inferTestMetadata = async (testName: string, apiKey: string): Promise<{ type: TestType, subType: TestSubType }> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Infer the most likely Test Type and Sub-Type from this test name: "${testName}".
        
        Options for Type: "Full Syllabus Mock", "Chapter Test", "Part Test", "Previous Year Paper".
        Options for Sub-Type: "JEE Mains", "JEE Advanced".
        
        If ambiguous, default to "Chapter Test" and "JEE Mains".
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        subType: { type: Type.STRING }
                    },
                    required: ["type", "subType"]
                }
            }
        });
        
        const json = JSON.parse(response.text.trim());
        return { 
            type: json.type as TestType || TestType.ChapterTest, 
            subType: json.subType as TestSubType || TestSubType.JEEMains 
        };
    } catch (e) {
        return { type: TestType.ChapterTest, subType: TestSubType.JEEMains };
    }
};


export const getAIAnalysis = async (reports: TestReport[], logs: QuestionLog[], apiKey: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const simplifiedReports = reports.map(r => ({
      testName: r.testName,
      testDate: r.testDate,
      total: r.total,
      physics: r.physics,
      chemistry: r.chemistry,
      maths: r.maths,
      metrics: {
        total: r.totalMetrics,
        physics: r.physicsMetrics,
        chemistry: r.chemistryMetrics,
        maths: r.mathsMetrics,
      }
    }));

    const errorAnalysis = logs.reduce((acc: { reasons: Record<string, number>; weakTopics: Record<string, number> }, log) => {
        if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) {
            if (log.reasonForError) {
                acc.reasons[log.reasonForError] = (acc.reasons[log.reasonForError] || 0) + 1;
            }
            if (log.topic && log.topic !== 'N/A') {
                acc.weakTopics[log.topic] = (acc.weakTopics[log.topic] || 0) + 1;
            }
        }
        return acc;
    }, { reasons: {}, weakTopics: {} });

    const topWeakTopics = Object.entries(errorAnalysis.weakTopics)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

    const topErrorReasons = Object.entries(errorAnalysis.reasons)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([reason, count]) => ({ reason, count }));

    const prompt = `You are an expert performance analyst for a student preparing for the JEE, a highly competitive engineering entrance exam. The student's performance data from a series of mock tests is provided below.

    **Performance Data:**
    ${JSON.stringify(simplifiedReports, null, 2)}

    **Error Analysis Summary:**
    - Top Weak Topics (from incorrect and partially correct answers): ${JSON.stringify(topWeakTopics)}
    - Top Reasons for Errors: ${JSON.stringify(topErrorReasons)}

    Please provide a comprehensive and visually appealing analysis of the student's performance. Structure your response in Markdown format.

    **CRITICAL: Interactive Elements**
    If you identify a specific actionable step involving a topic, use a special "Action Token" in your text.
    - To suggest a focus session: \`{{FOCUS:Topic Name}}\`
    - To suggest reviewing concepts: \`{{REVIEW:Topic Name}}\`
    - Example: "Your weakness in {{FOCUS:Rotational Motion}} is evident. You should also {{REVIEW:Thermodynamics}}."
    The UI will convert these tokens into interactive buttons.

    Your analysis must cover:

    ### Overall Performance Trend
    - Analyze the trend in total score and rank.
    - Comment on consistency and improvement.

    ### Subject-wise Strengths and Weaknesses
    - Identify the strongest and weakest subjects.
    - Provide specific data points.

    ### Actionable Recommendations
    - Based on error analysis, provide advice.
    - Use the Action Tokens (e.g., \`{{FOCUS:Topic}}\`) for key recommendations so the student can act immediately.

    ### Performance Projection
    - A brief, encouraging projection of future performance.

    Keep the tone professional, encouraging, and highly analytical.`;

    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });

    return response.text;

  } catch (error) {
    console.error("Error getting AI analysis:", error);
    throw new Error("Failed to get AI analysis. Please check your API Key and console for details.");
  }
};

export const generateStudyPlan = async (reports: TestReport[], logs: QuestionLog[], apiKey: string): Promise<string> => {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const simplifiedReports = reports.map(r => ({
          testName: r.testName,
          total: r.total,
          metrics: r.totalMetrics
        }));

        const errorAnalysis = logs.reduce((acc: { reasons: Record<string, number>, weakTopics: Record<string, number> }, log) => {
          if (log.reasonForError) {
            const reason = log.reasonForError;
            acc.reasons[reason] = (acc.reasons[reason] || 0) + 1;
          }
           if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) {
              const topic = log.topic;
              if (topic && topic !== 'N/A') {
                acc.weakTopics[topic] = (acc.weakTopics[topic] || 0) + 1;
              }
          }
          return acc;
        }, { reasons: {}, weakTopics: {} });


        const prompt = `You are an expert academic coach for a student preparing for the JEE, a highly competitive engineering entrance exam. I will provide you with the student's recent performance data and their error logs.

        Performance Data (last few tests):
        ${JSON.stringify(simplifiedReports, null, 2)}

        Error Analysis Summary:
        ${JSON.stringify(errorAnalysis, null, 2)}

        Based on this comprehensive data, create a personalized and actionable 7-day study plan. The student needs to improve their weak areas and build on their strengths.

        Your plan MUST include:
        1.  **A Day-by-Day Schedule:** From Day 1 to Day 7.
        2.  **Topic Focus:** For each day, specify which topics to study from Physics, Chemistry, and Maths. Prioritize topics that appear frequently in the error logs as "weakTopics".
        3.  **Time Allocation:** Suggest a realistic time breakdown for each day (e.g., Morning: 2 hrs Physics, Afternoon: 3 hrs Maths, etc.).
        4.  **Actionable Strategies:** Provide specific advice based on the "common reasons for errors". For example, if "Silly Mistake" is high, suggest techniques like double-checking calculations or reading the question carefully. If "Conceptual Gap" is high, recommend focusing on fundamentals for certain topics.
        5.  **Practice & Revision:** Integrate time for practicing problems, revising previous topics, and maybe one short mock test towards the end of the week.

        Format your response in clear Markdown. Use '###' for day headings and '*' for list items. The tone should be motivating and encouraging.`;

        // UPGRADED MODEL: Using gemini-2.5-flash for stability
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts: [{ text: prompt }] },
        });

        return response.text;
      } catch (error) {
        console.error("Error generating study plan:", error);
        throw new Error("Failed to generate the study plan. Please try again.");
      }
    };
    
export const generateContextualInsight = async (prompt: string, apiKey: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const fullPrompt = `You are a concise JEE performance analyst. Analyze the following data and provide one single, encouraging, and data-driven sentence (max 30 words). Focus on the most significant trend or observation.
    
    Data & Context:
    ${prompt}
    
    Insight:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: fullPrompt }] },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating contextual insight:", error);
    return "Could not generate an insight at the moment.";
  }
};

export const generateDashboardInsight = async (reports: TestReport[], apiKey: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const recent = reports.slice(-3).map(r => ({ name: r.testName, score: r.total.marks, rank: r.total.rank }));
    const prompt = `Analyze these last 3 test results for a JEE student: ${JSON.stringify(recent)}.
    Provide ONE single, high-impact, motivating insight or observation (max 25 words).
    Example: "Your Physics score has stabilized, but consistency in Maths is key to breaking the top 1000."`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });
    return response.text.trim();
  } catch (e) {
    return "Consistency is the key to mastery. Keep pushing!";
  }
};

export const generateChartAnalysis = async (chartTitle: string, dataSummary: string, apiKey: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analyze this data for the chart "${chartTitle}": ${dataSummary}. Provide a single, concise sentence (max 20 words) summarizing the key takeaway for a student.`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim();
    } catch (e) {
        return "";
    }
};

export const getDailyQuote = async (apiKey: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = "Give me a short, powerful, and inspiring motivational quote for a student preparing for a highly competitive exam. The quote should be less than 25 words. Do not include the author's name.";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim().replace(/"/g, ''); // Clean up quotes from the response
    } catch (error) {
        console.error("Error fetching daily quote:", error);
        return "The journey of a thousand miles begins with a single step."; // Fallback quote
    }
};

export const generateChecklistFromPlan = async (weakTopics: string[], apiKey: string): Promise<string[]> => {
  if (weakTopics.length === 0) {
    return ["Review class notes for a key subject.", "Solve 10 practice problems.", "Plan tomorrow's study session."];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an academic coach for a student preparing for the JEE exam. Based on their identified weak topics: ${weakTopics.join(', ')}. Create a short list of 5 concrete, actionable checklist items for their daily plan. The items should be concise phrases.`;
    
    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    checklist: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING
                        },
                        description: "An array of 5 short, actionable checklist items."
                    }
                },
                required: ["checklist"],
            },
        },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    return parsedJson.checklist;

  } catch (error) {
    console.error("Error generating checklist:", error);
    return ["Review concepts for one weak topic.", "Practice 10 problems from that topic.", "Read a chapter from a textbook."];
  }
};

export const generateEndOfDaySummary = async (
  goals: { text: string; completed: boolean; linkedTopic?: string }[],
  checklistItems: { text: string; completed: boolean }[],
  apiKey: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an encouraging and insightful academic coach for a student preparing for the JEE, a highly competitive exam. It's the end of the day. Based on the student's stated goals and their checklist progress, provide a short, motivating summary of their day.

    Today's Goals:
    ${JSON.stringify(goals.map(g => ({ goal: g.text, completed: g.completed, linkedTopic: g.linkedTopic })))}

    Today's Checklist Progress:
    ${JSON.stringify(checklistItems.map(c => ({ task: c.text, completed: c.completed })))}

    Your summary should:
    - Acknowledge the effort made today.
    - Highlight key accomplishments (completed goals and tasks).
    - Gently point out what was missed, if anything, without being discouraging.
    - End with a positive and forward-looking statement for tomorrow.
    - Keep the entire summary concise, around 2-4 sentences. Be personal and encouraging.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating end-of-day summary:", error);
    throw new Error("Failed to generate end-of-day summary.");
  }
};

export const getThematicAnalysis = async (
  weakTopics: { topic: string; count: number }[],
  apiKey: string
): Promise<string> => {
  if (weakTopics.length < 2) {
    return "Not enough data for a thematic analysis. Please log more incorrect questions across different topics to use this feature.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert academic coach for a student preparing for the JEE, a highly competitive engineering entrance exam. I will provide you with a list of the student's weakest topics, based on the number of incorrect answers logged for each.

    Weakest Topics (Topic, Error Count):
    ${JSON.stringify(weakTopics)}

    Your task is to perform a deep thematic analysis. Do not just list the topics back to me. Instead, find the underlying conceptual connections, recurring patterns, or fundamental principles that link these seemingly separate topics. The goal is to identify the root conceptual gap.

    For example, instead of saying "You are weak in Rotational Motion and Circular Motion," a good thematic analysis would be: "A recurring pattern in your errors for both 'Rotational Motion' and 'Circular Motion' suggests a deeper conceptual gap in applying vector principles, specifically cross-products, to define torque and angular momentum in complex, non-linear scenarios."

    Provide a concise, insightful analysis in 2-3 sentences that pinpoints the core thematic weakness. Keep the tone professional and analytical.`;

    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error getting thematic analysis:", error);
    throw new Error("Failed to generate thematic analysis. Please check your API key and try again.");
  }
};

export const getAIChiefAnalystSummary = async (
  weakTopics: { topic: string; count: number }[],
  errorReasons: { name: string; value: number }[],
  correlationData: { data: { x: string; y: string; value: number }[] },
  apiKey: string,
  improvise: boolean = false
): Promise<string> => {
  if (weakTopics.length === 0 && errorReasons.length === 0) {
    return "Not enough data for a chief analysis. Please log more test data to use this feature.";
  }

  const topWeakTopics = weakTopics.slice(0, 5);
  const topErrorReasons = errorReasons.slice(0, 3);
  
  // Check if correlationData and correlationData.data are defined
  const marksCorrelations = correlationData?.data
    ? correlationData.data
        .filter((d: any) => d.y === 'Marks' && d.x !== 'Marks')
        .sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 2)
    : [];

  const prompt = `You are an expert AI Chief Analyst for a student preparing for the JEE, a highly competitive engineering entrance exam. Your role is to synthesize data from various analyses and provide a single, powerful, and concise diagnostic summary. Do not just repeat the data; explain *what it means* and *why it matters*.
    ${improvise ? 'Provide a fresh, insightful perspective on this data, perhaps highlighting a different angle than a previous analysis.' : ''}

    **Available Data:**
    - **Top Weak Topics (by error count):** ${JSON.stringify(topWeakTopics)}
    - **Top Error Reasons (by count):** ${JSON.stringify(topErrorReasons)}
    - **Key Performance Correlations:** ${JSON.stringify(marksCorrelations.map(c => ({ metric: c.x, correlation: c.value.toFixed(2) })))}

    Based on this data, provide a diagnostic summary in 2-4 sentences. Pinpoint the *primary performance blocker* and explain its impact. The tone should be that of a senior consultant delivering a critical executive summary.

    **Example Output:**
    > "Your primary performance blocker is **Conceptual Gaps in Physics**, especially in topics like 'Rotational Motion'. These errors are most frequent in Multiple Correct questions, costing you an average of 12 marks per test. The strong negative correlation between 'Wrong Answers' and 'Total Marks' (-0.85) indicates that reducing these errors is the single most effective way to boost your rank."
  `;

  try {
    const ai = new GoogleGenAI({ apiKey });
    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error getting AI Chief Analyst summary:", error);
    throw new Error("Failed to generate the chief analyst summary.");
  }
};

export const generateFocusedStudyPlan = async (
  subject: string,
  weakTopics: string[],
  apiKey: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert academic coach for a student preparing for the JEE, a highly competitive engineering entrance exam. The student is struggling with ${subject} and their accuracy has recently dropped.

    Their weakest topics in ${subject} are: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'not specified, please give general advice for the subject'}.

    Create a concise and highly focused 3-day "recovery" study plan to help the student get back on track in ${subject}. The plan should be actionable and not overwhelming.

    For each of the 3 days, specify:
    1.  **Primary Topic Focus:** Which one or two of the weak topics to concentrate on.
    2.  **Key Actions:** 2-3 specific, concrete tasks (e.g., "Review theory of [Topic X] for 1 hour," "Solve 15 targeted problems on [Topic Y]," "Watch a lecture on [Concept Z]").
    3.  **A quick tip** related to improving accuracy in ${subject}.

    Format your response in clear Markdown. Use '###' for day headings. The tone should be supportive and targeted.`;

    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });

    return response.text;
  } catch (error) {
    console.error("Error generating focused study plan:", error);
    throw new Error("Failed to generate the focused study plan. Please try again.");
  }
};

export const explainTopic = async (topic: string, apiKey: string, complexity: 'standard' | 'simple' = 'standard'): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const complexityInstruction = complexity === 'simple' 
        ? "Explain it like I'm 5 years old. Use simple analogies, avoid jargon, and focus on the intuition. Keep it fun and engaging." 
        : "Explain it clearly for a high school student preparing for JEE. Include core definitions, formulas, and key concepts.";

    const prompt = `You are an expert academic tutor.
    
    Topic: "${topic}"
    
    ${complexityInstruction}
    
    Use Markdown for formatting.`;
    
    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
    });
    
    return response.text;

  } catch (error) {
    console.error(`Error explaining topic "${topic}":`, error);
    throw new Error(`Failed to generate an explanation for "${topic}".`);
  }
};

export const generateGatekeeperQuiz = async (topic: string, apiKey: string): Promise<QuizQuestion[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Generate 3 distinct, conceptual multiple-choice questions for the JEE-level chapter "${topic}". The questions must test fundamental understanding, not just rote memorization. For each question, provide four options (A, B, C, D), identify the correct option letter, and give a brief explanation for the correct answer.`;
        
        // UPGRADED MODEL: Using gemini-2.5-flash for stability
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quiz: {
                            type: Type.ARRAY,
                            description: "An array of 3 quiz questions.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    options: {
                                        type: Type.OBJECT,
                                        properties: {
                                            A: { type: Type.STRING },
                                            B: { type: Type.STRING },
                                            C: { type: Type.STRING },
                                            D: { type: Type.STRING },
                                        },
                                        required: ["A", "B", "C", "D"]
                                    },
                                    answer: { type: Type.STRING, description: "The letter of the correct option (A, B, C, or D)." },
                                    explanation: { type: Type.STRING, description: "A brief explanation for why the answer is correct." }
                                },
                                required: ["question", "options", "answer", "explanation"]
                            }
                        }
                    },
                    required: ["quiz"]
                }
            }
        });

        const parsedJson = JSON.parse(response.text);
        return parsedJson.quiz;
    } catch (error) {
        console.error(`Error generating gatekeeper quiz for "${topic}":`, error);
        throw new Error(`Failed to generate a quiz for "${topic}".`);
    }
};

export const generateTasksFromGoal = async (goalText: string, apiKey: string): Promise<{ task: string, time: number }[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an academic coach for a student preparing for the JEE exam. Their weekly goal is: "${goalText}".
    Break this down into 3-4 concrete, actionable daily tasks. For each task, provide a realistic time estimate in minutes.
    Return a JSON object following the schema.`;
    
    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tasks: {
                        type: Type.ARRAY,
                        description: "An array of actionable tasks.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                task: {
                                    type: Type.STRING,
                                    description: "The description of the task."
                                },
                                time: {
                                    type: Type.NUMBER,
                                    description: "Estimated time in minutes to complete the task."
                                }
                            },
                            required: ["task", "time"]
                        }
                    }
                },
                required: ["tasks"],
            },
        },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    return parsedJson.tasks;

  } catch (error) {
    console.error("Error generating tasks from goal:", error);
    // Provide a fallback response that matches the expected type
    return [
        { task: `Review concepts related to "${goalText}"`, time: 60 },
        { task: `Solve 15 practice problems for "${goalText}"`, time: 90 },
        { task: "Create summary notes.", time: 30 }
    ];
  }
};

export const generateSmartTasks = async (weakTopics: string[], apiKey: string): Promise<{ task: string; time: number; topic: string; }[]> => {
  if (weakTopics.length === 0) {
    return [
      { task: 'Review any challenging chapter from Physics', time: 60, topic: 'General Physics' },
      { task: 'Solve 15 mixed-concept problems from Maths', time: 90, topic: 'General Maths' },
    ];
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an academic coach for a JEE student. Based on their identified weak topics: ${weakTopics.slice(0,5).join(', ')}. Create a short list of 2-3 highly specific and actionable tasks for a "Today's Focus" block. For each task, provide a realistic time estimate in minutes and link it to the relevant weak topic. Return a JSON object following the schema.`;
    
    // UPGRADED MODEL: Using gemini-2.5-flash for stability
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tasks: {
                        type: Type.ARRAY,
                        description: "An array of 2-3 focused tasks.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                task: {
                                    type: Type.STRING,
                                    description: "The description of the task."
                                },
                                time: {
                                    type: Type.NUMBER,
                                    description: "Estimated time in minutes."
                                },
                                topic: {
                                    type: Type.STRING,
                                    description: "The weak topic this task addresses."
                                }
                            },
                            required: ["task", "time", "topic"]
                        }
                    }
                },
                required: ["tasks"],
            },
        },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    return parsedJson.tasks;

  } catch (error) {
    console.error("Error generating smart tasks:", error);
    // Provide a fallback response that matches the expected type
    return [
        { task: `Review core concepts for "${weakTopics[0]}"`, time: 60, topic: weakTopics[0] },
        { task: `Solve 10 targeted problems from "${weakTopics[1] || weakTopics[0]}"`, time: 90, topic: weakTopics[1] || weakTopics[0] },
    ];
  }
};

export const generateSmartTaskOrder = async (tasks: DailyTask[], userProfile: UserProfile, logs: QuestionLog[], apiKey: string): Promise<string[]> => {
    if (tasks.length <= 1) return tasks.map(t => t.id);

    try {
        const ai = new GoogleGenAI({ apiKey });
        const taskList = tasks.map(t => ({
            id: t.id,
            text: t.text,
            type: t.taskType,
            effort: t.effort,
            time: t.estimatedTime
        }));

        const prompt = `You are an elite productivity coach for a JEE student. Reorder the following tasks to maximize efficiency.
        
        **Student Profile:**
        - Peak study times: ${JSON.stringify(userProfile.studyTimes)}
        
        **Task List:**
        ${JSON.stringify(taskList)}

        **Strategy:**
        1. Prioritize "Deep Work" and high-effort tasks for peak hours (Morning/Evening usually).
        2. Group similar tasks to reduce context switching.
        3. Place lower effort tasks or breaks between intense sessions.
        
        Return ONLY a JSON object containing an array of task IDs in the optimized order.
        `;

        // UPGRADED MODEL: Using gemini-2.5-flash for stability
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        orderedIds: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["orderedIds"]
                }
            }
        });

        const json = JSON.parse(response.text.trim());
        return json.orderedIds || tasks.map(t => t.id);

    } catch (error) {
        console.error("Error generating smart order:", error);
        return tasks.map(t => t.id); // Fallback to original order
    }
};

export const generateLearningPath = async (topic: string, userWeaknesses: string[], apiKey: string): Promise<{ task: string; time: number; topic: string; }[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are an elite academic strategist for a JEE student targeting the chapter "${topic}".
        
        **Student Context:**
        - The student has known weaknesses in: ${userWeaknesses.length > 0 ? userWeaknesses.join(', ') : 'None specifically recorded'}.
        
        Create a rigorous, step-by-step learning path to master "${topic}". The path should address prerequisites if the student is weak in them, cover core theory, and include targeted problem solving.
        
        Return a list of 4-6 actionable tasks.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        path: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    task: { type: Type.STRING, description: "Actionable task description" },
                                    time: { type: Type.NUMBER, description: "Estimated minutes (30-90)" },
                                    topic: { type: Type.STRING, description: "Related sub-topic or concept" }
                                },
                                required: ["task", "time", "topic"]
                            }
                        }
                    },
                    required: ["path"]
                }
            }
        });

        const json = JSON.parse(response.text.trim());
        return json.path;
    } catch (error) {
        console.error("Error generating learning path:", error);
        return [
            { task: `Review prerequisites for ${topic}`, time: 45, topic: 'Basics' },
            { task: `Study core concepts of ${topic}`, time: 60, topic: topic },
            { task: `Solve 20 practice problems for ${topic}`, time: 90, topic: topic }
        ];
    }
};

export const generateNextWhy = async (context: string, previousAnswer: string, step: number, apiKey: string): Promise<{ question: string; isFinal: boolean; solution?: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are an expert Socratic investigator helping a student analyze a mistake.
        
        **Context:** ${context}
        **Current Step:** ${step}/5
        **User's Answer to Previous 'Why':** "${previousAnswer}"
        
        If step < 5 and the root cause isn't fully clear yet, ask the next probing "Why?" question.
        If step == 5 or the user's answer reveals the fundamental root cause (e.g., "I didn't know the formula", "I ran out of time", "I was distracted"), provide a "Final Diagnosis" and a concise "Actionable Solution".
        
        Return JSON.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING, description: "The next question to ask." },
                        isFinal: { type: Type.BOOLEAN, description: "True if this is the solution phase." },
                        solution: { type: Type.STRING, description: "Actionable advice if isFinal is true." }
                    },
                    required: ["question", "isFinal"]
                }
            }
        });

        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error generating next why:", e);
        return { question: "Why do you think that happened?", isFinal: false };
    }
}
