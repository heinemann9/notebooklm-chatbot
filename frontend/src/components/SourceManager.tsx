"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getSources,
  addSourceUrl,
  addSourceFile,
  deleteSource,
  getUploadTasks,
  cancelUploadTask,
} from "@/lib/api";
import type { Source, UploadTask } from "@/lib/api";
import {
  Link,
  Upload,
  Trash2,
  FileText,
  Globe,
  Loader2,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";

interface SourceManagerProps {
  notebookId: string;
}

export default function SourceManager({ notebookId }: SourceManagerProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const data = await getSources(notebookId);
      setSources(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [notebookId]);

  // Polling logic: start when there are active tasks, stop when all done
  useEffect(() => {
    const hasActive = uploadTasks.some(t => t.status !== "done" && t.status !== "error");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const tasks = await getUploadTasks(notebookId);
          setUploadTasks(tasks);
          const stillActive = tasks.some(t => t.status !== "done" && t.status !== "error");
          if (!stillActive) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            fetchSources();
          }
        } catch { /* ignore */ }
      }, 2000);
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [uploadTasks, notebookId]);

  // Auto-remove done tasks after 5 seconds
  useEffect(() => {
    const doneTasks = uploadTasks.filter(t => t.status === "done");
    if (doneTasks.length > 0) {
      const timer = setTimeout(() => {
        setUploadTasks(prev => prev.filter(t => t.status !== "done"));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadTasks]);

  const handleAddUrl = async () => {
    if (!url.trim()) return;
    try {
      setAdding(true);
      const task = await addSourceUrl(notebookId, url.trim());
      setUrl("");
      setUploadTasks(prev => [...prev, task]);
    } catch (err) {
      toast.error("Failed to add source");
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAdding(true);
    for (const file of Array.from(files)) {
      try {
        const task = await addSourceFile(notebookId, file);
        setUploadTasks(prev => [...prev, task]);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
        console.error(err);
      }
    }
    setAdding(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCancelUpload = async (taskId: string) => {
    try {
      await cancelUploadTask(notebookId, taskId);
      setUploadTasks(prev => prev.filter(t => t.task_id !== taskId));
    } catch {
      toast.error("Failed to cancel upload");
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await deleteSource(notebookId, sourceId);
      toast.success("Source deleted");
      fetchSources();
    } catch (err) {
      toast.error("Failed to delete source");
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 h-12 flex items-center border-b border-neutral-200">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          Sources
          {sources.length > 0 && (
            <span className="ml-1.5 text-[10px] font-normal text-neutral-400 bg-neutral-100 rounded-full px-1.5 py-px">
              {sources.length}
            </span>
          )}
        </h2>
      </div>

      {/* Add source controls */}
      <div className="px-4 py-3 space-y-2 border-b border-neutral-100">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Paste URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              disabled={adding}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-400 transition-colors disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleAddUrl}
            disabled={adding || !url.trim()}
            className="h-8 w-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0 transition-all hover:bg-neutral-800 active:scale-95 disabled:opacity-30"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <input
          type="file"
          ref={fileRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.txt,.md,.doc,.docx"
          multiple
        />
        <button
          className="w-full h-8 rounded-lg border border-dashed border-neutral-200 text-xs text-neutral-500 flex items-center justify-center gap-1.5 transition-all hover:border-neutral-300 hover:text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={adding}
        >
          <Upload className="h-3 w-3" />
          {adding ? "Uploading..." : "Upload file"}
        </button>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {uploadTasks.length > 0 && (
          <div className="mb-3 space-y-1">
            {uploadTasks.map((task) => (
              <div
                key={task.task_id}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                  task.status === "error" ? "bg-red-50" : task.status === "done" ? "bg-emerald-50" : "bg-blue-50"
                }`}
              >
                <div className="h-7 w-7 rounded-md bg-white/80 flex items-center justify-center shrink-0">
                  {task.status === "done" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  ) : task.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700 truncate">{task.filename}</p>
                  <p className="text-xs text-neutral-500">
                    {task.status === "pending" && "Waiting..."}
                    {task.status === "uploading" && "Uploading..."}
                    {task.status === "processing" && "Processing..."}
                    {task.status === "done" && "Complete"}
                    {task.status === "error" && (task.error || "Failed")}
                  </p>
                </div>
                {task.status !== "done" && (
                  <button
                    onClick={() => task.status === "error" ? setUploadTasks(prev => prev.filter(t => t.task_id !== task.task_id)) : handleCancelUpload(task.task_id)}
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-neutral-400 transition-all hover:text-red-500 hover:bg-white/60"
                    title={task.status === "error" ? "Dismiss" : "Cancel"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-300" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center mb-2">
              <FileText className="h-4 w-4 text-neutral-300" />
            </div>
            <p className="text-xs text-neutral-400">No sources yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sources.map((src) => (
              <div
                key={src.id}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-neutral-50"
              >
                <div className="h-7 w-7 rounded-md bg-neutral-100 flex items-center justify-center shrink-0">
                  {src.source_type === "url" ? (
                    <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-neutral-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700 truncate">
                    {src.title || "Untitled"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(src.id)}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-300 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-50 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
