"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchOrganizationLogoBlob } from "@/service/upload";
import { useAppStore } from "@/store/app";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!hasLogo) {
      setPreviewUrl(null);
      return;
    }

    void fetchOrganizationLogoBlob(scope, organizationId, logoUpdatedAt).then(
      (url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
      },
    );

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [hasLogo, scope, organizationId, logoUpdatedAt]);

  const uploadMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: () => {
      addToast({ title: "Logo updated" });
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

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Report logo</h3>
        <p className="text-sm text-muted-foreground">
          PNG or JPG, up to 3MB. Used on exported PDF reports.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Organization logo"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              uploadMutation.mutate(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {hasLogo ? "Replace logo" : "Upload logo"}
          </Button>
          {hasLogo ? (
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
  );
}
