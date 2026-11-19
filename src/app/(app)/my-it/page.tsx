import type { Metadata } from "next";
import { MyIT } from "@/components/myit/MyIT";

export const metadata: Metadata = { title: "My IT" };

export default function Page() {
  return <MyIT />;
}
