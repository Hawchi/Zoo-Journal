"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translateUiText } from "./ui-translations";

export type Language = "nl" | "en";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (dutch: string, english: string) => string;
  ui: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("nl");

  useEffect(() => {
    const saved = window.localStorage.getItem("zoo-journal-language");
    if (saved === "en" || saved === "nl") setLanguageState(saved);
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("zoo-journal-language", next);
    document.documentElement.lang = next;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (dutch: string, english: string) => language === "en" ? english : dutch,
    ui: (value: string) => language === "en" ? translateUiText(value) : value,
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}<AutoTranslate language={language} /></LanguageContext.Provider>;
}

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function withWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function AutoTranslate({ language }: { language: Language }) {
  useEffect(() => {
    const expectedTitle = "Zoo Journal";
    document.title = expectedTitle;

    const translateTextNode = (node: Text) => {
      const current = node.nodeValue || "";
      if (!current.trim()) return;
      const stored = originalText.get(node);
      if (language === "nl") {
        if (stored !== undefined && current !== stored) node.nodeValue = stored;
        return;
      }
      let source = stored ?? current;
      const previousTranslation = withWhitespace(source, translateUiText(source.trim()));
      if (stored !== undefined && current !== stored && current !== previousTranslation) {
        source = current;
        originalText.set(node, current);
      } else if (stored === undefined) originalText.set(node, current);
      const translated = withWhitespace(source, translateUiText(source.trim()));
      if (translated !== current) node.nodeValue = translated;
    };

    const translateElement = (element: Element) => {
      if (element.closest("script, style, [data-no-translate='true']")) return;
      const attributes = ["placeholder", "title", "aria-label"];
      let saved = originalAttributes.get(element);
      for (const attribute of attributes) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        if (!saved) { saved = new Map(); originalAttributes.set(element, saved); }
        const stored = saved.get(attribute);
        if (language === "nl") {
          if (stored !== undefined && current !== stored) element.setAttribute(attribute, stored);
          continue;
        }
        let source = stored ?? current;
        const previousTranslation = translateUiText(source);
        if (stored !== undefined && current !== stored && current !== previousTranslation) {
          source = current;
          saved.set(attribute, current);
        } else if (stored === undefined) saved.set(attribute, current);
        const translated = translateUiText(source);
        if (translated !== current) element.setAttribute(attribute, translated);
      }
    };

    const translateTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;
      if (root instanceof Element) translateElement(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let child = walker.nextNode();
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) translateTextNode(child as Text);
        else translateElement(child as Element);
        child = walker.nextNode();
      }
    };

    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTree(mutation.target);
        else {
          mutation.addedNodes.forEach(translateTree);
          if (mutation.type === "attributes") translateElement(mutation.target as Element);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
    const titleObserver = new MutationObserver(() => {
      if (document.title !== expectedTitle) document.title = expectedTitle;
    });
    titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); titleObserver.disconnect(); };
  }, [language]);
  return null;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`language-toggle ${compact ? "compact" : ""}`} role="group" aria-label="Taal kiezen / Choose language">
      <button type="button" className={language === "nl" ? "active" : ""} onClick={() => setLanguage("nl")} aria-pressed={language === "nl"}>NL</button>
      <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
    </div>
  );
}
