import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type Translations } from "../i18n/strings";

interface LangContextValue {
  lang: Lang;
  toggle: () => void;
  t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const toggle = useCallback(() => setLang((l) => (l === "en" ? "hi" : "en")), []);
  const t = useMemo<Translations>(() => STRINGS[lang] as Translations, [lang]);
  const value = useMemo<LangContextValue>(() => ({ lang, toggle, t }), [lang, toggle, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}

