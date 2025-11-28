import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { BotIcon, SaveIcon, UserIcon, BrainCircuitIcon } from './icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSaveToMemory: (content: string) => void;
onAskAboutSelection: (snippet: string) => void;
}

const ChatMessageItem: React.FC<{ message: ChatMessage, onSaveToMemory: (content: string) => void }> = ({ message, onSaveToMemory }) => {
    const isUser = message.role === 'user';
    const Icon = isUser ? UserIcon : BotIcon;
    const bgColor = isUser ? 'bg-gray-800' : 'bg-indigo-950/30';
    const align = isUser ? 'justify-end' : 'justify-start';

    return (
        <div className={`flex items-start gap-3 w-full ${align}`}>
            <div className={`flex flex-col w-full max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`relative p-4 rounded-xl ${bgColor}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                         <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500/50' : 'bg-indigo-500/50'}`}>
                           <Icon className="w-5 h-5"/>
                        </div>
                        <span className="font-semibold">{isUser ? 'You' : 'Assistant'}</span>
                    </div>

                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                        {message.content || <span className="animate-pulse">...</span>}
                    </div>

                    {!isUser && (
                        <button 
                            onClick={() => onSaveToMemory(message.content)}
                            className="absolute top-2 right-2 p-1.5 text-gray-400 rounded-full hover:bg-gray-600 hover:text-white transition-colors"
                            aria-label="Save to memory"
                        >
                            <SaveIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSaveToMemory, onAskAboutSelection }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAskSelection = () => {
    if (typeof window === 'undefined') return;
const selection = window.getSelection();
const text = selection ? selection.toString().trim() : '';
if (text) {
onAskAboutSelection(text);
}
};

return (
<div ref={scrollRef} className="h-full overflow-y-auto p-4">
      <div className="flex flex-col gap-6">
      {messages.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full text-gray-500">
             <BrainCircuitIcon className="w-16 h-16 mb-4 text-gray-600"/>
             <h2 className="text-2xl font-semibold">LocalMind</h2>
             <p>Start a conversation with your local Ollama model.</p>
           </div>
        ) : (
            messages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} onSaveToMemory={onSaveToMemory}/>
            ))
        )}
      </div>
    </div>
  );
};

export default ChatPanel;



