export interface AiChatMessage {
  id: string;
  sender: 'user' | 'meta_ai';
  text: string;
  timestamp: string;
}

export const META_AI_PROMPT_SUGGESTIONS = [
  '💡 Explain quantum computing in simple terms',
  '📝 Help me draft a professional leave email',
  '🍳 What can I cook with tomatoes, eggs and bread?',
  '🚀 Best practices for React 19 performance',
  '✈️ Plan a 3-day itinerary for Goa',
  '🧠 Give me 5 creative startup ideas for 2026',
];

export const INITIAL_AI_CHAT_MESSAGES: AiChatMessage[] = [
  {
    id: 'ai-welcome',
    sender: 'meta_ai',
    text: "Hi! I'm Meta AI. Ask me anything, generate creative content, brainstorm ideas, plan events, or get answers to your questions in real-time.",
    timestamp: '12:00 PM',
  },
];
