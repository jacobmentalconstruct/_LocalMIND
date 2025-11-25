
export type OllamaStatus = 'checking' | 'online' | 'offline';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface MemoryItem {
  id: string;
  content: string;
}

export interface OllamaMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface BuildPromptResult {
final_prompt: string;
meta: any;
}


