import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "Reporte Ciudadano",
  description:
    "Reportá baches, luminarias, basura y otros problemas de la ciudad, y consultá el estado con tu código.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sourceSans.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
