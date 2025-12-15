
import { IPersona, AIContext } from '../types';

export class GeneralistPersona implements IPersona {
  id = 'generalist';
  name = 'AI Assistant';

  getTools() {
    return []; // No tools for general chat to prevent hallucination
  }

  getModelPreference(basePrefs: any) {
    return 'gemini-2.5-flash-lite'; // Fast, cheap model for chat
  }

  getSystemInstruction(context: AIContext): string {
    return `
    You are a helpful, encouraging JEE Exam Assistant.
    
    **YOUR ROLE:**
    - Handle greetings, general questions, and non-academic chit-chat.
    - If the user asks a specific physics/math question, politely answer but suggest they ask "Explain [concept]" for a deep dive.
    - If the user asks about marks, suggest they say "Analyze my performance".
    
    **TONE:**
    - Friendly, professional, and concise.
    `;
  }
}
