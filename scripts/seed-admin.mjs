import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manually parse .env.local if not already in process.env
const envPath = resolve(__dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...vals] = trimmed.split("=");
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  });
} catch (e) {
  console.warn("Could not read .env.local file", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedAdmin() {
  const adminEmail = "admin@sojarindusy.com";
  const adminPassword = "Qtpl@12345";

  console.log(`Seeding platform admin: ${adminEmail}...`);

  // 1. Check if user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  let adminUser = usersData.users.find((u) => u.email === adminEmail);

  if (!adminUser) {
    // Create new admin user in Auth
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        title: "Mr",
        first_name: "Super",
        last_name: "Admin",
        department: "Executive Management",
        designation: "Platform Administrator",
        mobile: "9876543210",
        company_name: "Sojar Indusy Tech",
        company_address: "Corporate Headquarters, Phase 1 MIDC",
        additional_address: "Corporate Tower, Suite 500",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        gstin: "27AAAAA9999A1Z9",
      },
    });

    if (createError) {
      console.error("Error creating admin user:", createError.message);
      process.exit(1);
    }
    adminUser = created.user;
    console.log(`Created auth user with ID: ${adminUser.id}`);
  } else {
    // Update existing admin password & metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        title: "Mr",
        first_name: "Super",
        last_name: "Admin",
        department: "Executive Management",
        designation: "Platform Administrator",
        mobile: "9876543210",
        company_name: "Sojar Indusy Tech",
        company_address: "Corporate Headquarters, Phase 1 MIDC",
        additional_address: "Corporate Tower, Suite 500",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        gstin: "27AAAAA9999A1Z9",
      },
    });

    if (updateError) {
      console.error("Error updating admin user:", updateError.message);
      process.exit(1);
    }
    console.log(`Updated existing auth user with ID: ${adminUser.id}`);
  }

  // 2. Ensure Profile in public.profiles table
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: adminUser.id,
    role: "admin",
    title: "Mr",
    first_name: "Super",
    last_name: "Admin",
    department: "Executive Management",
    designation: "Platform Administrator",
    mobile: "9876543210",
    landline: "020-12345678",
    email: adminEmail,
    company_name: "Sojar Indusy Tech",
    company_address: "Corporate Headquarters, Phase 1 MIDC",
    additional_address: "Corporate Tower, Suite 500",
    gstin: "27AAAAA9999A1Z9",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
  });

  if (profileError) {
    console.warn("Notice updating profile table (table might use trigger):", profileError.message);
  } else {
    console.log("Upserted platform_owner profile record successfully.");
  }

  console.log("\n=============================================");
  console.log("🎉 Platform Admin setup completed successfully!");
  console.log(`Email:    ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`Role:     platform_owner`);
  console.log("=============================================\n");
}

seedAdmin().catch(console.error);
