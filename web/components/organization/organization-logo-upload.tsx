"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchOrganizationLogoBlob } from "@/service/upload";
import { useAppStore } from "@/store/app";

import {
  LOGO_ACCEPT,
  LOGO_FIELD_DESCRIPTION,
  OrganizationLogoPreview,
} from "./organization-logo-preview";

interface OrganizationLogoUploadProps {
  scope: "current" | "organization";
  organizationId?: string;
  hasLogo: boolean;
  logoUpdatedAt?: string | null;
  onUploaded: () => void;
  onDeleted: () => void;
  uploadLogo: (file: File) => Promise<unknown>;
  deleteLogo: () => Promise<unknown>;
}

export function OrganizationLogoUpload({
  scope,
  organizationId,
  hasLogo,
  logoUpdatedAt,
  onUploaded,
  onDeleted,
  uploadLogo,
  deleteLogo,
}: OrganizationLogoUploadProps) {
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

    if (!hasLogo) {
      setSavedPreviewUrl(null);
      return;
    }

    void fetchOrganizationLogoBlob(scope, organizationId, logoUpdatedAt).then(
      (url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSavedPreviewUrl(url);
      },
    );

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [hasLogo, scope, organizationId, logoUpdatedAt]);

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
    mutationFn: uploadLogo,
    onSuccess: () => {
      addToast({ title: "Logo updated" });
      clearPending();
      onUploaded();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Logo upload failed", sub: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLogo,
    onSuccess: () => {
      addToast({ title: "Logo removed" });
      onDeleted();
    },
    onError: (error: Error) => {
      addErrorToast({ title: "Failed to remove logo", sub: error.message });
    },
  });

  const busy = uploadMutation.isPending || deleteMutation.isPending;
  const previewUrl = pendingPreviewUrl ?? savedPreviewUrl;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Report logo</h3>
        <p className="text-sm text-muted-foreground">{LOGO_FIELD_DESCRIPTION}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <OrganizationLogoPreview previewUrl={previewUrl} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {pendingFile ? (
            <p className="text-sm text-muted-foreground">
              Preview ready — upload to save, or cancel to keep the current logo.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
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
                  {uploadMutation.isPending ? "Uploading…" : "Upload logo"}
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
                {hasLogo ? "Replace logo" : "Choose logo"}
              </Button>
            )}

            {hasLogo && !pendingFile ? (
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
