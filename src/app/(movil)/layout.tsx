import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "../globals.css";

export const metadata: Metadata = {
  title: "VozIA - Móvil",
  description: "Agente de voz IA",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b141a] text-foreground">
        {children}
      </div>
    </ThemeProvider>
  );
}
