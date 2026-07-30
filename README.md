# Warranty Advisor

Odpovedá zákazníkovi na jednu otázku: **oplatí sa tento výrobok kúpiť?**

Zadá sa model spotrebiča alebo elektroniky a aplikácia vráti odborné hodnotenie —
riziko vlastníctva, najčastejšie poruchy, odhad ceny opráv a jednoznačné
odporúčanie. K modelu sa dá pripísať cena konkrétnej ponuky aj podmienky
predĺženej záruky (`Bosch WAN28160BY 349€ +3 70,90€`) — aplikácia potom prepočíta
celkové náklady na vlastníctvo a posúdi, či sa pripoistenie oplatí.

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

### Kedy sa porucha objaví

Spotrebiče nezlyhávajú rovnomerne. Ložiská bubna idú okolo siedmeho až
desiateho roku, vypúšťacie čerpadlo medzi tretím a šiestym, elektronika buď
hneď, alebo nikdy. Každá porucha preto nesie okno `onsetYears`.

Z toho vychádza posudok predĺženej záruky: zákonná záruka kryje prvé dva roky,
takže pripoistenie na tri roky reálne pridáva krytie na 3. až 5. rok — a ráta sa
mu len tá časť porúch, ktorá do tohto okna spadá. Bez toho by záruka dostala
kredit aj za poruchy, ktoré prídu dávno po jej skončení.

### Cena, z ktorej hodnotenie vychádza

Riziko vlastníctva je pomer očakávaných opráv k cene výrobku, takže cena je
predpoklad, na ktorom stojí celý verdikt — a preto sa vždy zobrazuje.

Keď kupujúci zadá cenu konkrétnej ponuky, **riziko sa nemení**: tá istá práčka
kúpená lacnejšie nie je poruchovejšia práčka. Zmení sa počet, ktorý kupujúceho
naozaj zaujíma — cena plus opravy, ktoré si za ňu kupuje — a k tomu porovnanie
ponuky s obvyklou trhovou cenou.

### Ako sa hľadá, keď o modeli nič nie je

Rebrík v prompte ide od presného modelu cez produktovú radu a spoločnú platformu
až po **konkrétne opotrebiteľné diely**. Spotrebiče zdieľajú kompresory, čerpadlá
a motory naprieč značkami, takže kompresor Secop alebo čerpadlo Askoll si nesie
svoju históriu bez ohľadu na logo na dvierkach. Prompt zároveň vie, na čo sa pýtať
v jednotlivých kategóriách — či je vaňa zvarená, či je chladiaci okruh hermetický,
či ide o podsvietenie alebo o samotný panel.

## Štruktúra

| Priečinok            | Obsah                                                          |
| -------------------- | -------------------------------------------------------------- |
| `shared/`            | Typy, výpočet hodnotenia, normalizácia odpovede, formátovanie  |
| `netlify/functions/` | API a výskumný pracovník na pozadí — **iba skutočné funkcie**  |
| `netlify/lib/`       | Prompt, schéma odpovede, úložisko a limity                     |
| `netlify/tests/`     | Testy funkcií, mimo nasadzovaného priečinka                    |
| `src/`               | Rozhranie (Vite + React + Tailwind)                            |

> Netlify nasadzuje **každý** súbor v `netlify/functions/` ako funkciu. Testy
> preto patria do `netlify/tests/` — inak sa zabalia do nasadenia a to zlyhá.
> Stráži to samostatný test.

## Spustenie

```bash
npm install
npm run dev     # rozhranie na ukážkových dátach
npm test        # 237 testov: hodnotenie, normalizácia, úložisko, API, jazyk
npm run build   # kontrola typov + produkčný build
```

Bez premennej `ANTHROPIC_API_KEY` beží aplikácia v ukážkovom režime: rozhranie
funguje celé, ale analýzy sú vopred pripravené a sú tak aj označené.

## Nasadenie

1. Prepoj repozitár s Netlify — `netlify.toml` už obsahuje build aj funkcie.
2. Nastav `ANTHROPIC_API_KEY` v premenných prostredia.
3. Over, že projekt má povolené **background functions** a **Netlify Blobs**.
   Bez nich sa výskum nespustí a rozhranie zostane v ukážkovom režime.
4. Voliteľne nastav `DAILY_RESEARCH_LIMIT` — koľko nových analýz denne je web
   ochotný zaplatiť (predvolene 200).

### Strop denných nákladov

Limit na IP adresu obmedzí jedného návštevníka, nie tisíc naraz — a každá nová
analýza je platené volanie modelu s vyhľadávaním. Verejný endpoint bez stropu je
otvorený účet.

Počítajú sa len analýzy, za ktoré sa naozaj platí: odpoveď z cache strop
neminie, takže vyčerpaný deň neodstaví už hotové analýzy. Ak zlyhá samotné
počítadlo, požiadavka prejde — výpadok úložiska nesmie zhodiť produkt a
nekontrolované míňanie je dlhodobý jav, ktorý zachytí ďalšia požiadavka.

### Kontrola nasadenia

Chýbajúci kľúč, nedostupné Blobs ani nenasadená funkcia na pozadí nespôsobia
chybu — aplikácia sa ticho prepne na ukážkové dáta a navonok vyzerá, že funguje.
Preto je tu diagnostika:

```
GET /api/v1/health
```

Vráti `200` s `ready: true`, keď je živá analýza pripravená, inak `503` a v poli
`checks` presne to, čo chýba. Overuje sa skutočný zápis a čítanie z Blobs a to,
či je funkcia na pozadí nasadená — bez jediného volania modelu. Odpoveď hovorí
len o tom, či kľúč existuje, nikdy neprezradí jeho hodnotu.

Každá kontrola stojí jedno spustenie funkcie na pozadí, preto je endpoint
obmedzený na niekoľko volaní za minútu. Ak zlyhá samotný limiter, kontrola
odpovie aj tak — inak by zamlčala práve tú poruchu, kvôli ktorej ju niekto
spustil.
