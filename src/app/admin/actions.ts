// src/app/admin/actions.ts
// Logout: clears the admin_token cookie and redirects to the login screen
// (REQ-22, architecture.md §13.3). Same "one cookie, no server-side session"
// model as the login action in admin/login/page.tsx.

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: "admin_token", path: "/" });
  redirect("/admin/login");
}
