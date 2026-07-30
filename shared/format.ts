/**
 * Slovak presentation helpers.
 *
 * Every label the user reads comes from here, which is what keeps phrasings
 * like "nedostatok informácií" or "nízka spoľahlivosť" out of the interface —
 * uncertainty is always described as what the estimate is based on, never as
 * an absence of an answer.
 */

import type { Basis, Difficulty, Rating, RiskLevel } from "./analysis";
import type { VerdictKind, WarrantyWorth } from "./scoring";

export function eur(value: number): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  return `${value.toLocaleString("sk-SK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  })} €`;
}

export function eurRange([low, high]: [number, number]): string {
  if (low === high) return eur(low);
  return `${low.toLocaleString("sk-SK", { maximumFractionDigits: 2 })} – ${eur(high)}`;
}

/** Slovak year plural: 1 rok, 2–4 roky, 5+ rokov. */
export function years(count: number): string {
  if (count === 1) return "1 rok";
  if (count >= 2 && count <= 4) return `${count} roky`;
  return `${count} rokov`;
}

export const VERDICT: Record<VerdictKind, { icon: string; label: string; headline: string }> = {
  buy: {
    icon: "✅",
    label: "Odporúčame kúpu",
    headline: "Toto je rozumný nákup",
  },
  caution: {
    icon: "⚠️",
    label: "Odporúčame kúpu s výhradami",
    headline: "Kúpiť sa dá, ale s vedomím rizík",
  },
  avoid: {
    icon: "❌",
    label: "Neodporúčame kúpu",
    headline: "Tento výrobok radšej obíďte",
  },
};

export const RISK_LEVEL: Record<RiskLevel, string> = {
  high: "Častá porucha",
  medium: "Občasná porucha",
  low: "Zriedkavá porucha",
};

export const BASIS: Record<Basis, { label: string; explanation: string }> = {
  fact: {
    label: "Overený údaj",
    explanation: "Údaj pochádza priamo z uvedených zdrojov.",
  },
  estimate: {
    label: "Kvalifikovaný odhad",
    explanation: "Údaj je odvodený z porovnateľných modelov a bežných servisných cien.",
  },
  assumption: {
    label: "Odborná úvaha",
    explanation: "Údaj vychádza z konštrukcie výrobku a skúseností servisných technikov.",
  },
};

export const PARTS_AVAILABILITY: Record<Rating, string> = {
  good: "Bežne dostupné",
  fair: "Dostupné s čakaním",
  poor: "Ťažko zohnateľné",
};

export const REPAIR_DIFFICULTY: Record<Difficulty, string> = {
  low: "Jednoduchá oprava",
  medium: "Stredne náročná oprava",
  high: "Náročná oprava",
};

/** Describes what the estimate stands on — never labels confidence as "low". */
export function confidenceExplanation(confidence: number): string {
  if (confidence >= 75) {
    return "Odhad sa opiera o viacero nezávislých servisných zdrojov k tomuto výrobku.";
  }
  if (confidence >= 50) {
    return "Odhad kombinuje dostupné servisné údaje s poznatkami o modeloch rovnakej konštrukcie.";
  }
  return (
    "Verejných servisných údajov k tomuto modelu je málo, preto odhad stavia najmä na " +
    "porovnateľných výrobkoch, konštrukcii a skúsenostiach servisov. Aj tak ide o kvalifikovaný záver."
  );
}

export const WARRANTY_WORTH: Record<WarrantyWorth, { label: string; detail: string }> = {
  yes: {
    label: "Predĺžená záruka sa oplatí",
    detail: "Očakávané náklady na opravy prevyšujú cenu záruky.",
  },
  borderline: {
    label: "Predĺžená záruka je hraničná",
    detail: "Očakávané náklady na opravy sú približne na úrovni ceny záruky.",
  },
  no: {
    label: "Predĺžená záruka sa pravdepodobne neoplatí",
    detail: "Očakávané náklady na opravy sú nižšie než cena záruky.",
  },
};

export const SOURCE_AUTHORITY: Record<string, string> = {
  authorized_service: "Autorizovaný servis",
  service_manual: "Servisný manuál",
  repair_shop: "Servis s cenníkom",
  forum: "Odborné fórum",
  community: "Komunitná skúsenosť",
};

export function formatSourceDate(date: string | null): string {
  if (!date) return "bez uvedeného dátumu";
  const parsed = new Date(date.length === 7 ? `${date}-01` : date);
  if (Number.isNaN(parsed.getTime())) return "bez uvedeného dátumu";
  return parsed.toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
}
