import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AccessProvider } from "@/components/access/access-provider";
import { AppShell } from "@/components/layout/app-shell";
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

// viewport-fit=cover makes phones report the status-bar inset to CSS
// (env(safe-area-inset-top)), which the header uses on Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The pre-paint script rewrites data-theme and data-controls and may add
    // data-platform, so React must not treat those as a hydration mismatch.
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
          <AppShell>{children}</AppShell>
        </AccessProvider>
      </body>
    </html>
  );
}
