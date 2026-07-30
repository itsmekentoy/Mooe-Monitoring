import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const SESSION_KEY = "mooe_auth_user";

/**
 * Attempt to log in with email + password.
 * Fetches the user row, verifies the bcrypt hash, and saves the
 * session to sessionStorage (persists across refreshes, clears on tab close).
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  // 1. Fetch user by email
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, password, role")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error("Login failed. Please try again.");
  if (!user) throw new Error("Invalid email or password.");

  // 2. Compare password against stored bcrypt hash
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid email or password.");

  // 3. Build a safe session object (no password hash)
  const session: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  // 4. Persist to sessionStorage
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

/** Read the stored session (survives page refresh). Returns null if not logged in. */
export function getSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Clear the session (logout). */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
