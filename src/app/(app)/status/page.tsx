import type { Metadata } from "next";
import { Status } from "@/components/ops/Status";

export const metadata: Metadata = { title: "System status" };

export default function Page() {
  return <Status />;
}
