import { FileText, Phone, User } from "lucide-react";

import { formatDisplayDate } from "@/lib/filters/dates";
import { formatProductLabel } from "@/lib/products/format";
import { toNumber } from "@/lib/reports/format";
import { fmt, initials } from "@/lib/utils";
import type { Invoice } from "@/types/invoices/invoice";

interface InvoiceDocumentProps {
  invoice: Invoice;
  logoUrl: string | null;
}

export function InvoiceDocument({ invoice, logoUrl }: InvoiceDocumentProps) {
  const total = toNumber(invoice.total);
  const paid = toNumber(invoice.paidAmount);
  const balance = total - paid;
  const org = invoice.organization;
  const customer = invoice.customer;
  const sale = invoice.sale;

  return (
    <div className="invoice-print mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-8 text-sm text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="border-l-4 border-[#2563EB] pl-3 text-2xl font-bold tracking-wide text-[#0B1F4B] uppercase">
            Invoice
          </div>
          <div className="mt-2 text-base font-bold text-neutral-900">
            {invoice.numberLabel}
          </div>
          <div className="mt-1 text-neutral-500">
            {formatDisplayDate(invoice.issuedAt)}
          </div>
        </div>
        <div className="flex w-20 flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mb-2 size-14 rounded-lg object-cover"
            />
          ) : (
            <div className="mb-2 flex size-14 items-center justify-center rounded-lg bg-[#0B1F4B] text-sm font-semibold text-white">
              {initials(org.name)}
            </div>
          )}
          <div className="text-sm font-bold text-neutral-900">{org.name}</div>
        </div>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-lg border border-neutral-200 bg-[#F4F7FB] px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#DBEAFE] text-[#2563EB]">
          <User className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wide text-[#2563EB] uppercase">
            Bill to
          </div>
          {customer ? (
            <>
              <div className="mt-0.5 font-bold text-neutral-900">
                {customer.name}
              </div>
              {customer.phone ? (
                <div className="text-neutral-600">{customer.phone}</div>
              ) : null}
            </>
          ) : (
            <div className="mt-0.5 font-bold text-neutral-500">Walk-in</div>
          )}
          {sale.location ? (
            <div className="text-neutral-500">Location: {sale.location.name}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#0B1F4B] text-[11px] font-semibold tracking-wide text-white uppercase">
              <th className="px-4 py-2.5 font-semibold">Item</th>
              <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Unit price
              </th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-neutral-200 first:border-t-0"
              >
                <td className="px-4 py-3">
                  {formatProductLabel(item.product.name, item.product.model)}
                </td>
                <td className="px-3 py-3 text-center">{item.quantitySold}</td>
                <td className="px-3 py-3 text-right">
                  {fmt(toNumber(item.unitPrice))}
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {fmt(toNumber(item.lineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-start justify-between gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#DBEAFE] text-[#2563EB]">
            <FileText className="size-4" />
          </div>
          <div>
            <div className="font-bold text-[#2563EB]">Thank you!</div>
            <p className="mt-0.5 text-neutral-500">
              We appreciate your business and look forward to working with you
              again.
            </p>
            {sale.note ? (
              <p className="mt-2 text-neutral-600">
                <span className="font-semibold">Note: </span>
                {sale.note}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full max-w-55 shrink-0 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-bold">{fmt(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Paid</span>
            <span className="font-bold">{fmt(paid)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-neutral-300 pt-2 text-base">
            <span className="font-bold text-[#2563EB]">Balance due</span>
            <span className="text-lg font-bold text-[#0B1F4B]">
              {fmt(balance)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-5 text-center">
        <div className="font-bold text-[#0B1F4B]">{org.name}</div>
        {org.address ? (
          <div className="mt-0.5 text-neutral-500">{org.address}</div>
        ) : null}
        {org.phone ? (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-neutral-600">
            <span className="flex size-5 items-center justify-center rounded-full bg-[#2563EB] text-white">
              <Phone className="size-2.5" />
            </span>
            Phone: {org.phone}
          </div>
        ) : null}
        {org.paymentNumber ? (
          <>
            <div className="mx-auto mt-3 h-px w-16 bg-[#2563EB]" />
            <div className="mt-3 text-neutral-600">
              Pay to:{" "}
              <span className="font-bold text-[#0B1F4B]">
                {org.paymentNumber}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
