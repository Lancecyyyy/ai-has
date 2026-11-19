import type { Metadata } from "next";
import { ForgotClient } from "@/components/site/AccountPages";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return <ForgotClient />;
}
