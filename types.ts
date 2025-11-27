
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

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface TreeNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  type: 'folder' | 'file';
  content?: string;
  children?: TreeNode[]; // Helper for recursive rendering if needed
}
