import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { Automations } from "@/components/ops/Automations";

export const metadata: Metadata = { title: "Automations" };

export default async function Page() {
  const user = await getUser();
  if (user?.role === "employee") redirect("/chat");
  return <Automations manager={user?.role === "manager"} />;
}
