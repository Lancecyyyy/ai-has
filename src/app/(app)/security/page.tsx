import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { Security } from "@/components/ops/Security";

export const metadata: Metadata = { title: "Security" };

export default async function Page() {
  const user = await getUser();
  if (user?.role === "employee") redirect("/chat");
  return <Security />;
}
