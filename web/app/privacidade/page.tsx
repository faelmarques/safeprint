export const metadata = { title: "Privacidade — SafePrint" };

export default function Privacidade() {
  return (
    <main className="min-h-screen font-sans">
      <div className="mx-auto max-w-3xl px-5 py-12 space-y-6 text-ink-700">
        <a href="/" className="text-sm font-bold text-brand-600">← Voltar</a>
        <h1 className="font-display font-extrabold tracking-tight text-3xl text-ink-900">Política de Privacidade (LGPD)</h1>
        <p className="text-sm text-ink-400 font-medium">Última atualização: outubro de 2026</p>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">1. Quais dados coletamos</h2>
          <p className="text-sm leading-relaxed">Para processar sua impressão, coletamos apenas o necessário: o arquivo enviado (PDF/imagem), nome, WhatsApp e descrição apenas quando você solicita reembolso, e dados técnicos do pedido (folhas, valor, horário). Não pedimos cadastro nem CPF.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">2. Como usamos</h2>
          <p className="text-sm leading-relaxed">Os dados são usados exclusivamente para: executar a impressão, registrar a transação para controle interno e responder seu pedido de reembolso. Não compartilhamos nem vendemos dados a terceiros.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">3. Retenção e exclusão</h2>
          <p className="text-sm leading-relaxed">Seus arquivos são apagados automaticamente após a impressão (máx. 24h de retenção técnica). Metadados e EXIF de fotos são removidos antes do envio. Registros financeiros anônimos podem ser mantidos por até 5 anos por obrigação legal.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">4. Segurança</h2>
          <p className="text-sm leading-relaxed">Uploads passam por validação de tipo, extensão e conteúdo (incluindo varredura de PDFs com conteúdo ativo). Aplicamos limites de requisição, comunicação criptografada (HTTPS) e criptografia de armazenamento em ambientes de produção.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">5. Seus direitos (art. 18 da LGPD)</h2>
          <p className="text-sm leading-relaxed">Você pode solicitar a qualquer momento: confirmação do tratamento, acesso, correção, anonimização ou eliminação dos seus dados. Entre em contato pelo WhatsApp informado do operador da máquina.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-extrabold text-lg text-ink-900">6. Contato</h2>
          <p className="text-sm leading-relaxed">Encarregado de dados: operação SafePrint • Franca/SP.</p>
        </section>
      </div>
    </main>
  );
}
