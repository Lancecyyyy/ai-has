import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth";
import { Knowledge } from "@/components/knowledge/Knowledge";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KnowledgePage() {
  const user = await getUser();
  if (user?.role === "employee") redirect("/chat");
  return (
    <Suspense>
      <Knowledge />
    </Suspense>
  );
}
