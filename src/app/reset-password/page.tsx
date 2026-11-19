import type { Metadata } from "next";
import { ResetClient } from "@/components/site/AccountPages";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetClient token={token ?? ""} />;
}
