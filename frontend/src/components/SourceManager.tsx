"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FolderOpen,
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
      <div className="px-4 py-4 border-b">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-blue-500" />
          Sources
          {sources.length > 0 && (
            <span className="text-xs font-normal text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
              {sources.length}
            </span>
          )}
        </h2>
      </div>

      {/* Add source controls */}
      <div className="px-4 py-3 space-y-2 border-b bg-slate-50/50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Paste URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              disabled={adding}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddUrl}
            disabled={adding || !url.trim()}
            className="h-9 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <input
          type="file"
          ref={fileRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.txt,.md,.doc,.docx"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs text-slate-600 border-dashed hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          disabled={adding}
        >
          <Upload className="h-3.5 w-3.5 mr-2" />
          {adding ? "Uploading..." : "Upload File (PDF, TXT, DOC)"}
        </Button>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mb-2" />
            <p className="text-xs">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-xs text-slate-400">No sources added yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">Add URLs or upload files above.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sources.map((src) => (
              <div
                key={src.id}
                className="group flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2.5 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  {src.source_type === "url" ? (
                    <Globe className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {src.title || "Untitled"}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">{src.source_type}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 h-7 w-7 p-0 shrink-0"
                  onClick={() => handleDelete(src.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
