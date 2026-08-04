/**
 * What the site stores, in the plainest terms available.
 *
 * Every claim here was checked against the running application rather than
 * against intent: no cookies are set, no request leaves the origin, and the
 * two browser keys are named. A privacy note that describes what someone meant
 * to build is worse than none, because it is believed.
 */
const POINTS: { title: string; body: string }[] = [
  {
    title: "Bez účtu a bez sledovania",
    body: "Nepotrebujete sa registrovať. Nepoužívame cookies, analytické nástroje ani skripty tretích strán — stránka nenačítava nič z cudzích serverov a bezpečnostná politika prehliadača to aj vynucuje.",
  },
  {
    title: "Naposledy analyzované ostávajú u vás",
    body: "Zoznam vašich posledných dopytov je uložený iba vo vašom prehliadači (localStorage), nikam sa neodosiela a tlačidlom „Vymazať“ ho kedykoľvek zmažete. Rovnako je uložené aj nastavenie svetlého či tmavého režimu.",
  },
  {
    title: "Čo sa posiela na server",
    body: "Text dopytu, teda označenie výrobku a prípadná cena či podmienky záruky. Hotová analýza sa uchováva sedem dní, aby rovnaký dopyt nemusel platiť za nový výskum. Nespájame ju so žiadnou osobou.",
  },
  {
    title: "IP adresa",
    body: "Na obmedzenie počtu dopytov z jedného zdroja používame iba skrátený odtlačok (hash) IP adresy a okno jednej minúty. Samotnú IP adresu neukladáme.",
  },
  {
    title: "Kto analýzu robí",
    body: "Samotný výskum prebieha cez rozhranie Anthropic s vyhľadávaním na webe. Posiela sa doň označenie výrobku, nie údaje o vás.",
  },
];

export function PrivacyNote() {
  return (
    <details className="group mx-auto w-full max-w-3xl px-4 pb-10 print:hidden">
      <summary className="cursor-pointer list-none text-center text-xs text-subtle underline decoration-line underline-offset-4 hover:text-accent">
        Ochrana súkromia
      </summary>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Čo o vás vieme
        </h2>
        <dl className="mt-4 space-y-4">
          {POINTS.map((point) => (
            <div key={point.title}>
              <dt className="text-[0.9375rem] font-medium">{point.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{point.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
