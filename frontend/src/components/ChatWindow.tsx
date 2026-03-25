"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendMessage, getChatHistory } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowUp,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface ChatWindowProps {
  notebookId: string;
}

export default function ChatWindow({ notebookId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getChatHistory(notebookId)
      .then(setMessages)
      .catch(() => {});
  }, [notebookId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const now = new Date().toISOString();
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      turn_number: 0,
      conversation_id: conversationId ?? "",
      created_at: now,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await sendMessage(notebookId, text, conversationId);
      if (!conversationId) {
        setConversationId(res.conversation_id);
      }
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        turn_number: res.turn_number,
        conversation_id: res.conversation_id,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      toast.error("Failed to get response");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
                <MessageSquare className="h-5 w-5 text-neutral-300" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">
                Start a conversation
              </p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Ask questions about your sources. The AI will respond based on the documents you&apos;ve added.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-br-md bg-neutral-900 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-md bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-neutral-500">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="max-w-[85%] text-sm leading-relaxed text-neutral-700">
                    <div className="prose prose-sm prose-neutral max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-neutral-900 prose-strong:text-neutral-900 prose-code:text-neutral-800 prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-pre:rounded-lg prose-a:text-neutral-900 prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-neutral-300 prose-blockquote:text-neutral-500">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-md bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-neutral-500">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex items-center gap-1 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-200 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 focus-within:border-neutral-400 focus-within:bg-white transition-all">
            <textarea
              ref={textareaRef}
              placeholder="Message..."
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none min-h-[20px] max-h-[160px] leading-5"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="h-7 w-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0 transition-all hover:bg-neutral-800 active:scale-95 disabled:opacity-30 disabled:hover:bg-neutral-900"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
