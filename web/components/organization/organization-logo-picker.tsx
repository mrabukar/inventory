"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  LOGO_ACCEPT,
  LOGO_FIELD_DESCRIPTION,
  OrganizationLogoPreview,
} from "./organization-logo-preview";

interface OrganizationLogoPickerProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function OrganizationLogoPicker({
  value,
  onChange,
  disabled = false,
}: OrganizationLogoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  const clear = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Report logo</p>
        <p className="text-sm text-muted-foreground">{LOGO_FIELD_DESCRIPTION}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <OrganizationLogoPreview previewUrl={previewUrl} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {value ? (
            <p className="text-sm text-muted-foreground">
              {value.name} — this logo will upload when you create the organization.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Optional. Choose a logo to preview it before saving.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                onChange(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {value ? "Change logo" : "Choose logo"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={clear}
              >
                <X className="size-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
