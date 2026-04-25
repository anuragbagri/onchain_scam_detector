import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Scam Detector — Wallet Risk Engine",
  description: "Analyze any Solana wallet or token for rug pull risk, fake volume, and suspicious behavior. Get an instant on-chain risk score with explainable insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
