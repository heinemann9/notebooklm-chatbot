"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { API_BASE } from "@/lib/api";
import { Loader2 } from "lucide-react";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

interface RemoteBrowserProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function RemoteBrowser({ onSuccess, onError }: RemoteBrowserProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/auth/login/ws`);
    wsRef.current = ws;

    const img = new Image();
    imgRef.current = img;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      if (!firstFrame) setFirstFrame(true);
    };

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "screenshot" && msg.data) {
          img.src = `data:image/png;base64,${msg.data}`;
        } else if (msg.type === "status" && msg.authenticated) {
          onSuccess();
        } else if (msg.type === "error") {
          onError(msg.message || "Unknown error");
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => onError("WebSocket connection failed");
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code !== 1000 && e.code !== 4001 && e.code !== 4003) {
        // Don't report expected close codes as errors
      }
    };

    return () => { ws.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = VIEWPORT_WIDTH / rect.width;
      const scaleY = VIEWPORT_HEIGHT / rect.height;
      sendMessage({ type: "click", x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
    },
    [sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const specialKeys = new Set(["Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Space"]);
      if (specialKeys.has(e.key)) {
        sendMessage({ type: "keypress", key: e.key });
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        sendMessage({ type: "type", text: e.key });
      }
    },
    [sendMessage]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      sendMessage({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-xl overflow-hidden border border-neutral-200 shadow-lg bg-neutral-900">
        {!firstFrame && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10" style={{ aspectRatio: `${VIEWPORT_WIDTH}/${VIEWPORT_HEIGHT}` }}>
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">{connected ? "Loading browser..." : "Connecting..."}</span>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          className="w-full max-w-[960px] h-auto cursor-pointer outline-none"
          style={{ aspectRatio: `${VIEWPORT_WIDTH}/${VIEWPORT_HEIGHT}` }}
        />
      </div>
      <p className="text-[10px] text-neutral-400">Click to interact. Keyboard input is captured when focused.</p>
    </div>
  );
}
