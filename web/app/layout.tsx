import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "SafePrint — Imprima sem fila pelo celular",
  description: "Escaneie o QR, envie o PDF, pague no Pix e retire na máquina. Impressão P&B a laser no campus, a partir de R$ 1,25/folha.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={jakarta.className}>{children}</body>
    </html>
  );
}
