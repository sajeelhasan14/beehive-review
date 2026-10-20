import type { Metadata } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// EMRG Media's display face: titles and figures only.
const baskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Beehive Reviews",
  description: "Review funnels and client dashboards by EMRG Media",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${baskerville.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-sm">
        <div className="flex-1">{children}</div>
        <footer className="mx-auto flex w-full max-w-[560px] items-center gap-3.5 px-5 pb-8 pt-4 text-[10px] uppercase tracking-[.3em] text-dim before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          Beehive Reviews by EMRG Media
        </footer>
      </body>
    </html>
  );
}
