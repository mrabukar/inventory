"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchOrganizationStampBlob } from "@/service/upload";
import { useAppStore } from "@/store/app";

import {
  STAMP_ACCEPT,
  STAMP_FIELD_DESCRIPTION,
  OrganizationStampPreview,
} from "./organization-stamp-preview";

interface OrganizationStampUploadProps {
  hasStamp: boolean;
  stampUpdatedAt?: string | null;
  onUploaded: () => void;
  onDeleted: () => void;
  uploadStamp: (file: File) => Promise<unknown>;
  deleteStamp: () => Promise<unknown>;
}

export function OrganizationStampUpload({
  hasStamp,
  stampUpdatedAt,
  onUploaded,
  onDeleted,
  uploadStamp,
  deleteStamp,
}: OrganizationStampUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [savedPreviewUrl, setSavedPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!hasStamp) {
      setSavedPreviewUrl(null);
      return;
    }

    void fetchOrganizationStampBlob(stampUpdatedAt).then((url) => {
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
  }, [hasStamp, stampUpdatedAt]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const clearPending = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  const uploadMutation = useMutation({
    mutationFn: uploadStamp,
    onSuccess: () => {
      addToast({ title: "Stamp updated" });
      clearPending();
      onUploaded();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Stamp upload failed", sub: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStamp,
    onSuccess: () => {
      addToast({ title: "Stamp removed" });
      onDeleted();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Failed to remove stamp", sub: error.message });
    },
  });

  const busy = uploadMutation.isPending || deleteMutation.isPending;
  const previewUrl = pendingPreviewUrl ?? savedPreviewUrl;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Business stamp</h3>
        <p className="text-sm text-muted-foreground">{STAMP_FIELD_DESCRIPTION}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <OrganizationStampPreview previewUrl={previewUrl} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {pendingFile ? (
            <p className="text-sm text-muted-foreground">
              Preview ready — upload to save, or cancel to keep the current
              stamp.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={STAMP_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setPendingPreviewUrl((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return URL.createObjectURL(file);
                });
                setPendingFile(file);
              }}
            />

            {pendingFile ? (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => uploadMutation.mutate(pendingFile)}
                >
                  <Upload className="size-4" />
                  {uploadMutation.isPending ? "Uploading…" : "Upload stamp"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={clearPending}
                >
                  <X className="size-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                {hasStamp ? "Replace stamp" : "Choose stamp"}
              </Button>
            )}

            {hasStamp && !pendingFile ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
