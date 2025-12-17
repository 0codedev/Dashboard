
import { IPersona, AIContext } from '../types';
import { ANALYTIC_TOOLS, PLANNING_TOOLS } from '../toolRegistry';
import { QuestionStatus } from '../../../types';
import { summarizeTestHistory } from '../../geminiService';

export class CoachPersona implements IPersona {
  id = 'coach';
  name = 'The Strategist';

  getTools() {
    return [...ANALYTIC_TOOLS, ...PLANNING_TOOLS];
  }

  getModelPreference(basePrefs: any) {
    // Respect user preference completely. 
    // The execution layer (AiAssistant) handles provider switching and tool compatibility.
    return basePrefs.model;
  }

  getSystemInstruction(context: AIContext): string {
    const { reports, logs, userProfile, ragContext } = context;
    
    // --- 1. OPTIMIZED CONTEXT GENERATION ---
    
    // Use the new token-efficient summary instead of raw processing
    const performanceSummary = summarizeTestHistory(reports);

    // Error Pattern Analysis (Optimized Context Window)
    // Prevent "Lost in the Middle": Process only the 200 most recent logs if dataset is huge.
    const relevantLogs = logs.length > 200 ? logs.slice(-200) : logs;
    
    const errorCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};

    relevantLogs.forEach(l => {
        if (l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect) {
            if (l.topic && l.topic !== 'N/A') errorCounts[l.topic] = (errorCounts[l.topic] || 0) + 1;
            if (l.reasonForError) {
                reasonCounts[l.reasonForError] = (reasonCounts[l.reasonForError] || 0) + 1;
            }
        }
    });

    const topWeaknesses = Object.entries(errorCounts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => `${e[0]} (${e[1]})`)
        .join(', ');

    const topReasons = Object.entries(reasonCounts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0])
        .join(', ');

    const primaryErrorType = (reasonCounts['Silly Mistake'] || 0) > (reasonCounts['Conceptual Gap'] || 0) 
        ? 'Execution/Focus (Silly Mistakes)' 
        : 'Knowledge (Conceptual Gaps)';

    // --- 2. THE STRATEGY CONSULTANT PROMPT ---
    return `
    You are an **Elite JEE Strategy Consultant**. Your job is to maximize marks per hour of study.
    
    **STUDENT DATA:**
    - Target: ${userProfile.targetExams.join(', ')}
    ${performanceSummary}
    
    **DIAGNOSTICS:**
    - Top 5 Weak Topics: ${topWeaknesses || "None detected yet."}
    - Top 3 Error Causes: ${topReasons || "N/A"}
    - Primary Diagnosis: ${primaryErrorType}
    
    **SPECIFIC EVIDENCE (LOGS):**
    ${ragContext ? ragContext : "No specific logs retrieved."}
    
    **YOUR PROTOCOLS:**
    
    1.  **DATA-FIRST APPROACH:**
        - Start by referencing specific metrics from the history (e.g., "Your Physics average is low...").
        - Be direct but constructive.
        
    2.  **ACTIONABLE STRATEGY:**
        - Don't just say "Study harder". Say "Devote 2 hours to Rotational Motion numericals".
        - Use the \`createActionPlan\` tool if the user needs a schedule or checklist.
        
    3.  **VISUALIZATION:**
        - Use \`renderChart\` if comparing subjects or showing trends.
        
    4.  **SCOPE MANAGEMENT:**
        - You deal with *Strategy*, *Scores*, and *Planning*.
        - If asked a deep conceptual question (e.g., "Derive this formula"), provide a brief context on its importance for the exam (high/low yield), then suggest they ask 'The Professor' for the derivation.
    `;
  }
}
