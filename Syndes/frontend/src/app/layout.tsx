import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { AccessProvider } from "@/components/access/access-provider";
import { AppAccessShell } from "@/components/access/app-access-shell";
import { preferenceScript } from "@/features/settings/preference-script";
import "@/styles/globals.css";

const lexend = localFont({
  src: "./fonts/lexend-latin-wght.woff2",
  weight: "100 900",
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Syndes", template: "%s · Syndes" },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The pre-paint script rewrites data-theme and data-controls, so React
    // must not treat those two attributes as a hydration mismatch.
    <html
      lang="en"
      data-theme="light"
      data-controls="default"
      className={lexend.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <AccessProvider>
          <AppAccessShell>{children}</AppAccessShell>
        </AccessProvider>
      </body>
    </html>
  );
}
