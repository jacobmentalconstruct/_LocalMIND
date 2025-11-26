import { OllamaMessage, MemoryItem } from '../types';

const API_URL = 'http://localhost:8000';

export const checkStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/models`);
    return response.ok;
  } catch (error) {
    console.error("Backend status check failed:", error);
    return false;
  }
};

export const getMemories = async (): Promise<MemoryItem[]> => {
  try {
    const response = await fetch(`${API_URL}/memories`);
    const data = await response.json();
    return data.memories;
  } catch (error) {
    console.error("Failed to fetch memories:", error);
    return [];
  }
};

export const updateMemory = async (id: string, content: string): Promise<boolean> => {
try {
const response = await fetch(`${API_URL}/memories/${id}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ content })
});
return response.ok;
} catch (error) {
console.error("Failed to update memory:", error);
return false;
}
};

// [NEW] Fetch available and missing summarizers
export const getSummarizerStatus = async (): Promise<{available: string[], missing: string[]}> => {
    try {
        const response = await fetch(`${API_URL}/summarizers`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch summarizer status:", error);
        return { available: [], missing: [] };
    }
};

// services/ollamaService.ts
export const getSessionSummary = async (): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/session_summary`);
        const data = await response.json();
        return data.summary;
    } catch (error) {
        console.error("Failed to fetch session summary:", error);
        return "";
    }
};

export const buildPrompt = async (model: string, message: string, system_prompt: string, use_memory: boolean) => {
const response = await fetch(`${API_URL}/build_prompt`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ model, message, system_prompt, use_memory })
});
return await response.json();
};

export const inferWithPrompt = async (final_prompt: string, model: string, original_message: string, summarizer_model: string) => {
const response = await fetch(`${API_URL}/infer_with_prompt`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ final_prompt, model, original_message, summarizer_model })
});
return await response.json();
};

export const analyzeSnippet = async (snippet: string, instructions: string, model: string) => {
const response = await fetch(`${API_URL}/analyze_snippet`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ snippet, instructions, model })
});
return await response.json();
};

export const sendChat = async (model: string, message: string, system_prompt: string, use_memory: boolean, summarizer_model: string) => {
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          message,
          system_prompt,
          use_memory,
          summarizer_model // [NEW] Sending the choice
        })
      });

      if (!response.ok) {
        throw new Error("Backend request failed");
      }
      const data = await response.json();
      return data; 
    } catch (error) {
        console.error("Error in sendChat:", error);
        throw error;
    }
};

export const getModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/models`);
    const data = await response.json();
    return data.models.map((model: any) => model.name);
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return [];
  }
};

export const getHistory = async (): Promise<OllamaMessage[]> => {
  try {
    const response = await fetch(`${API_URL}/history`);
    const data = await response.json();
    return data.history.map((msg: any, index: number) => ({
        id: index.toString(),
        role: msg.role,
        content: msg.content
    }));
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return [];
  }
};

export const getPromptContext = async (model: string, message: string, system_prompt: string, use_memory: boolean) => {
    const response = await fetch(`${API_URL}/get_prompt_context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, message, system_prompt, use_memory })
    });
    return await response.json();
};

export const renderPrompt = async (schema_data: any) => {
    const response = await fetch(`${API_URL}/render_prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema_data })
    });
    return await response.json();
};

export const addMemory = async (content: string): Promise<MemoryItem | null> => {
    try {
        const response = await fetch(`${API_URL}/memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error("Failed to save memory");
        return await response.json(); // Returns the new item with real ID
    } catch (error) {
        console.error("Error adding memory:", error);
        return null;
    }
};