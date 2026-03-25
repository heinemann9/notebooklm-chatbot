"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus, startNlmLogin, pollNlmLogin, cancelNlmLogin, disconnectNlm } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Loader2, CheckCircle, AlertCircle, Globe, ArrowLeft, Plug, Unplug } from "lucide-react";
import RemoteBrowser from "@/components/RemoteBrowser";

type NlmState = "idle" | "connecting" | "connected" | "error";

export default function SettingsPage() {
  const router = useRouter();
  const { checking, authenticated } = useAuthGuard();
  const [nlmConnected, setNlmConnected] = useState(false);
  const [loginMode, setLoginMode] = useState<"local" | "remote">("local");
  const [nlmState, setNlmState] = useState<NlmState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    getAuthStatus()
      .then((s) => {
        setNlmConnected(s.notebooklm_authenticated);
        setLoginMode(s.login_mode === "remote" ? "remote" : "local");
        setNlmState(s.notebooklm_authenticated ? "connected" : "idle");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authenticated]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleConnect = async () => {
    try {
      if (loginMode === "remote") {
        setNlmState("connecting");
        return;
      }
      setNlmState("connecting");
      const res = await startNlmLogin();
      if (res.status === "already_connected") {
        setNlmConnected(true);
        setNlmState("connected");
        return;
      }
      pollRef.current = setInterval(async () => {
        try {
          const poll = await pollNlmLogin();
          if (poll.status === "connected") {
            stopPolling();
            setNlmConnected(true);
            setNlmState("connected");
          } else if (poll.status === "error" || poll.status === "no_session") {
            stopPolling();
            setErrorMsg(poll.message || "Login session ended.");
            setNlmState("error");
          }
        } catch {
          stopPolling();
          setErrorMsg("Failed to check login status.");
          setNlmState("error");
        }
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start Google login.");
      setNlmState("error");
    }
  };

  const handleRemoteSuccess = useCallback(() => {
    setNlmConnected(true);
    setNlmState("connected");
  }, []);

  const handleRemoteError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setNlmState("error");
  }, []);

  const handleCancel = async () => {
    stopPolling();
    try { await cancelNlmLogin(); } catch { /* ignore */ }
    setNlmState("idle");
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google account? Customers will not be able to chat until reconnected.")) return;
    try {
      await disconnectNlm();
      setNlmConnected(false);
      setNlmState("idle");
    } catch {
      setErrorMsg("Failed to disconnect.");
      setNlmState("error");
    }
  };

  if (checking || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]" />

      <header className="relative border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-neutral-900 tracking-tight">Settings</span>
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-1">NotebookLM Connection</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Connect a Google account to enable NotebookLM features for admin and customer chat.
          </p>

          {nlmState === "connected" || (nlmState === "idle" && nlmConnected) ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-3">
                <Plug className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Connected</p>
                  <p className="text-xs text-emerald-600">Google account is linked to NotebookLM</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : nlmState === "idle" ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <Unplug className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">Not connected</p>
              <p className="text-sm text-neutral-500 mb-6">Sign in with Google to connect NotebookLM</p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-3 h-11 px-6 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect with Google
              </button>
            </div>
          ) : nlmState === "connecting" && loginMode === "local" ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">Complete sign in</p>
              <p className="text-sm text-neutral-500 mb-2">A browser window has opened. Sign in with your Google account.</p>
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
                <span className="text-sm text-neutral-500">Waiting for authentication...</span>
              </div>
              <button onClick={handleCancel} className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
                Cancel
              </button>
            </div>
          ) : nlmState === "connecting" && loginMode === "remote" ? (
            <div>
              <div className="text-center mb-4">
                <p className="text-sm text-neutral-500">Complete Google login in the browser view below</p>
              </div>
              <RemoteBrowser
                wsUrl={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}`.replace(/^http/, "ws") + "/api/auth/notebooklm/ws"}
                onSuccess={handleRemoteSuccess}
                onError={handleRemoteError}
              />
              <div className="mt-4 text-center">
                <button onClick={handleCancel} className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : nlmState === "error" ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">Connection failed</p>
              <p className="text-sm text-neutral-500 mb-4">{errorMsg}</p>
              <button
                onClick={() => { setErrorMsg(""); setNlmState("idle"); }}
                className="h-9 px-4 rounded-lg bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
