# Warranty Advisor

Odpovedá zákazníkovi na jednu otázku: **oplatí sa tento výrobok kúpiť?**

Zadá sa model spotrebiča alebo elektroniky a aplikácia vráti odborné hodnotenie —
riziko vlastníctva, najčastejšie poruchy, odhad ceny opráv a jednoznačné
odporúčanie. Ak si používateľ zároveň vyberá predĺženú záruku, pripíše k modelu
jej dĺžku a cenu (`Bosch WAN28160BY +3 70,90€`) a dostane aj posudok, či sa
oplatí.

## Ako to funguje

```
prehliadač ──POST /api/v1/analyses──▶ analyze ──▶ analyze-background ──▶ model + web search
      │                                  │                │
      └──GET /api/v1/analyses/:id────────┘         Netlify Blobs (job + cache)
```

Výskum trvá dlhšie, než smie bežať synchronická funkcia, preto sa spúšťa na
pozadí a prehliadač si výsledok vyzdvihne. Hotová analýza sa drží v Blobs sedem
dní a rovnaký dopyt sa už neplatí znova.

**Model vracia iba podklady — verdikt sa počíta.** Riziko vlastníctva,
spoľahlivosť odhadu aj samotné odporúčanie vznikajú deterministicky v
`shared/scoring.ts` z toho, čo výskum našiel. Vďaka tomu sa hodnotenie nedá
vymyslieť a vždy sa dá vysvetliť.

## Štruktúra

| Priečinok            | Obsah                                                        |
| -------------------- | ------------------------------------------------------------ |
| `shared/`            | Typy, výpočet hodnotenia, normalizácia odpovede, formátovanie |
| `netlify/functions/` | API a výskumný pracovník na pozadí                            |
| `netlify/lib/`       | Prompt, schéma odpovede, úložisko a limity                    |
| `src/`               | Rozhranie (Vite + React + Tailwind)                           |

## Spustenie

```bash
npm install
npm run dev     # rozhranie na ukážkových dátach
npm test        # 62 testov obchodnej logiky
npm run build   # kontrola typov + produkčný build
```

Bez premennej `ANTHROPIC_API_KEY` beží aplikácia v ukážkovom režime: rozhranie
funguje celé, ale analýzy sú vopred pripravené a sú tak aj označené.

## Nasadenie

1. Prepoj repozitár s Netlify — `netlify.toml` už obsahuje build aj funkcie.
2. Nastav `ANTHROPIC_API_KEY` v premenných prostredia.
3. Over, že projekt má povolené **background functions** a **Netlify Blobs**.
   Bez nich sa výskum nespustí a rozhranie zostane v ukážkovom režime.
