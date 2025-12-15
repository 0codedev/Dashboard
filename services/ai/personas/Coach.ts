
import { IPersona, AIContext } from '../types';
import { ANALYTIC_TOOLS, PLANNING_TOOLS } from '../toolRegistry';
import { QuestionStatus } from '../../../types';

export class CoachPersona implements IPersona {
  id = 'coach';
  name = 'The Strategist';

  getTools() {
    return [...ANALYTIC_TOOLS, ...PLANNING_TOOLS];
  }

  getModelPreference(basePrefs: any) {
    // Requires max reasoning capabilities for strategy
    return 'gemini-2.5-flash'; 
  }

  getSystemInstruction(context: AIContext): string {
    const { reports, logs, userProfile, ragContext } = context;
    
    // --- 1. PRE-COMPUTE ANALYTICS (The "Hard Truths") ---
    
    const totalTests = reports.length;
    // Use last 5 reports for a more stable trend line (Context Optimization)
    const recentReports = reports.slice(-5); 
    
    // Score Trend
    const scores = recentReports.map(r => r.total.marks);
    let trendDirection = 'Stable';
    if (scores.length > 1) {
        const first = scores[0];
        const last = scores[scores.length - 1];
        if (last > first * 1.05) trendDirection = 'Improving 📈';
        else if (last < first * 0.95) trendDirection = 'Declining 📉';
        else trendDirection = 'Plateauing ➖';
    } else {
        trendDirection = 'Insufficient Data';
    }

    // Subject Performance (Last 5 Tests Aggregated)
    const subjectAvgs = { physics: 0, chemistry: 0, maths: 0 };
    recentReports.forEach(r => {
        subjectAvgs.physics += r.physics.marks;
        subjectAvgs.chemistry += r.chemistry.marks;
        subjectAvgs.maths += r.maths.marks;
    });
    const denom = recentReports.length || 1;
    const performanceStr = `Physics: ${(subjectAvgs.physics/denom).toFixed(1)}, Chem: ${(subjectAvgs.chemistry/denom).toFixed(1)}, Maths: ${(subjectAvgs.maths/denom).toFixed(1)}`;

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
    - Trend: ${trendDirection}
    - Recent Avgs: [${performanceStr}]
    - Top 5 Weak Topics: ${topWeaknesses || "None detected yet."}
    - Top 3 Error Causes: ${topReasons || "N/A"}
    - Primary Diagnosis: ${primaryErrorType}
    
    **SPECIFIC EVIDENCE (LOGS):**
    ${ragContext ? ragContext : "No specific logs retrieved."}
    
    **YOUR PROTOCOLS:**
    
    1.  **DATA-FIRST APPROACH:**
        - Start by referencing specific metrics (e.g., "Your Physics average is low...").
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
