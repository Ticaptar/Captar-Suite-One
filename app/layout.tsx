import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Manrope, Sora, Space_Grotesk } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { SplashScreen } from "@/components/splash-screen";
import { ThemeModeSwitcher, type ThemeMode } from "@/components/theme-mode-switcher";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedMode = cookieStore.get("captar-suite:theme-mode")?.value;
  const initialMode: ThemeMode = storedMode === "dark" ? "dark" : "clean";

  return (
    <html lang="pt-BR">
      <body
        className={`${manrope.variable} ${sora.variable} ${spaceGrotesk.variable} antialiased ${initialMode === "dark" ? "theme-dark" : "theme-clean"}`}
      >
        <PwaRegister />
        <SplashScreen />
        <ThemeModeSwitcher initialMode={initialMode} />
        {children}
      </body>
    </html>
  );
}
