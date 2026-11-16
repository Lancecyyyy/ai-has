import { Suspense } from "react";
import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";

export const metadata: Metadata = { title: "Assistant" };

export default function ChatPage() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
