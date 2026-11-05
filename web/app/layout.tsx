import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "900"] });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Abeggi — borrow from friends without the awkwardness",
  description: "A friendly IOU app on Stellar. One shared record of what's owed, what's paid, and when it's due.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 pb-24">{children}</main>
      </body>
    </html>
  );
}
