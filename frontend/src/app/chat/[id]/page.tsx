"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import SourceManager from "@/components/SourceManager";
import { getNotebooks } from "@/lib/api";
import type { Notebook } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  ArrowLeft,
  PanelRightOpen,
  PanelRightClose,
  Loader2,
} from "lucide-react";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { checking, authenticated } = useAuthGuard();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const id = params?.id ?? null;
  const [notebook, setNotebook] = useState<Notebook | null>(null);

  useEffect(() => {
    if (authenticated && id) {
      getNotebooks().then((nbs) => {
        const found = nbs.find((nb: Notebook) => nb.id === id);
        if (found) setNotebook(found);
      });
    }
  }, [id, authenticated]);

  if (checking || !id) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-md px-4 h-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 hover:bg-neutral-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-neutral-200" />
            <span className="text-sm font-medium text-neutral-700 truncate max-w-[300px]">
              {notebook?.title || "Notebook"}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 hover:bg-neutral-100"
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </header>

        {/* Chat */}
        <div className="flex-1 min-h-0">
          <ChatWindow notebookId={id} />
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 border-l border-neutral-200 bg-white shrink-0 overflow-hidden">
          <SourceManager notebookId={id} />
        </div>
      )}
    </div>
  );
}
