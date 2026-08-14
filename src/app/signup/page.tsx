import { SignUpForm } from "@/components/forms/SignUpForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "B2B Registration | Sojar Indusy",
  description: "Create an official business account with Sojar Indusy for B2B industrial manufacturing orders.",
};

export default function SignUpPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <SignUpForm />
    </div>
  );
}
