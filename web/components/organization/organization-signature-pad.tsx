"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Signature } from "lucide-react";
import SignaturePad from "signature_pad";

export interface OrganizationSignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  toFile: () => File | null;
}

interface OrganizationSignaturePadProps {
  onStrokeChange?: (hasStrokes: boolean) => void;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export const OrganizationSignaturePad = forwardRef<
  OrganizationSignaturePadHandle,
  OrganizationSignaturePadProps
>(function OrganizationSignaturePad({ onStrokeChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const syncEmpty = useCallback(() => {
    const empty = padRef.current?.isEmpty() ?? true;
    setIsEmpty(empty);
    onStrokeChange?.(!empty);
  }, [onStrokeChange]);

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => {
        padRef.current?.clear();
        syncEmpty();
      },
      toFile: () => {
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) return null;
        return dataUrlToFile(pad.toDataURL("image/png"), "signature.png");
      },
    }),
    [syncEmpty],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgba(0,0,0,0)",
      penColor: "#171717",
      minWidth: 0.8,
      maxWidth: 2.5,
    });
    padRef.current = pad;

    const fitCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (!width || !height) return;

      const data = pad.toData();
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const context = canvas.getContext("2d");
      context?.scale(ratio, ratio);
      pad.clear();
      if (data.length) {
        pad.fromData(data);
      }
      syncEmpty();
    };

    fitCanvas();

    const handleBegin = () => {
      setIsEmpty(false);
      onStrokeChange?.(true);
    };
    const handleEnd = () => syncEmpty();

    pad.addEventListener("beginStroke", handleBegin);
    pad.addEventListener("endStroke", handleEnd);
    window.addEventListener("resize", fitCanvas);

    return () => {
      pad.removeEventListener("beginStroke", handleBegin);
      pad.removeEventListener("endStroke", handleEnd);
      window.removeEventListener("resize", fitCanvas);
      pad.off();
      padRef.current = null;
    };
  }, [onStrokeChange, syncEmpty]);

  return (
    <div className="relative h-36 w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 bottom-8 border-b border-neutral-300"
      />
      {isEmpty ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <Signature className="size-8" />
          <span className="text-sm">Sign here</span>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="relative z-20 h-full w-full touch-none cursor-crosshair"
      />
    </div>
  );
});
