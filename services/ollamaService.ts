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

