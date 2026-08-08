'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import SourcesUsedPanel from '@/components/SourcesUsedPanel';
import { cn } from '@/lib/cn';
import { resolveApiBase } from '@/lib/api-base';

interface ChatMessage {
  role: string;
  content: string;
  sources_used?: string[];
}

interface ChatWidgetProps {
  productId: string;
}

export default function ChatWidget({ productId }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const res = await fetch(`${resolveApiBase()}/products/${productId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: msg, session_id: sessionId.current }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          sources_used: data.sources_used || [],
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-primary-hover text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-105 focus-ring"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      {open && (
        <div className="glass-strong fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] rounded-[var(--radius-liquid-lg)] flex flex-col z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--glass-border)]">
            <p className="font-semibold text-sm">Product Assistant</p>
            <p className="text-xs text-muted">Powered by Emissary</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-muted text-sm text-center py-8">Ask me anything about this product</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={cn(
                  'max-w-[85%] px-3 py-2 rounded-lg text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border border-border',
                )}>
                  {m.content}
                  {m.role === 'assistant' && m.sources_used && m.sources_used.length > 0 && (
                    <SourcesUsedPanel sources={m.sources_used} compact />
                  )}
                </div>
              </div>
            ))}
            {loading && <p className="text-muted text-xs animate-pulse">Thinking…</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="text-sm py-2"
            />
            <Button type="submit" disabled={loading} size="sm">Send</Button>
          </form>
        </div>
      )}
    </>
  );
}
