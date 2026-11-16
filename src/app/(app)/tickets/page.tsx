import type { Metadata } from "next";
import { TicketsClient } from "@/components/tickets/TicketsClient";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return <TicketsClient />;
}
