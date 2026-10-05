// Filtro de conteúdo/segurança de uploads (blindado para faculdade).
// Checa extensão, MIME, magic bytes e padrões perigosos em PDF.

const MAX_BYTES = 150 * 1024 * 1024; // 150 MB (foto de celular passa direto, comprime no navegador)

export function checkUpload(fileName: string, mime: string, sizeBytes: number): string | null {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const nameOk = /^[\w\-. ()\[\]çãáéíóúâêîôû_]+$/i.test(fileName);
  if (!nameOk) return "Nome de arquivo com caracteres inválidos";
  if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) return `Formato .${ext} não permitido (use PDF, PNG, JPG ou WEBP)`;
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mime)) return "Tipo de arquivo não permitido";
  if (sizeBytes > MAX_BYTES) return "Arquivo muito grande (máx. 150 MB)";
  if (sizeBytes <= 0) return "Arquivo vazio";
  return null;
}

function b64FromDataUrl(dataUrl: string): Uint8Array | null {
  const i = dataUrl.indexOf(",");
  if (i < 0) return null;
  try {
    return Uint8Array.from(Buffer.from(dataUrl.slice(i + 1), "base64"));
  } catch {
    return null;
  }
}

export function checkDataUrl(dataUrl: string, kind: "pdf" | "image"): string | null {
  const bytes = b64FromDataUrl(dataUrl);
  if (!bytes || bytes.length < 8) return "Arquivo corrompido ou inválido";
  const head = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (kind === "pdf") {
    if (!head.startsWith("25504446")) return "Arquivo não é um PDF válido"; // %PDF
    const text = Buffer.from(bytes).toString("latin1");
    const bad = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia", "/SubmitForm", "/XFA"];
    const hit = bad.find((p) => text.includes(p));
    if (hit) return `PDF bloqueado por conteúdo ativo (${hit}). Exporte novamente usando "Imprimir em PDF".`;
    return null;
  }

  // imagens: magic bytes
  const okMagic =
    head.startsWith("ffd8ff") || // jpg
    head.startsWith("89504e47") || // png
    head.startsWith("52494646"); // webp (RIFF....WEBP)
  if (!okMagic) return "Imagem inválida (formato real não confere)";
  return null;
}
