import type { Product, WarrantyTier } from "../data/mockProducts";

type Verdict = "worth_it" | "depends" | "not_worth_it";

function computeVerdict(product: Product, tier: WarrantyTier) {
  const usable = product.failures.filter((f) => f.confidence >= 40);
  const basis = usable.length > 0 ? usable : product.failures;
  const expectedValue = basis.reduce(
    (sum, f) => sum + (f.probability / 100) * ((f.totalRange[0] + f.totalRange[1]) / 2),
    0,
  );
  const lowConfidence = usable.length === 0;

  let verdict: Verdict;
  if (expectedValue > tier.price * 1.3) verdict = "worth_it";
  else if (expectedValue < tier.price * 0.7) verdict = "not_worth_it";
  else verdict = "depends";

  const worst = [...product.failures].sort((a, b) => b.totalRange[1] - a.totalRange[1])[0];

  return { verdict, expectedValue: Math.round(expectedValue), lowConfidence, worst };
}

const STYLES: Record<Verdict, { box: string; icon: string; title: string }> = {
  worth_it: {
    box: "bg-brand-soft",
    icon: "✓",
    title: "Oplatí sa kúpiť predĺženú záruku",
  },
  depends: {
    box: "bg-amber-50",
    icon: "≈",
    title: "Rozhodnutie závisí od vašej tolerancie rizika",
  },
  not_worth_it: {
    box: "bg-slate-50",
    icon: "ⓘ",
    title: "Predĺžená záruka sa pri tomto modeli pravdepodobne neoplatí",
  },
};

export function Recommendation({ product, tier }: { product: Product; tier: WarrantyTier }) {
  const { verdict, expectedValue, lowConfidence, worst } = computeVerdict(product, tier);
  const s = STYLES[verdict];

  const body: Record<Verdict, string> = {
    worth_it: `Očakávaná hodnota opráv (~${expectedValue} €) prevyšuje cenu záruky (${tier.price.toLocaleString(
      "sk-SK",
    )} €). Pri tomto modeli je riziko nákladnej opravy nadpriemerné.`,
    depends: `Očakávaná hodnota opráv (~${expectedValue} €) je približne na úrovni ceny záruky (${tier.price.toLocaleString(
      "sk-SK",
    )} €). Záruka sa oplatí najmä ak chcete mať istotu a nechcete riešiť prípadnú opravu sami.`,
    not_worth_it: `Očakávaná hodnota opráv (~${expectedValue} €) je nižšia než cena záruky (${tier.price.toLocaleString(
      "sk-SK",
    )} €). Tento model má nízku historickú poruchovosť.`,
  };

  return (
    <div className={`animate-fade-up rounded-2xl p-6 ${s.box}`}>
      <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">Odporúčanie</p>
      <div className="mt-2 flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 text-lg">
          {s.icon}
        </span>
        <div>
          <h3 className="font-semibold">{s.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{body[verdict]}</p>
          {worst && (
            <p className="mt-2 text-sm text-slate-600">
              V najhoršom prípade ({worst.component.toLowerCase()}) môže oprava stáť až{" "}
              <span className="font-medium">{worst.totalRange[1]} €</span>.
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 border-t border-slate-900/5 pt-3 text-xs text-slate-400">
        Odporúčanie je orientačný výpočet na základe pravdepodobnosti porúch a odhadovaných cien
        opráv{lowConfidence ? " s nízkou spoľahlivosťou zdrojov" : ""}. Nejde o finančné ani právne
        poradenstvo.
      </p>
    </div>
  );
}
