export interface PriceTier {
  minSheets: number;
  pricePerSheetCents: number;
}

export interface Printer {
  id: string;
  slug: string; // hash do QR code, ex: unifacef-bloco-a-x7k2
  name: string;
  location: string;
  address: string;
  status: "online" | "offline" | "maintenance";
  paperCurrent: number;
  paperCapacity: number;
  paperAlertAt: number;
  tiers: PriceTier[];
  colorAvailable: boolean;
}

// Seed inicial. Em produção vira tabela Postgres.
// Para escalar nacional: cada nova impressora = nova linha + QR com ?p=slug
export const PRINTERS: Printer[] = [
  {
    id: "printer-unifacef-01",
    slug: "unifacef-bloco-a-x7k2",
    name: "UniFACEF — Bloco A",
    location: "Bloco A, térreo, ao lado da cantina",
    address: "Av. Dr. Ismael Alonso y Alonso, 2400 - Franca/SP",
    status: "online",
    paperCurrent: 200,
    paperCapacity: 250,
    paperAlertAt: 50,
    tiers: [
      { minSheets: 10, pricePerSheetCents: 115 },
      { minSheets: 5, pricePerSheetCents: 125 },
      { minSheets: 1, pricePerSheetCents: 135 },
    ],
    colorAvailable: false,
  },
  {
    id: "printer-demo-centro",
    slug: "franca-centro-demo-9q1w",
    name: "Franca Centro — Demo",
    location: "Papelaria parceira (demonstração)",
    address: "Rua do Comércio, 100 - Centro, Franca/SP",
    status: "online",
    paperCurrent: 180,
    paperCapacity: 250,
    paperAlertAt: 50,
    tiers: [
      { minSheets: 10, pricePerSheetCents: 115 },
      { minSheets: 5, pricePerSheetCents: 125 },
      { minSheets: 1, pricePerSheetCents: 135 },
    ],
    colorAvailable: false,
  },
];

export function getPrinterBySlug(slug: string | null): Printer | undefined {
  if (!slug) return undefined;
  return PRINTERS.find((p) => p.slug === slug || p.id === slug);
}
