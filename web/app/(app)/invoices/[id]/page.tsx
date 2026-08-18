"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Button } from "@/components/ui/button";
import { useInvoice } from "@/hooks/invoices/use-invoices";
import { fetchOrganizationLogoBlob, fetchOrganizationStampBlob } from "@/service/upload";

const PRINT_CSS = `
@page { size: A5; margin: 10mm; }
@media print {
  body * { visibility: hidden !important; }
  .invoice-print, .invoice-print * { visibility: visible !important; }
  .invoice-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-no-print { display: none !important; }
}
`;

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: invoice, isPending, isError, error } = useInvoice(id);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);

  const logoKey = invoice?.organization.logoKey ?? null;
  const stampKey = invoice?.organization.stampKey ?? null;
  const numberLabel = invoice?.numberLabel;

  useEffect(() => {
    if (!numberLabel) return;
    const previous = document.title;
    document.title = numberLabel;
    return () => {
      document.title = previous;
    };
  }, [numberLabel]);

  useEffect(() => {
    if (!logoKey) return;
    let active = true;
    let objectUrl: string | null = null;
    void fetchOrganizationLogoBlob("current", undefined, null).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setLogoUrl(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logoKey]);

  useEffect(() => {
    if (!stampKey) return;
    let active = true;
    let objectUrl: string | null = null;
    void fetchOrganizationStampBlob(null).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setStampUrl(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stampKey]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !invoice) {
    return (
      <div className="alert-error">
        {error instanceof Error ? error.message : "Invoice not found."}
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="invoice-no-print mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            document.title = invoice.numberLabel;
            window.print();
          }}
        >
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      <InvoiceDocument invoice={invoice} logoUrl={logoUrl} stampUrl={stampUrl} />
    </>
  );
}
