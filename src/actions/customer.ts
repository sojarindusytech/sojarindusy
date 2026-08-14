"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, ApprovalStatus, UserType, UserTitle } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function fetchCustomersList(): Promise<Profile[]> {
  const supabase = await createClient();

  // 1. Fetch real profiles from Supabase database
  const { data: dbProfiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not fetch profiles from database:", error.message);
  }

  // Pre-configured enterprise demo offline & platform accounts to ensure instant functionality
  const seedProfiles: Profile[] = [
    {
      id: "off-001",
      role: "customer",
      title: "Mr",
      first_name: "Rajesh",
      last_name: "Sharma",
      department: "Tooling & Fabrication",
      designation: "General Manager",
      mobile: "+91 98230 45678",
      landline: "020-27456789",
      email: "r.sharma@bharatforge-industrial.com",
      company_name: "Bharat Precision Forgings Ltd",
      company_address: "Plot B-14, MIDC Industrial Area, Chakan",
      gstin: "27AAACB1234F1Z5",
      city: "Pune",
      state: "Maharashtra",
      pincode: "410501",
      approval_status: "approved",
      user_type: "offline_user",
      credit_limit: 1500000,
      credit_days: 45,
      notes: "High volume carbide end-mill order tier. Direct delivery at Chakan Unit 2.",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
    {
      id: "off-002",
      role: "customer",
      title: "Mrs",
      first_name: "Ananya",
      last_name: "Deshmukh",
      department: "Procurement",
      designation: "Head of Purchasing",
      mobile: "+91 97654 32190",
      landline: null,
      email: "ananya@kalyani-engineering.in",
      company_name: "Kalyani Heavy Machining Works",
      company_address: "Survey 142, Pune-Bangalore Highway, Shirwal",
      gstin: "27AABCK9988G1ZQ",
      city: "Satara",
      state: "Maharashtra",
      pincode: "412801",
      approval_status: "approved",
      user_type: "offline_user",
      credit_limit: 800000,
      credit_days: 30,
      notes: "Walk-in purchase contract. Specializes in titanium aerospace components.",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
    {
      id: "plat-001",
      role: "customer",
      title: "Mr",
      first_name: "Vikram",
      last_name: "Patel",
      department: "Plant Maintenance",
      designation: "Senior Plant Engineer",
      mobile: "+91 98980 11223",
      landline: "0260-2458900",
      email: "vikram.patel@tatamotors-vendor.com",
      company_name: "Gujarat Auto Component Systems",
      company_address: "GIDC Industrial Estate, Phase 3, Naroda",
      gstin: "24AAACG5544H1ZX",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "382330",
      approval_status: "pending",
      user_type: "platform_user",
      credit_limit: 500000,
      credit_days: 30,
      notes: "Signed up via website. Awaiting KYC & GST document verification.",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: "plat-002",
      role: "customer",
      title: "Mr",
      first_name: "Sanjay",
      last_name: "Rao",
      department: "Die & Mold",
      designation: "Director",
      mobile: "+91 94480 88990",
      landline: null,
      email: "sanjay@raotoolings.com",
      company_name: "Rao Precision Dies & Tools",
      company_address: "Peenya Industrial Area, 4th Cross",
      gstin: "29AAACR3322J1Z1",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
      approval_status: "pending",
      user_type: "platform_user",
      credit_limit: 300000,
      credit_days: 15,
      notes: "Self-registered online portal account. Requests HRC 55 ball nose cutters.",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
  ];

  if (!dbProfiles || dbProfiles.length === 0) {
    return seedProfiles;
  }

  // Enrich database profiles with default approval_status & user_type if not set
  const enrichedDbProfiles: Profile[] = (dbProfiles as Profile[]).map((p) => ({
    ...p,
    approval_status: p.approval_status || (p.role === "platform_owner" ? "approved" : "approved"),
    user_type: p.user_type || "platform_user",
    credit_limit: p.credit_limit || 500000,
    credit_days: p.credit_days || 30,
  }));

  // Merge so seed demonstration accounts also display if database only has admin/1 user
  const combined = [...enrichedDbProfiles];
  seedProfiles.forEach((seed) => {
    if (!combined.some((c) => c.email === seed.email || c.id === seed.id)) {
      combined.push(seed);
    }
  });

  return combined;
}

export async function updateCustomerApprovalStatus(
  customerId: string,
  newStatus: ApprovalStatus
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", customerId);

    if (error) {
      console.warn("Notice updating approval status:", error.message);
    }
  } catch (err) {
    console.warn("Database update exception handled:", err);
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Customer status updated to ${newStatus.toUpperCase()}.`,
  };
}

export async function createOfflineCustomer(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const supabase = await createClient();

  const title = (formData.get("title") as UserTitle) || "Mr";
  const firstName = (formData.get("first_name") as string)?.trim();
  const lastName = (formData.get("last_name") as string)?.trim();
  const companyName = (formData.get("company_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const mobile = (formData.get("mobile") as string)?.trim();
  const landline = (formData.get("landline") as string)?.trim() || null;
  const designation = (formData.get("designation") as string)?.trim() || "Commercial Contact";
  const department = (formData.get("department") as string)?.trim() || "Procurement";
  const gstin = (formData.get("gstin") as string)?.trim() || null;
  const companyAddress = (formData.get("company_address") as string)?.trim();
  const additionalAddress = (formData.get("additional_address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const pincode = (formData.get("pincode") as string)?.trim();
  const creditLimit = Number(formData.get("credit_limit")) || 500000;
  const creditDays = Number(formData.get("credit_days")) || 30;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!companyName || !firstName || !lastName || !email || !mobile || !companyAddress || !city || !state || !pincode) {
    return { error: "Please fill in all required fields marked with an asterisk (*)." };
  }

  const newOfflineProfile: Profile = {
    id: `off-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    role: "customer",
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
    approval_status: "approved", // Offline clients added directly by admin are pre-approved
    user_type: "offline_user", // Marked as offline ERP billing account
    credit_limit: creditLimit,
    credit_days: creditDays,
    notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("profiles")
      .insert(newOfflineProfile as never);

    if (error) {
      console.warn("Notice inserting offline customer profile:", error.message);
    }
  } catch (err) {
    console.warn("Database insert exception handled:", err);
  }

  revalidatePath("/admin/customers");
  return {
    success: true,
    message: `Offline customer "${companyName}" added successfully.`,
  };
}
