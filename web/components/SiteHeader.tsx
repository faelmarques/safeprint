import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ nav = false, name = "SafePrint", width = "max-w-5xl", cta = true }: { nav?: boolean; name?: string; width?: string; cta?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-ink-100 bg-canvas/90 backdrop-blur">
      <div className={`mx-auto ${width} px-5 h-14 flex items-center justify-between gap-4`}>
        <Logo name={name} />
        {nav && (
          <nav aria-label="Seções" className="hidden md:flex items-center gap-7 text-sm text-ink-600">
            <a href="#como" className="hover:text-ink-900">Como funciona</a>
            <a href="#precos" className="hover:text-ink-900">Preços</a>
            <a href="#maquinas" className="hover:text-ink-900">Máquinas</a>
            <a href="#duvidas" className="hover:text-ink-900">Dúvidas</a>
          </nav>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {cta && <a href="/imprimir" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">Imprimir</a>}
        </div>
      </div>
    </header>
  );
}
