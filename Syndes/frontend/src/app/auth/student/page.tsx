import type { Metadata } from "next";
import { AuthEntry } from "@/features/auth/components/auth-entry";

export const metadata: Metadata = { title: "Student sign in" };

export default function StudentSignInPage() {
  return <AuthEntry audience="student" />;
}
