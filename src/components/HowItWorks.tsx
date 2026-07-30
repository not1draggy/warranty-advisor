/**
 * What a first-time visitor needs before trusting a verdict.
 *
 * Deliberately describes the method rather than making claims about quality:
 * each line is something the report visibly does, so it can be checked rather
 * than believed. It also quietly explains why the analysis takes minutes.
 */
const STEPS = [
  {
    title: "Hľadáme tam, kde sú dáta",
    body: "Servisné cenníky, manuály, fóra technikov a dlhodobé skúsenosti majiteľov — nielen popis z e-shopu.",
  },
  {
    title: "Hodnotenie počítame, nevymýšľame",
    body: "Riziko aj odporúčanie vychádzajú z nájdených porúch a cien opráv. Pri každom hodnotení uvidíte, prečo vyšlo tak, ako vyšlo.",
  },
  {
    title: "Vidíte, čomu veriť",
    body: "Pri každom údaji je označené, či ide o overený fakt zo zdroja, alebo o kvalifikovaný odhad.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-16 pb-4">
      <h2 className="sr-only">Ako to funguje</h2>

      <ol className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span
              aria-hidden="true"
              className="text-xs font-semibold tracking-widest text-accent tabular-nums"
            >
              0{index + 1}
            </span>
            <h3 className="mt-2 text-sm font-medium">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-10 border-t border-line pt-5 text-center text-xs leading-relaxed text-subtle">
        Nepredávame spotrebiče ani záruky. Keď sa predĺžená záruka neoplatí, povieme to.
      </p>
    </section>
  );
}
