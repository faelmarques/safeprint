import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "SafePrint — Impressão autoatendimento",
  description: "Escaneie, envie, pague e retire. Impressão autoatendimento no Unifacef e em toda Franca.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
