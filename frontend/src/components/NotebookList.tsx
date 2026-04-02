"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getNotebooks, createNotebook, deleteNotebook, logout, getAuthStatus } from "@/lib/api";
import type { Notebook } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  Plus,
  Trash2,
  ArrowRight,
  Loader2,
  LogOut,
  FileText,
  Plug,
  Unplug,
} from "lucide-react";

export default function NotebookList() {
  const router = useRouter();
  const { checking, authenticated } = useAuthGuard();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nlmConnected, setNlmConnected] = useState<boolean | null>(null);

  const fetchNotebooks = async () => {
    try {
      setLoading(true);
      const data = await getNotebooks();
      setNotebooks(data);
    } catch (err) {
      toast.error("Failed to load notebooks");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchNotebooks();
      getAuthStatus().then((s) => setNlmConnected(s.notebooklm_authenticated)).catch(() => {});
    }
  }, [authenticated]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      setCreating(true);
      await createNotebook(title.trim());
      setTitle("");
      setDialogOpen(false);
      toast.success("Notebook created");
      fetchNotebooks();
    } catch (err) {
      toast.error("Failed to create notebook");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this notebook?")) return;
    try {
      await deleteNotebook(id);
      toast.success("Notebook deleted");
      fetchNotebooks();
    } catch (err) {
      toast.error("Failed to delete notebook");
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch {
      toast.error("Failed to logout");
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <header className="relative border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-neutral-900 tracking-tight">NotebookLM</span>
          </div>
          <div className="flex items-center gap-2">
            {nlmConnected !== null && (
              <button
                onClick={() => router.push("/settings")}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all ${
                  nlmConnected
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
                title={nlmConnected ? "NotebookLM connected" : "NotebookLM not connected - click to set up"}
              >
                {nlmConnected ? <Plug className="h-3.5 w-3.5" /> : <Unplug className="h-3.5 w-3.5" />}
                {nlmConnected ? "Connected" : "Not connected"}
              </button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger
                render={
                  <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-neutral-900 text-white text-sm font-medium transition-all hover:bg-neutral-800 active:scale-[0.97]">
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New notebook</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 pt-2">
                  <Input
                    placeholder="Notebook name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                    className="h-10"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating || !title.trim()}
                    className="h-10 rounded-xl bg-neutral-900 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {creating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            <button
              onClick={handleLogout}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 hover:bg-neutral-100"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-900 mb-1">No notebooks yet</p>
            <p className="text-sm text-neutral-400 mb-5">Create one to get started</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-neutral-900 text-white text-sm font-medium transition-all hover:bg-neutral-800 active:scale-[0.97]"
            >
              <Plus className="h-3.5 w-3.5" />
              New notebook
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => router.push(`/chat/${nb.id}`)}
                className="group relative text-left w-full p-4 rounded-xl border border-neutral-200 bg-white transition-all hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-200/50 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {nb.title || "Untitled"}
                    </p>
                    {nb.created_at && (
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(nb.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      role="button"
                      onClick={(e) => handleDelete(nb.id, e)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-300 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="h-7 w-7 rounded-md flex items-center justify-center text-neutral-300 group-hover:text-neutral-500 transition-colors">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
