import { SignUpForm } from "@/components/forms/SignUpForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Sojar Indusy",
  description: "Create an account with Sojar Indusy.",
};

export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] bg-white py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <SignUpForm />
      </div>
    </div>
  );
}
