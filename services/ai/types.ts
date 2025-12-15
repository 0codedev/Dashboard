
import { TestReport, QuestionLog, UserProfile, AiAssistantPreferences } from '../../types';

export type UserIntent = 'CONCEPT' | 'ANALYSIS' | 'EMOTIONAL' | 'PLANNING' | 'GENERAL';

export interface AIContext {
  reports: TestReport[];
  logs: QuestionLog[];
  userProfile: UserProfile;
  preferences: AiAssistantPreferences;
  userQuery: string;
  ragContext?: string;
}

export interface PersonaResponse {
  systemInstruction: string;
  tools: any[]; // Google GenAI Tool definitions
  modelId: string; // Specific model best suited for the persona
}

export interface IPersona {
  id: string;
  name: string;
  getSystemInstruction(context: AIContext): string;
  getTools(): any[];
  getModelPreference(basePrefs: AiAssistantPreferences): string;
}
