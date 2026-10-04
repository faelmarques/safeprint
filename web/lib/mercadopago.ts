const MP_API = "https://api.mercadopago.com";

function token(): string {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
}

export function mpEnabled(): boolean {
  return token().length > 10;
}

export interface MpPixResult {
  id: number;
  status: string;
  qrCode?: string;
  qrBase64?: string;
  ticketUrl?: string;
}

export async function createPixPayment(opts: {
  amountReais: number;
  description: string;
  externalReference: string;
  payerEmail?: string;
  notificationUrl?: string;
}): Promise<MpPixResult> {
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      "X-Idempotency-Key": `${opts.externalReference}-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: Math.max(0.01, Number(opts.amountReais.toFixed(2))),
      description: opts.description.slice(0, 120),
      payment_method_id: "pix",
      external_reference: opts.externalReference,
      notification_url: opts.notificationUrl,
      payer: { email: opts.payerEmail ?? "cliente@safeprint.local" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Erro ao gerar Pix no Mercado Pago");
  const tx = data?.point_of_interaction?.transaction_data ?? {};
  return {
    id: Number(data.id),
    status: String(data.status ?? "pending"),
    qrCode: tx.qr_code,
    qrBase64: tx.qr_code_base64,
    ticketUrl: tx.ticket_url,
  };
}

export async function getMpPayment(id: string | number): Promise<any> {
  const res = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Pagamento MP não encontrado");
  return data;
}

export async function refundMpPayment(id: string | number): Promise<any> {
  const res = await fetch(`${MP_API}/v1/payments/${id}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Erro ao estornar no Mercado Pago");
  return data;
}
