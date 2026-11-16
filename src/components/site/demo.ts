"use client";
export type DemoRole = "employee" | "agent" | "manager";
export const HOME: Record<DemoRole, string> = { employee: "/chat", agent: "/tickets", manager: "/dashboard" };

export async function demoLogin(role: DemoRole) {
  const res = await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Demo sign-in failed");
  window.location.href = HOME[role];
}
