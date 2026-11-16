import type { Metadata } from "next";
import { TicketDetail } from "@/components/tickets/TicketDetail";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: key };
}

export default async function TicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <TicketDetail ticketKey={key} />;
}
