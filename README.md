# Warranty Advisor

AI nástroj, ktorý pred kúpou predĺženej záruky ukáže najčastejšie poruchy produktu, reálne ceny opráv z overených servisov a odporúčanie, či sa záruka oplatí.

## Ako to funguje

Appka má dva režimy a prepína medzi nimi automaticky:

1. **Živé vyhľadávanie** — ak je v Netlify nastavený `ANTHROPIC_API_KEY`, serverless funkcia (`netlify/functions/search.mts`) použije Claude API s webovým vyhľadávaním, extrahuje reálne ceny a zdroje, oboduje ich podľa autority (Autorizovaný servis 95 b → Reddit 30 b) a vráti výsledok. Výsledky sa cachujú na CDN (24 h prehliadač / 7 dní edge).
2. **Ukážkové dáta** — bez kľúča (alebo pri zlyhaní/timeoute živého vyhľadávania) appka ticho prejde na demo dáta v `src/data/mockProducts.ts`. Výsledok je vždy označený badgeom "Živé dáta z webu" alebo "Ukážkové dáta".

Vo vyhľadávaní funguje aj zápis záruky: `Bosch WAN28160BY +3 70,90€` (dĺžka + cena sa prepíšu do výsledku).

## Lokálne spustenie

```bash
npm install
npm run dev
```

Beží na http://localhost:5173 (na ukážkových dátach — funkcie bežia len na Netlify alebo cez `netlify dev`).

## Nasadenie na Netlify

**Cez Git (odporúčané):**
1. Pushni repo na GitHub.
2. Netlify → Add new site → Import from Git → vyber repo.
3. Build nastavenia si Netlify prečíta z `netlify.toml` (build: `npm run build`, publish: `dist`). Nič nemeň.
4. Deploy. Hotovo — appka beží na ukážkových dátach.

**Zapnutie živého AI vyhľadávania (voliteľné):**
1. Site configuration → Environment variables → pridaj `ANTHROPIC_API_KEY` (z console.anthropic.com).
2. Redeploy.

**Cez drag & drop:** `npm run build` a pretiahni priečinok `dist` do Netlify — ale takto sa nenasadí serverless funkcia, čiže len demo režim.

## Známe limity živého režimu

- Netlify serverless funkcie majú na free pláne limit 10 s; vyhľadávanie s webom môže trvať dlhšie a vypršať — frontend v takom prípade automaticky spadne na demo dáta. Na Pro pláne sa dá limit zvýšiť na 26 s.
- Každé živé vyhľadávanie stojí API kredity (rádovo jednotky centov). CDN cache opakované dopyty na rovnaký produkt neúčtuje.
- Živé výsledky sú tak dobré, ako verejne dostupné zdroje — pri nových alebo no-name produktoch funkcia radšej vráti "nenájdené", než by si vymýšľala čísla.
