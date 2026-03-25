export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types (aligned with backend Pydantic models) ---

export interface Notebook {
  id: string;
  title: string;
  created_at?: string;
  sources_count: number;
}

export interface Source {
  id: string;
  title: string | null;
  url: string | null;
  source_type: string;
  status: number;
  created_at: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  turn_number: number;
  conversation_id: string;
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  conversation_id: string;
  turn_number: number;
  is_follow_up: boolean;
}

export interface GenerateResponse {
  type: string;
  task_id: string | null;
  status: string | null;
  data: Record<string, unknown> | null;
}

export interface Artifact {
  id: string;
  title: string;
  artifact_type: number;
  status: number;
  created_at: string | null;
  url: string | null;
}

// --- Helpers ---

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Authentication required");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// --- Notebooks ---

export async function getNotebooks(): Promise<Notebook[]> {
  return apiFetch<Notebook[]>("/api/notebooks");
}

export async function getNotebook(id: string): Promise<Notebook> {
  return apiFetch<Notebook>(`/api/notebooks/${id}`);
}

export async function createNotebook(title: string): Promise<Notebook> {
  return apiFetch<Notebook>("/api/notebooks", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  await apiFetch<void>(`/api/notebooks/${id}`, { method: "DELETE" });
}

// --- Sources ---

export async function getSources(notebookId: string): Promise<Source[]> {
  return apiFetch<Source[]>(`/api/notebooks/${notebookId}/sources`);
}

export async function addSourceUrl(
  notebookId: string,
  url: string
): Promise<Source> {
  return apiFetch<Source>(`/api/notebooks/${notebookId}/sources/url`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function addSourceText(
  notebookId: string,
  title: string,
  content: string
): Promise<Source> {
  return apiFetch<Source>(`/api/notebooks/${notebookId}/sources/text`, {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}

export async function addSourceFile(
  notebookId: string,
  file: File
): Promise<Source> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/notebooks/${notebookId}/sources/file`,
    { method: "POST", credentials: "include", body: formData }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function deleteSource(
  notebookId: string,
  sourceId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/notebooks/${notebookId}/sources/${sourceId}`,
    { method: "DELETE" }
  );
}

// --- Chat ---

export async function sendMessage(
  notebookId: string,
  question: string,
  conversationId?: string,
  sourceIds?: string[]
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/api/notebooks/${notebookId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      question,
      conversation_id: conversationId ?? null,
      source_ids: sourceIds ?? null,
    }),
  });
}

export async function getChatHistory(
  notebookId: string,
  conversationId?: string
): Promise<ChatMessage[]> {
  const params = conversationId
    ? `?conversation_id=${encodeURIComponent(conversationId)}`
    : "";
  return apiFetch<ChatMessage[]>(
    `/api/notebooks/${notebookId}/chat/history${params}`
  );
}

// --- Content Generation ---

export async function generateContent(
  notebookId: string,
  type: string,
  sourceIds?: string[]
): Promise<GenerateResponse> {
  return apiFetch<GenerateResponse>(
    `/api/notebooks/${notebookId}/generate/${type}`,
    {
      method: "POST",
      body: JSON.stringify({ source_ids: sourceIds ?? null }),
    }
  );
}

export async function getArtifacts(
  notebookId: string
): Promise<Artifact[]> {
  return apiFetch<Artifact[]>(`/api/notebooks/${notebookId}/artifacts`);
}

export function getArtifactDownloadUrl(
  notebookId: string,
  artifactId: string
): string {
  return `${API_BASE}/api/notebooks/${notebookId}/artifacts/${artifactId}/download`;
}

// --- Auth ---

export interface AuthStatus {
  authenticated: boolean;
  notebooklm_authenticated: boolean;
  login_mode?: "local" | "remote";
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/api/auth/status`, { credentials: "include" });
  return res.json();
}

export async function startLogin(password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Failed to login" }));
    throw new Error(body.detail || `Error ${res.status}`);
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
}

// --- NotebookLM Google Login ---

interface NlmLoginResponse {
  status: string;
  message?: string;
}

export async function startNlmLogin(): Promise<NlmLoginResponse> {
  return apiFetch<NlmLoginResponse>("/api/auth/notebooklm/login", { method: "POST" });
}

export async function pollNlmLogin(): Promise<NlmLoginResponse> {
  return apiFetch<NlmLoginResponse>("/api/auth/notebooklm/poll");
}

export async function cancelNlmLogin(): Promise<void> {
  await apiFetch<void>("/api/auth/notebooklm/cancel", { method: "POST" });
}

export async function disconnectNlm(): Promise<void> {
  await apiFetch<void>("/api/auth/notebooklm/disconnect", { method: "POST" });
}

// --- Widget (Public) ---

export interface WidgetNotebook {
  id: string;
  title: string;
}

export interface WidgetConfig {
  title: string;
  welcome_message: string;
  notebooks: WidgetNotebook[];
}

export async function getWidgetConfig(): Promise<WidgetConfig> {
  const res = await fetch(`${API_BASE}/api/w/config`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function sendWidgetMessage(
  notebookId: string,
  question: string,
  conversationId?: string
): Promise<{ answer: string; conversation_id: string }> {
  const res = await fetch(`${API_BASE}/api/w/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notebook_id: notebookId,
      question,
      conversation_id: conversationId ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}
