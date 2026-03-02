import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { SplashScreen } from "@/components/splash-screen";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Captar Suíte",
  description: "Sistema de gestão para fazenda de gado",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  applicationName: "Captar Suíte",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${playfair.variable} antialiased`}>
        <PwaRegister />
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
