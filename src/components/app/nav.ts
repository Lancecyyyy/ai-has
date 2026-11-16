import { Activity, BookOpen, Bot, LayoutDashboard, ShieldCheck, Ticket, Workflow, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/server/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["manager"] },
  { href: "/chat", label: "Assistant", icon: Bot, roles: ["employee", "agent", "manager"] },
  { href: "/tickets", label: "Tickets", icon: Ticket, roles: ["employee", "agent", "manager"] },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen, roles: ["agent", "manager"] },
  { href: "/automations", label: "Automations", icon: Workflow, roles: ["agent", "manager"] },
  { href: "/security", label: "Security", icon: ShieldCheck, roles: ["agent", "manager"] },
  { href: "/status", label: "System status", icon: Activity, roles: ["employee", "agent", "manager"] },
];

export const ROLE_LABEL: Record<Role, string> = { employee: "Employee", agent: "IT agent", manager: "IT manager" };

export function navFor(role: Role) {
  const items = NAV.filter((n) => n.roles.includes(role));
  if (role === "agent") {
    // Agents live in the queue; put it first.
    const t = items.findIndex((i) => i.href === "/tickets");
    items.unshift(...items.splice(t, 1));
  }
  return items.map((i) => (i.href === "/tickets" && role === "employee" ? { ...i, label: "My tickets" } : i.href === "/tickets" ? { ...i, label: "Ticket queue" } : i));
}
