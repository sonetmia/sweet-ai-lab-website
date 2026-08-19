import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function AppThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(() => localStorage.getItem("rags-theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("rags-theme", dark ? "dark" : "light");
  }, [dark]);

  return <button className={`app-theme-toggle ${className}`} onClick={() => setDark((current) => !current)} aria-label="Toggle color theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>;
}
