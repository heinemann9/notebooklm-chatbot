"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import SourceManager from "@/components/SourceManager";
import { Button } from "@/components/ui/button";
import { getNotebooks } from "@/lib/api";
import type { Notebook } from "@/lib/api";
import {
  ArrowLeft,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
} from "lucide-react";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [id, setId] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);

  useEffect(() => {
    if (params?.id) {
      setId(params.id);
      getNotebooks().then((nbs) => {
        const found = nbs.find((nb: Notebook) => nb.id === params.id);
        if (found) setNotebook(found);
      });
    }
  }, [params]);

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700 truncate max-w-[300px]">
                {notebook?.title || "Notebook"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-700"
          >
            {sidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </header>

        {/* Chat */}
        <div className="flex-1 min-h-0">
          <ChatWindow notebookId={id} />
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 border-l bg-white shrink-0 overflow-hidden shadow-sm">
          <SourceManager notebookId={id} />
        </div>
      )}
    </div>
  );
}
