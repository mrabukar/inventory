"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PenLine, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchOrganizationSignatureBlob } from "@/service/upload";
import { useAppStore } from "@/store/app";

import {
  OrganizationSignaturePad,
  type OrganizationSignaturePadHandle,
} from "./organization-signature-pad";

const SIGNATURE_FIELD_DESCRIPTION =
  "Draw the authorized signature. It appears on the signature line on every invoice.";

interface OrganizationSignatureUploadProps {
  hasSignature: boolean;
  signatureUpdatedAt?: string | null;
  onUploaded: () => void;
  onDeleted: () => void;
  uploadSignature: (file: File) => Promise<unknown>;
  deleteSignature: () => Promise<unknown>;
}

export function OrganizationSignatureUpload({
  hasSignature,
  signatureUpdatedAt,
  onUploaded,
  onDeleted,
  uploadSignature,
  deleteSignature,
}: OrganizationSignatureUploadProps) {
  const padRef = useRef<OrganizationSignaturePadHandle>(null);
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [savedPreviewUrl, setSavedPreviewUrl] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const isDrawing = isReplacing || !hasSignature;

  useEffect(() => {
    if (!hasSignature || isDrawing) {
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void fetchOrganizationSignatureBlob(signatureUpdatedAt).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setSavedPreviewUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [hasSignature, isDrawing, signatureUpdatedAt]);

  const uploadMutation = useMutation({
    mutationFn: uploadSignature,
    onSuccess: () => {
      addToast({ title: "Signature saved" });
      setIsReplacing(false);
      setHasStrokes(false);
      onUploaded();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Signature save failed", sub: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSignature,
    onSuccess: () => {
      addToast({ title: "Signature removed" });
      setIsReplacing(false);
      setHasStrokes(false);
      onDeleted();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Failed to remove signature", sub: error.message });
    },
  });

  const busy = uploadMutation.isPending || deleteMutation.isPending;

  const handleSave = () => {
    const file = padRef.current?.toFile();
    if (!file) {
      addErrorToast({ title: "Draw a signature first" });
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Signature</h3>
        <p className="text-sm text-muted-foreground">
          {SIGNATURE_FIELD_DESCRIPTION}
        </p>
      </div>

      {isDrawing ? (
        <OrganizationSignaturePad
          ref={padRef}
          onStrokeChange={setHasStrokes}
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
          {savedPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={savedPreviewUrl}
              alt="Organization signature"
              className="max-h-full max-w-full object-contain object-bottom"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading signature…</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isDrawing ? (
          <>
            <Button
              type="button"
              disabled={busy || !hasStrokes}
              onClick={handleSave}
            >
              <PenLine className="size-4" />
              {uploadMutation.isPending ? "Saving…" : "Save signature"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !hasStrokes}
              onClick={() => padRef.current?.clear()}
            >
              Clear
            </Button>
            {hasSignature ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setIsReplacing(false);
                  setHasStrokes(false);
                }}
              >
                <X className="size-4" />
                Cancel
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setIsReplacing(true);
                setHasStrokes(false);
              }}
            >
              <PenLine className="size-4" />
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
