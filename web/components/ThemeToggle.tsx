"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("sp-dark", d ? "1" : "0"); } catch {}
  }
  return (
    <button
      onClick={toggle}
      className="size-9 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 flex items-center justify-center"
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}
