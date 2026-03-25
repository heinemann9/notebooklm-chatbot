"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getWidgetConfig, sendWidgetMessage } from "@/lib/api";
import type { WidgetConfig, WidgetNotebook } from "@/lib/api";
import { ArrowUp, Loader2, MessageSquare, ArrowLeft } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type PageState = "loading" | "error" | "select" | "chat";

export default function WidgetChatPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<WidgetNotebook | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getWidgetConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.notebooks.length === 0) {
          setPageState("error");
        } else {
          setPageState("select");
        }
      })
      .catch(() => setPageState("error"));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSelectNotebook = (nb: WidgetNotebook) => {
    setSelectedNotebook(nb);
    setMessages([
      { role: "assistant", content: config?.welcome_message || "무엇을 도와드릴까요?" },
    ]);
    setConversationId(undefined);
    setPageState("chat");
  };

  const handleBack = () => {
    setSelectedNotebook(null);
    setMessages([]);
    setConversationId(undefined);
    setInput("");
    setPageState("select");
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !selectedNotebook) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await sendWidgetMessage(selectedNotebook.id, text, conversationId);
      if (!conversationId) {
        setConversationId(res.conversation_id);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      ]);
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

  // --- Loading ---
  if (pageState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  // --- Error ---
  if (pageState === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">서비스를 이용할 수 없습니다.</p>
      </div>
    );
  }

  // --- Notebook selection ---
  if (pageState === "select" && config) {
    return (
      <div className="flex flex-col h-screen bg-neutral-50">
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                {config.title}
              </h1>
              <p className="text-sm text-neutral-500 mt-1.5">
                어떤 주제에 대해 문의하시겠습니까?
              </p>
            </div>

            <div className="space-y-2">
              {config.notebooks.map((nb) => (
                <button
                  key={nb.id}
                  onClick={() => handleSelectNotebook(nb)}
                  className="w-full text-left p-4 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-200/50 active:scale-[0.99]"
                >
                  {nb.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Chat ---
  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <header className="h-12 border-b border-neutral-200 bg-white/80 backdrop-blur-md flex items-center px-4 shrink-0">
        <button
          onClick={handleBack}
          className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 hover:bg-neutral-100 mr-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-neutral-200 mr-3" />
        <span className="text-sm font-medium text-neutral-900 truncate">
          {selectedNotebook?.title}
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-5">
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

      {/* Input */}
      <div className="border-t border-neutral-200 bg-white px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 focus-within:border-neutral-400 focus-within:bg-white transition-all">
            <textarea
              ref={textareaRef}
              placeholder="메시지를 입력하세요..."
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
            Enter로 전송 · Shift+Enter로 줄바꿈
          </p>
        </div>
      </div>
    </div>
  );
}
