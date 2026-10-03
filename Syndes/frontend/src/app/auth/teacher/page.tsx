import type { Metadata } from "next";
import { AuthEntry } from "@/features/auth/components/auth-entry";

export const metadata: Metadata = { title: "Teacher sign in" };

export default function TeacherSignInPage() {
  return <AuthEntry audience="teacher" />;
}
