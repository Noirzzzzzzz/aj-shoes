import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;

  function toggle() {
    const next = lang === "th" ? "en" : "th";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  }

  return (
    <button
      onClick={toggle}
      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
      aria-label={t("language") || "language"}
    >
      {lang.toUpperCase()}
    </button>
  );
}
