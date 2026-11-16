import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getUser();
  if (user?.role !== "manager") redirect(user?.role === "agent" ? "/tickets" : "/chat");
  return <Dashboard />;
}
