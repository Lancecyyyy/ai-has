import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/server/auth";
import { LoginClient } from "@/components/site/LoginClient";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.role === "manager" ? "/dashboard" : user.role === "agent" ? "/tickets" : "/chat");
  return <LoginClient demo={process.env.DEMO_LOGIN !== "off"} />;
}
