'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatWidgetProps {
  productId: string;
  apiUrl?: string;
}

export default function ChatWidget({ productId, apiUrl = '/api' }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/products/${productId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sessionId.current }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-50 transition-transform hover:scale-105"
        aria-label="Open chat"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-[#1a2234] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e293b] bg-[#111827]">
            <p className="font-semibold text-sm">Product Assistant</p>
            <p className="text-xs text-gray-400">Powered by GTM Agent Platform</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">Ask me anything about this product</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  m.role === 'user' ? 'bg-cyan-500 text-white' : 'bg-[#0a0e17] border border-[#1e293b]'
                }`}>{m.content}</div>
              </div>
            ))}
            {loading && <p className="text-gray-400 text-xs animate-pulse">Thinking...</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-[#1e293b] flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-[#0a0e17] border border-[#1e293b] rounded-md text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-md disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
