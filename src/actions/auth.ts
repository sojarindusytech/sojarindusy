"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, UserRole, UserTitle } from "@/types/database.types";
import { fullSignUpSchema, loginSchema } from "@/lib/validations/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface SignUpState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function signUpUser(formData: FormData): Promise<SignUpState> {
  const supabase = await createClient();

  // Extract raw fields
  const rawData = {
    title: (formData.get("title") as string) || "Mr",
    first_name: (formData.get("first_name") as string)?.trim(),
    last_name: (formData.get("last_name") as string)?.trim(),
    department: (formData.get("department") as string)?.trim(),
    designation: (formData.get("designation") as string)?.trim(),
    mobile: (formData.get("mobile") as string)?.trim(),
    landline: (formData.get("landline") as string)?.trim() || undefined,
    email: (formData.get("email") as string)?.trim().toLowerCase(),
    password: formData.get("password") as string,
    confirm_password: formData.get("confirm_password") as string,
    company_name: (formData.get("company_name") as string)?.trim(),
    company_address: (formData.get("company_address") as string)?.trim(),
    additional_address: (formData.get("additional_address") as string)?.trim() || undefined,
    gstin: (formData.get("gstin") as string)?.trim() || undefined,
    city: (formData.get("city") as string)?.trim(),
    state: (formData.get("state") as string)?.trim(),
    pincode: (formData.get("pincode") as string)?.trim(),
  };

  const role: UserRole = (formData.get("role") as UserRole) || "customer";

  // Zod Server Validation
  const validationResult = fullSignUpSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      error: validationResult.error.issues[0]?.message || "Validation failed.",
    };
  }

  const validated = validationResult.data;

  const userMetadata = {
    role,
    title: validated.title as UserTitle,
    first_name: validated.first_name,
    last_name: validated.last_name,
    department: validated.department,
    designation: validated.designation,
    mobile: validated.mobile,
    landline: validated.landline || null,
    company_name: validated.company_name,
    company_address: validated.company_address,
    additional_address: validated.additional_address || null,
    gstin: validated.gstin || null,
    city: validated.city,
    state: validated.state,
    pincode: validated.pincode,
  };

  // 1. Sign up user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
    options: {
      data: userMetadata,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: "Signup could not be completed. Please try again." };
  }

  // 2. Insert profile record in database
  const profileRecord: Profile = {
    id: authData.user.id,
    role,
    title: validated.title as UserTitle,
    first_name: validated.first_name,
    last_name: validated.last_name,
    department: validated.department,
    designation: validated.designation,
    mobile: validated.mobile,
    landline: validated.landline || null,
    email: validated.email,
    company_name: validated.company_name,
    company_address: validated.company_address,
    additional_address: validated.additional_address || null,
    gstin: validated.gstin || null,
    city: validated.city,
    state: validated.state,
    pincode: validated.pincode,
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profileRecord as never, { onConflict: "id" });

  if (profileError) {
    console.warn("Profile table insert notice:", profileError.message);
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    message: "Registration successful! You can now log in to your account.",
  };
}

export async function signInUser(
  emailInput: string,
  passwordInput: string
): Promise<{ error?: string; redirectUrl?: string }> {
  const supabase = await createClient();

  const validationResult = loginSchema.safeParse({
    email: emailInput?.trim().toLowerCase(),
    password: passwordInput,
  });

  if (!validationResult.success) {
    return { error: validationResult.error.issues[0]?.message || "Invalid credentials." };
  }

  const { email, password } = validationResult.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Unable to sign in. Please try again." };
  }

  // Fetch profile to determine role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const profileData = profile as { role?: UserRole } | null;
  const userRole = profileData?.role || (data.user.user_metadata?.role as UserRole) || "customer";

  revalidatePath("/", "layout");

  if (userRole === "platform_owner") {
    return { redirectUrl: "/admin/dashboard" };
  }

  return { redirectUrl: "/dashboard" };
}

export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getCurrentUserProfile(): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Fallback profile object from user metadata
    const meta = user.user_metadata || {};
    const fallbackProfile: Profile = {
      id: user.id,
      role: (meta.role as UserRole) || "customer",
      title: (meta.title as UserTitle) || "Mr",
      first_name: meta.first_name || "User",
      last_name: meta.last_name || "",
      department: meta.department || "Operations",
      designation: meta.designation || "Member",
      mobile: meta.mobile || "-",
      landline: meta.landline || null,
      email: user.email || "",
      company_name: meta.company_name || "Sojar Indusy Partner",
      company_address: meta.company_address || "Industrial Area",
      additional_address: meta.additional_address || null,
      gstin: meta.gstin || null,
      city: meta.city || "Mumbai",
      state: meta.state || "Maharashtra",
      pincode: meta.pincode || "400001",
      created_at: user.created_at,
      updated_at: user.created_at,
    };
    return {
      user: { id: user.id, email: user.email || "" },
      profile: fallbackProfile,
    };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    profile: profile as unknown as Profile,
  };
}
