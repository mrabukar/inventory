import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "inventory",
    template: "%s · inventory",
  },
  description: "Multi-location inventory management system",
  icons: {
    icon: "/logo-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
