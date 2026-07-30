/**
 * MOOE Monitoring System — Database Seeder
 * -----------------------------------------
 * Creates the Super Admin user if it does not already exist.
 *
 * Usage:
 *   npm run seed
 *
 * Requirements:
 *   - .env must contain NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   - The migration (001_initial_schema.sql) must have been run first
 *   - RLS "service_role" bypass: the seeder uses the anon key, so the
 *     "Authenticated full access" policy must allow inserts, OR you can
 *     swap the key below for your service_role key for unrestricted access.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n" +
    "    Get the service_role key from: Supabase Dashboard → Settings → API"
  );
  process.exit(1);
}

// service_role bypasses RLS — safe for server-side scripts only, never use in the browser
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----------------------------------------------------------------
// Seed data
// ----------------------------------------------------------------
const SUPER_ADMIN = {
  name: "Super Admin",
  email: "superadmin@admin.com",
  plainPassword: "123456789",
  role: "super_admin" as const,
};

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------
async function seed() {
  console.log("🌱  Starting seeder...");

  // 1. Check if the super admin already exists
  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", SUPER_ADMIN.email)
    .maybeSingle();

  if (selectError) {
    console.error("❌  Error checking for existing user:", selectError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`✅  Super Admin already exists (id: ${existing.id}). Skipping insert.`);
    return;
  }

  // 2. Hash the password
  const SALT_ROUNDS = 12;
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.plainPassword, SALT_ROUNDS);
  console.log("🔒  Password hashed with bcrypt (salt rounds: " + SALT_ROUNDS + ")");

  // 3. Insert the super admin
  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      name: SUPER_ADMIN.name,
      email: SUPER_ADMIN.email,
      password: hashedPassword,
      role: SUPER_ADMIN.role,
    })
    .select("id, name, email, role, created_at")
    .single();

  if (insertError) {
    console.error("❌  Failed to insert Super Admin:", insertError.message);
    process.exit(1);
  }

  console.log("✅  Super Admin created successfully:");
  console.log("    id:        ", inserted.id);
  console.log("    name:      ", inserted.name);
  console.log("    email:     ", inserted.email);
  console.log("    role:      ", inserted.role);
  console.log("    created_at:", inserted.created_at);
  console.log("\n🎉  Seeding complete.");
}

seed().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
