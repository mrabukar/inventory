import { Stamp } from "lucide-react";

interface OrganizationStampPreviewProps {
  previewUrl: string | null;
  alt?: string;
}

export function OrganizationStampPreview({
  previewUrl,
  alt = "Organization stamp",
}: OrganizationStampPreviewProps) {
  return (
    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <Stamp className="size-8 text-muted-foreground" />
      )}
    </div>
  );
}

export const STAMP_ACCEPT = "image/png,image/jpeg";

export const STAMP_FIELD_DESCRIPTION =
  "PNG or JPG, up to 3MB. Shown next to the signature on invoices.";
