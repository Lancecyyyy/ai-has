import type { Metadata, Viewport } from "next";
import { Do_Hyeon, Geist, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const dohyeon = Do_Hyeon({ weight: "400", subsets: ["latin"], variable: "--font-dohyeon", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const plex = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AI-HAS · Meridian IT Helpdesk", template: "%s · AI-HAS" },
  description: "AI-powered enterprise helpdesk: answers from company manuals, automates routine fixes, and escalates the rest to IT with full context.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0930" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('has-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dohyeon.variable} ${geist.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
