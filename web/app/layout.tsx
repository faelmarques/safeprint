import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://safeprint.enviofacil.pro";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "SafePrint — Impressão autoatendimento", template: "%s — SafePrint" },
  description: "Escaneie o QR da máquina, envie o arquivo, pague no Pix e retire a impressão. P&B a laser, A4, em Franca/SP.",
  openGraph: {
    title: "SafePrint — Impressão autoatendimento",
    description: "Do celular ao papel sem fila: QR, Pix e retirada na máquina.",
    type: "website",
    locale: "pt_BR",
    siteName: "SafePrint",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

// Aplica o tema antes da hidratação para não piscar claro->escuro.
const themeScript = `try{var s=localStorage.getItem("sp-dark");var d=s==null?window.matchMedia("(prefers-color-scheme: dark)").matches:s==="1";document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
