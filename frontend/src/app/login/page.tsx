"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus, startLogin, pollLogin, cancelLogin } from "@/lib/api";
import { Loader2, CheckCircle, AlertCircle, Globe } from "lucide-react";

type LoginState = "checking" | "idle" | "waiting" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (status.authenticated) router.replace("/");
        else setState("idle");
      })
      .catch(() => setState("idle"));
  }, [router]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleStartLogin = async () => {
    try {
      setState("waiting");
      const res = await startLogin();
      if (res.status === "already_authenticated") {
        setState("success");
        setTimeout(() => router.replace("/"), 800);
        return;
      }
      pollRef.current = setInterval(async () => {
        try {
          const poll = await pollLogin();
          if (poll.status === "authenticated") {
            stopPolling();
            setState("success");
            setTimeout(() => router.replace("/"), 800);
          } else if (poll.status === "error" || poll.status === "no_session") {
            stopPolling();
            setErrorMsg(poll.message || "Login session ended.");
            setState("error");
          }
        } catch {
          stopPolling();
          setErrorMsg("Failed to check login status.");
          setState("error");
        }
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start login.");
      setState("error");
    }
  };

  const handleCancel = async () => {
    stopPolling();
    try { await cancelLogin(); } catch { /* ignore */ }
    setState("idle");
  };

  if (state === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative w-full max-w-sm">
        {state === "idle" && (
          <div className="flex flex-col items-center">
            {/* Logo */}
            <div className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-neutral-900 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Card */}
            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="text-center mb-8">
                <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Welcome back</h1>
                <p className="text-sm text-neutral-500 mt-1.5">Sign in to your NotebookLM workspace</p>
              </div>

              <button
                onClick={handleStartLogin}
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <p className="text-xs text-neutral-400 text-center mt-6">
                A browser window will open for secure authentication
              </p>
            </div>

            <p className="text-xs text-neutral-400 mt-6">
              Powered by NotebookLM
            </p>
          </div>
        )}

        {state === "waiting" && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                  <Globe className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">Complete sign in</h2>
                <p className="text-sm text-neutral-500 mt-1.5 max-w-[260px]">
                  A browser window has opened. Sign in with your Google account there.
                </p>

                <div className="flex items-center gap-2 mt-6 mb-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                  <span className="text-sm text-neutral-500">Waiting for authentication...</span>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-neutral-100">
                <button
                  onClick={handleCancel}
                  className="w-full h-9 rounded-lg text-sm text-neutral-500 transition-colors hover:text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">You&apos;re in</h2>
                <p className="text-sm text-neutral-500 mt-1.5">Redirecting to your workspace...</p>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mb-5">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">Something went wrong</h2>
                <p className="text-sm text-neutral-500 mt-1.5 max-w-[260px]">{errorMsg}</p>
              </div>

              <div className="mt-6 pt-5 border-t border-neutral-100">
                <button
                  onClick={() => { setErrorMsg(""); setState("idle"); }}
                  className="w-full h-10 rounded-xl bg-neutral-900 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:scale-[0.98]"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
