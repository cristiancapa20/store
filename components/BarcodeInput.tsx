"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  disabled?: boolean;
  initialMode?: Mode;
}

type Mode = "camera" | "scanner";
type CameraState = "idle" | "active" | "denied" | "error";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): NativeBarcodeDetector;
    };
  }
}

interface NativeBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

export default function BarcodeInput({ onScan, disabled, initialMode = "scanner" }: BarcodeInputProps) {
  const t = useTranslations("barcode");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const bufferRef = useRef<string>("");
  const lastKeystrokeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Camera start/stop effect — async IIFE so setState only runs after awaits
  useEffect(() => {
    if (mode !== "camera") {
      stopCamera();
      const t1 = setTimeout(() => setCameraState("idle"), 0);
      const t2 = setTimeout(() => scannerInputRef.current?.focus(), 50);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    let cancelled = false;

    const triggerHaptic = () => {
      if ("vibrate" in navigator) navigator.vibrate(50);
    };

    const handleDetected = (barcode: string) => {
      if (!barcode || cancelled) return;
      triggerHaptic();
      setLastBarcode(barcode);
      setShowOverlay(true);
      setTimeout(() => setShowOverlay(false), 800);
      onScanRef.current(barcode);
    };

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          setCameraState("denied");
        } else {
          setCameraState("error");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraState("active");

      const video = videoRef.current!;

      if (window.BarcodeDetector) {
        // Native BarcodeDetector (Chrome/Android)
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code", "data_matrix"],
        });
        const scan = async () => {
          if (cancelled) return;
          try {
            const results = await detector.detect(video);
            if (results.length > 0) handleDetected(results[0].rawValue);
          } catch {
            // ignore per-frame errors
          }
          if (!cancelled) animFrameRef.current = requestAnimationFrame(scan);
        };
        animFrameRef.current = requestAnimationFrame(scan);
      } else {
        // zxing fallback (Safari/iOS)
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) handleDetected(result.getText());
        });
        zxingControlsRef.current = controls;
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, stopCamera]);

  const handleScannerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      if (now - lastKeystrokeRef.current > 100) {
        bufferRef.current = "";
      }
      lastKeystrokeRef.current = now;

      if (e.key === "Enter") {
        const barcode = bufferRef.current.trim();
        bufferRef.current = "";
        if (barcode) {
          onScanRef.current(barcode);
          if ("vibrate" in navigator) navigator.vibrate(50);
          setLastBarcode(barcode);
        }
        e.preventDefault();
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    []
  );

  return (
    <div className="flex flex-col gap-3 w-full min-w-0 max-w-full">
      {/* Mode toggle */}
      <div className="ui-segment-track w-full">
        <button
          type="button"
          onClick={() => setMode("scanner")}
          disabled={disabled}
          className={mode === "scanner" ? "ui-segment-on" : "ui-segment-off"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
          {t("scannerMode")}
        </button>
        <button
          type="button"
          onClick={() => setMode("camera")}
          disabled={disabled}
          className={mode === "camera" ? "ui-segment-on" : "ui-segment-off"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t("cameraMode")}
        </button>
      </div>

      {/* Scanner mode: invisible focused input captures HID keystrokes */}
      {mode === "scanner" && (
        <div className="relative">
          <input
            ref={scannerInputRef}
            type="text"
            aria-label={t("scannerInput")}
            className="sr-only"
            onKeyDown={handleScannerKeyDown}
            onChange={() => {}}
            value=""
            tabIndex={0}
            disabled={disabled}
          />
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-400/35 bg-surface dark:bg-brand-900 p-6 text-center cursor-pointer min-h-[120px] shadow-[0_8px_28px_rgba(3,15,34,0.06)]"
            onClick={() => scannerInputRef.current?.focus()}
          >
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("scannerReady")}
            </p>
            {lastBarcode && (
              <p className="text-xs text-brand-600 dark:text-brand-400 font-mono">
                {t("lastScanned", { barcode: lastBarcode })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Camera mode: viewfinder + overlays */}
      {mode === "camera" && (
        <div className="relative rounded-3xl overflow-hidden bg-black aspect-video w-full shadow-[0_12px_40px_rgba(3,15,34,0.15)]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />

          {/* Green border flash on detection */}
          {showOverlay && (
            <div className="absolute inset-0 border-4 border-brand-400 rounded-2xl pointer-events-none animate-pulse" />
          )}

          {/* Scanning reticle when active */}
          {cameraState === "active" && !showOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-3/4 h-16 border-2 border-white/40 rounded-lg">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-400 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-400 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-400 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-400 rounded-br" />
              </div>
            </div>
          )}

          {/* Loading spinner while waiting for camera permission */}
          {cameraState === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-sm">{t("requestingCamera")}</p>
              </div>
            </div>
          )}

          {/* Permission denied */}
          {cameraState === "denied" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3 text-white px-6 text-center">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-sm font-medium">{t("cameraDenied")}</p>
                <p className="text-xs text-white/70">
                  {t("cameraDeniedHint")}
                </p>
                <button
                  type="button"
                  onClick={() => { setCameraState("idle"); setMode("scanner"); setTimeout(() => setMode("camera"), 50); }}
                  className="mt-1 px-4 py-2 bg-white text-black text-sm font-medium rounded-2xl min-h-[48px] min-w-[120px]"
                >
                  {t("retry")}
                </button>
              </div>
            </div>
          )}

          {/* Generic error */}
          {cameraState === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3 text-white px-6 text-center">
                <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium">{t("cameraError")}</p>
                <button
                  type="button"
                  onClick={() => { setMode("scanner"); setTimeout(() => setMode("camera"), 50); }}
                  className="mt-1 px-4 py-2 bg-white text-black text-sm font-medium rounded-2xl min-h-[48px] min-w-[120px]"
                >
                  {t("retry")}
                </button>
              </div>
            </div>
          )}

          {/* Last scanned badge */}
          {lastBarcode && cameraState === "active" && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/60 rounded-xl px-3 py-1.5">
              <p className="text-xs text-white font-mono truncate">Last: {lastBarcode}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
