"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getNotebooks, createNotebook, deleteNotebook } from "@/lib/api";
import type { Notebook } from "@/lib/api";
import {
  Plus,
  BookOpen,
  Trash2,
  MessageSquare,
  Loader2,
  Sparkles,
  FolderOpen,
} from "lucide-react";

export default function NotebookList() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    fetchNotebooks();
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">NotebookLM</h1>
              <p className="text-xs text-slate-500">AI-powered document chatbot</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40">
                  <Plus className="h-4 w-4 mr-2" />
                  New Notebook
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Notebook</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-4">
                <Input
                  placeholder="Enter notebook title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <Button
                  onClick={handleCreate}
                  disabled={creating || !title.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Notebook"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Loading notebooks...</p>
          </div>
        ) : notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <FolderOpen className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No notebooks yet</h3>
            <p className="text-sm text-slate-400 mb-6">Create your first notebook to get started</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Notebook
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((nb) => (
              <Card
                key={nb.id}
                className="group cursor-pointer border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200"
                onClick={() => router.push(`/chat/${nb.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0 group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={(e) => handleDelete(nb.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-800 line-clamp-2 mt-2">
                    {nb.title || "Untitled Notebook"}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-2">
                    {nb.created_at && (
                      <CardDescription className="text-xs">
                        {new Date(nb.created_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </CardDescription>
                    )}
                    <div className="flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                      <MessageSquare className="h-3 w-3" />
                      Chat
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
