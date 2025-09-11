import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./translations/en.json";
import th from "./translations/th.json";

const stored = localStorage.getItem("lang") || "th";
i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, th: { translation: th } },
    lng: stored,
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

export default i18n;
