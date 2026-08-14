"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, UserRole, UserTitle } from "@/types/database.types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface SignUpState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function signUpUser(formData: FormData): Promise<SignUpState> {
  const supabase = await createClient();

  // Extract personal/contact fields
  const title = (formData.get("title") as UserTitle) || "Mr";
  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const department = (formData.get("department") as string)?.trim();
  const designation = (formData.get("designation") as string)?.trim();
  const mobile = (formData.get("mobile") as string)?.trim();
  const landline = (formData.get("landline") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;
  const role: UserRole = (formData.get("role") as UserRole) || "customer";

  // Extract company fields
  const companyName = (formData.get("company_name") as string)?.trim();
  const companyAddress = (formData.get("company_address") as string)?.trim();
  const additionalAddress = (formData.get("additional_address") as string)?.trim() || null;
  const gstin = (formData.get("gstin") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const pincode = (formData.get("pincode") as string)?.trim();

  // Validations
  if (!firstName || !lastName || !email || !password || !companyName || !companyAddress || !city || !state || !pincode) {
    return { error: "Please fill in all mandatory fields." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (mobile.length < 10) {
    return { error: "Please enter a valid 10-digit mobile number." };
  }

  const userMetadata = {
    role,
    title,
    first_name: firstName,
    last_name: lastName,
    department,
    designation,
    mobile,
    landline,
    company_name: companyName,
    company_address: companyAddress,
    additional_address: additionalAddress,
    gstin,
    city,
    state,
    pincode,
  };

  // 1. Sign up user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
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
    title,
    first_name: firstName,
    last_name: lastName,
    department,
    designation,
    mobile,
    landline,
    email,
    company_name: companyName,
    company_address: companyAddress,
    additional_address: additionalAddress,
    gstin,
    city,
    state,
    pincode,
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
  const email = emailInput?.trim().toLowerCase();

  if (!email || !passwordInput) {
    return { error: "Please provide both email and password." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: passwordInput,
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
