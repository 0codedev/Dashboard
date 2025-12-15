
import { GoogleGenAI } from "@google/genai";
import { UserIntent } from './types';

// Zero-latency Regex Heuristics
const HEURISTICS: Partial<Record<UserIntent, RegExp[]>> = {
    CONCEPT: [
        /explain/i, /what is/i, /derive/i, /formula/i, /how (do|does|to)/i, /solve/i, 
        /define/i, /difference between/i, /concept/i, /theory/i, /theorem/i,
        /physics/i, /chemistry/i, /math/i // Subject mentions usually imply concepts if not paired with "marks"
    ],
    ANALYSIS: [
        /analy(z|s)e/i, /trend/i, /weakness/i, /why/i, /marks/i, /score/i, /rank/i, 
        /graph/i, /chart/i, /report/i, /performance/i, /accuracy/i, /mistake/i, /error/i,
        /compare/i, /improvement/i
    ],
    EMOTIONAL: [
        /sad/i, /depres/i, /anx/i, /scared/i, /tired/i, /burnout/i, /hopeless/i,
        /give up/i, /motivat/i, /fear/i, /stress/i, /overwhelmed/i, /fail/i, /can't do/i
    ],
    PLANNING: [
        /plan/i, /schedule/i, /timetable/i, /routine/i, /study (path|road)/i, 
        /backlog/i, /strategy/i, /priorit/i, /agenda/i, /what to study/i
    ]
};

const heuristicRouter = (query: string): UserIntent | null => {
    // 1. Check for specific intents first
    for (const pattern of HEURISTICS.PLANNING || []) if (pattern.test(query)) return 'PLANNING';
    for (const pattern of HEURISTICS.EMOTIONAL || []) if (pattern.test(query)) return 'EMOTIONAL';
    for (const pattern of HEURISTICS.ANALYSIS || []) if (pattern.test(query)) return 'ANALYSIS';
    
    // 2. CONCEPT check (broad)
    for (const pattern of HEURISTICS.CONCEPT || []) {
        if (pattern.test(query)) {
            // Disambiguate: "Explain why my marks are low" -> ANALYSIS, not CONCEPT
            if (/mark|score|rank|percentile/i.test(query)) return 'ANALYSIS';
            return 'CONCEPT';
        }
    }

    // 3. Simple greetings -> GENERAL
    if (/^(hi|hello|hey|greetings|ok|thanks|thank you)/i.test(query.trim())) return 'GENERAL';

    return null;
};

export const classifyIntent = async (query: string, apiKey: string): Promise<UserIntent> => {
    // 1. Zero-latency Heuristic Check
    const heuristicMatch = heuristicRouter(query);
    if (heuristicMatch) {
        // console.debug(`[Router] Heuristic matched: ${heuristicMatch}`);
        return heuristicMatch;
    }

    // 2. LLM Fallback (for ambiguous queries)
    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Use Flash Lite for lowest latency routing
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: {
                role: 'user',
                parts: [{
                    text: `
                    Classify the student query into ONE category.
                    
                    Categories:
                    1. **CONCEPT**: "Explain", "What is", "Derive", "How does X work?", solving specific physics/math/chem problems.
                    2. **ANALYSIS**: "Analyze my marks", "Why is my score low?", "Show me trends", "My weak areas".
                    3. **EMOTIONAL**: "I feel burnt out", "I am scared", "I lack motivation", "I'm depressed".
                    4. **PLANNING**: "Make a timetable", "Schedule for today", "What should I study next?".
                    5. **GENERAL**: "Hello", "Hi", "Who are you?", general chit-chat.
                    
                    Query: "${query}"
                    
                    Reply ONLY with the category word (e.g., CONCEPT).
                    `
                }]
            }
        });

        const text = response.text?.trim().toUpperCase() || 'GENERAL';
        
        const validIntents: UserIntent[] = ['CONCEPT', 'ANALYSIS', 'EMOTIONAL', 'PLANNING', 'GENERAL'];
        if (validIntents.includes(text as UserIntent)) {
            return text as UserIntent;
        }
        
        // Fallback for messy LLM output
        if (text.includes('CONCEPT')) return 'CONCEPT';
        if (text.includes('ANALYSIS')) return 'ANALYSIS';
        if (text.includes('EMOTIONAL')) return 'EMOTIONAL';
        if (text.includes('PLANNING')) return 'PLANNING';
        
        return 'GENERAL';

    } catch (e) {
        console.warn("Router failed, defaulting to GENERAL", e);
        return 'GENERAL';
    }
};
