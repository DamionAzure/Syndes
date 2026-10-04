import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Finishing sign in",
  description: "Complete your school Account sign in to Syndes.",
};

export default function AuthCallbackLayout({ children }: { children: ReactNode }) {
  return children;
}
