"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthStatus, startLogin } from "@/lib/api";
import { Loader2, CheckCircle, AlertCircle, Lock } from "lucide-react";

type LoginState = "checking" | "idle" | "loading" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (status.authenticated) router.replace("/");
        else setState("idle");
      })
      .catch(() => setState("idle"));
  }, [router]);

  const handleLogin = async () => {
    if (!password) return;
    try {
      setState("loading");
      await startLogin(password);
      setState("success");
      setTimeout(() => router.replace("/"), 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Login failed.");
      setState("error");
    }
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

      <div className="relative w-full max-w-sm">
        {state === "idle" && (
          <div className="flex flex-col items-center">
            <div className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-neutral-900 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="text-center mb-8">
                <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Admin Login</h1>
                <p className="text-sm text-neutral-500 mt-1.5">Enter admin password to continue</p>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && password) handleLogin(); }}
                    placeholder="Password"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleLogin}
                disabled={!password}
                className="w-full h-11 rounded-xl bg-neutral-900 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign in
              </button>
            </div>

            <p className="text-xs text-neutral-400 mt-6">
              Powered by NotebookLM
            </p>
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col items-center">
            <div className="w-full bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
              <div className="flex flex-col items-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400 mb-4" />
                <p className="text-sm text-neutral-500">Signing in...</p>
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
                <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">Login failed</h2>
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
