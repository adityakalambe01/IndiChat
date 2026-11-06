import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, ChevronLeft } from 'lucide-react';
import { MetaAiSwirlIcon } from '../../components/NavigationRail';
import { META_AI_PROMPT_SUGGESTIONS, INITIAL_AI_CHAT_MESSAGES, AiChatMessage } from '../../data/metaAiData';

interface MetaAiChatViewProps {
  onBack?: () => void;
}

export const MetaAiChatView: React.FC<MetaAiChatViewProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<AiChatMessage[]>(INITIAL_AI_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendPrompt = (promptText: string) => {
    if (!promptText.trim()) return;

    const userMsg: AiChatMessage = {
      id: `ai-user-${Date.now()}`,
      sender: 'user',
      text: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    setTimeout(() => {
      const responseText = generateSmartAiResponse(promptText);
      const aiMsg: AiChatMessage = {
        id: `ai-resp-${Date.now()}`,
        sender: 'meta_ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsThinking(false);
    }, 900);
  };

  function generateSmartAiResponse(query: string): string {
    const q = query.toLowerCase();
    if (q.includes('email') || q.includes('leave')) {
      return `Subject: Leave Application — [Your Name] — [Dates]\n\nDear [Manager's Name],\n\nI am writing to formally request leave from [Start Date] to [End Date] due to [reason]. I have ensured all my current sprint deliverables are up to date and handed over urgent coverage to [Colleague's Name].\n\nI will have limited access to emails but can be reached by phone in case of emergencies.\n\nThank you for understanding.\n\nWarm regards,\n[Your Name]`;
    }
    if (q.includes('quantum')) {
      return `Quantum computing uses qubits instead of classical bits (0 or 1). While a regular bit is like a light switch that is either ON or OFF, a qubit can be in a "superposition"—both ON and OFF at the same time!\n\nThis lets quantum computers test countless possibilities simultaneously, making them extraordinarily fast at solving complex cryptographic, molecular, and optimization problems. ⚛️`;
    }
    if (q.includes('cook') || q.includes('egg') || q.includes('tomato')) {
      return `Here are 2 delicious dishes you can make:\n\n1. Shakshuka (North African Poached Eggs): Sauté diced onions and tomatoes with cumin, garlic and chili flakes. Make small wells in the simmering sauce, crack in your eggs, cover until the whites are set, and dip with toasted bread! 🍳🍅\n2. Savory Egg & Tomato Toast: Scramble eggs with a pinch of butter. Pan-roast the tomato slices until caramelized. Layer over golden crunchy bread with fresh black pepper!`;
    }
    if (q.includes('react') || q.includes('performance')) {
      return `Top React 19 Performance Tips:\n\n1. Use Actions & useTransition for non-blocking UI updates.\n2. Leverage useOptimistic to show instantaneous responses before server confirmation.\n3. Minimize unnecessary context re-renders with split state or selector hooks.\n4. Avoid anonymous function props inside large FlatLists/tables to keep memoization stable.\n5. Preload critical media assets and lazy load heavy modals! 🚀`;
    }
    return `That's an interesting question! Based on the latest info, here is a helpful breakdown:\n\n• Key Point 1: Plan your strategy with clear measurable goals.\n• Key Point 2: Leverage modern tools and AI assistance to automate repetitive tasks.\n• Key Point 3: Keep testing iteratively to refine the output.\n\nLet me know if you would like me to dive deeper into any specific detail! ✨`;
  }

  return (
    <main className="chat-area wa-meta-ai-area">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-info">
          {onBack && (
            <button className="icon-btn" onClick={onBack} aria-label="Back">
              <ChevronLeft size={22} />
            </button>
          )}

          <div className="wa-ai-avatar-circle">
            <MetaAiSwirlIcon size={26} />
          </div>

          <div className="chat-header-details">
            <h2 className="chat-header-name" style={{ margin: 0, fontSize: '1rem' }}>
              Meta AI
            </h2>
            <span className="chat-header-status typing" style={{ color: '#a855f7' }}>
              with Llama 3 • Always ready to help
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div
              key={m.id}
              className={`message-row ${isUser ? 'outgoing' : 'incoming'}`}
            >
              <div
                className={`message-bubble ${isUser ? 'outgoing' : 'incoming'} ${
                  !isUser ? 'wa-ai-bubble' : ''
                }`}
              >
                {!isUser && (
                  <div className="wa-ai-bubble-tag">
                    <Sparkles size={13} color="#a855f7" style={{ marginRight: '4px' }} />
                    <span>Meta AI</span>
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.text}</div>
                <div className="message-meta">
                  <span className="message-time">{m.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="message-row incoming">
            <div className="message-bubble incoming wa-ai-bubble">
              <div className="typing-dots">
                <span className="typing-dot" style={{ backgroundColor: '#a855f7' }} />
                <span className="typing-dot" style={{ backgroundColor: '#ec4899' }} />
                <span className="typing-dot" style={{ backgroundColor: '#3b82f6' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="wa-ai-chips-scroll">
        {META_AI_PROMPT_SUGGESTIONS.map((chip, idx) => (
          <button
            key={idx}
            className="wa-ai-chip-pill"
            onClick={() => handleSendPrompt(chip.replace(/^[^\w]+/, ''))}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Footer */}
      <footer className="chat-input-bar">
        <form
          className="chat-input-wrapper"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputText);
          }}
          style={{ width: '100%', display: 'flex', alignItems: 'center' }}
        >
          <input
            type="text"
            className="chat-textarea"
            placeholder="Ask Meta AI anything..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ width: '100%', height: '42px', padding: '10px 16px' }}
          />
          <button
            type="submit"
            className="icon-btn-accent"
            disabled={!inputText.trim()}
            style={{ marginLeft: '8px' }}
          >
            <Send size={18} />
          </button>
        </form>
      </footer>
    </main>
  );
};
