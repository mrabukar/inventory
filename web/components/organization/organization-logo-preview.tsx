import { ImageIcon } from "lucide-react";

interface OrganizationLogoPreviewProps {
  previewUrl: string | null;
  alt?: string;
}

export function OrganizationLogoPreview({
  previewUrl,
  alt = "Organization logo",
}: OrganizationLogoPreviewProps) {
  return (
    <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <ImageIcon className="size-8 text-muted-foreground" />
      )}
    </div>
  );
}

export const LOGO_ACCEPT = "image/png,image/jpeg";

export const LOGO_FIELD_DESCRIPTION =
  "PNG or JPG, up to 3MB. Used on exported PDF reports.";
