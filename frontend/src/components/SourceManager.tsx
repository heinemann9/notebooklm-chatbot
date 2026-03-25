"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getSources,
  addSourceUrl,
  addSourceFile,
  deleteSource,
} from "@/lib/api";
import type { Source } from "@/lib/api";
import {
  Link,
  Upload,
  Trash2,
  FileText,
  Globe,
  Loader2,
  Plus,
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

  const handleAddUrl = async () => {
    if (!url.trim()) return;
    try {
      setAdding(true);
      await addSourceUrl(notebookId, url.trim());
      setUrl("");
      toast.success("Source added");
      fetchSources();
    } catch (err) {
      toast.error("Failed to add source");
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAdding(true);
      await addSourceFile(notebookId, file);
      toast.success("File uploaded");
      fetchSources();
    } catch (err) {
      toast.error("Failed to upload file");
      console.error(err);
    } finally {
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
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
