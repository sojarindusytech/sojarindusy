import { SignUpForm } from "@/components/forms/SignUpForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Sojar Indusy",
  description: "Create an account with Sojar Indusy.",
};

export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50/70 py-8 px-4">
      <SignUpForm />
    </div>
  );
}
