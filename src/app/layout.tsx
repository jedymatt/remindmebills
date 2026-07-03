import "~/styles/globals.css";

import { type Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Remind Me Bills",
  description:
    "Informs the user the bills they have to pay for their current and future invoices.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// Display serif for the landing hero and section headings — characterful,
// used with restraint. Mono carries the ledger's dates and amounts.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
