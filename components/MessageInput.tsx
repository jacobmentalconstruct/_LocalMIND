import React, { useState, useRef, useEffect } from 'react';
import { EraserIcon, SendIcon, SquareIcon } from './icons';

interface MessageInputProps {
  onSendMessage: (input: string) => void;
  isLoading: boolean;
  onStop: () => void;
  onClearChat: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  onStop, 
  onClearChat
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="space-y-3">
       <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          rows={1}
          className="w-full p-3 pr-24 bg-gray-700 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          disabled={isLoading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
                <button
                type="button"
                onClick={onStop}
                className="p-2 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors flex items-center gap-1"
                >
                <SquareIcon className="w-5 h-5"/>
                </button>
            ) : (
              <button
                type="submit"
                className="p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
                disabled={!input.trim()}
                >
                <SendIcon className="w-5 h-5" />
                </button>
            )}
        </div>
      </form>
       <div className="flex items-center justify-end text-xs text-gray-400">
        <button
          onClick={onClearChat}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700"
          aria-label="Clear chat history"
        >
          <EraserIcon className="w-4 h-4" />
          <span>Clear Chat</span>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;