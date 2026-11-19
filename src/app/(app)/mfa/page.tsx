import type { Metadata } from "next";
import { MfaSetup } from "@/components/myit/MyIT";

export const metadata: Metadata = { title: "Authenticator" };

export default function Page() {
  return <MfaSetup />;
}
