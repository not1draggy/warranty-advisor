/**
 * Illustrative analyses used when live research is not configured.
 *
 * These are hand-written examples, not research output. Their sources carry no
 * URL and no organisation name on purpose — demo data must never look like a
 * citation of a real service centre. The interface labels them as a demo.
 */

import type { AnalysisEvidence } from "../../shared/analysis";
import { normalizeQuery } from "../../shared/text";

interface DemoAnalysis {
  aliases: string[];
  evidence: AnalysisEvidence;
}

const DEMO_ANALYSES: DemoAnalysis[] = [
  {
    aliases: ["samsung ue75nu8000", "ue75nu8000", "nu8000", "samsung nu8000"],
    evidence: {
      product: {
        brand: "Samsung",
        model: "UE75NU8000",
        category: "Televízor",
        releaseYear: 2018,
        specs: ['75" 4K UHD', "HDR10+", "Tizen", "Priame LED podsvietenie"],
        matchLevel: "family",
        estimatedPrice: 950,
        priceBasis: "estimate",
        serviceLifeYears: 9,
      },
      evidenceNote:
        "Ide o ukážkovú analýzu. Ilustruje, ako vyzerá hodnotenie modelu, ku ktorému existujú servisné údaje najmä z rovnakej produktovej rady.",
      failures: [
        {
          component: "LED podsvietenie",
          description:
            "Panel postupne tmavne v pásoch alebo sa objavia svetlé škvrny. Obraz zostáva čitateľný, ale kvalita výrazne klesá.",
          riskLevel: "high",
          probability: 40,
          frequency: "Najčastejšia porucha tejto série, typicky po piatich až siedmich rokoch.",
          onsetYears: [5, 8],
          repairCost: [250, 320],
          basis: "estimate",
          difficulty: "high",
          sourceIds: [],
        },
        {
          component: "Napájací zdroj",
          description:
            "Televízor sa nezapne alebo sa cyklicky reštartuje. Väčšinou ide o opotrebované kondenzátory.",
          riskLevel: "medium",
          probability: 18,
          frequency: "Bežná porucha veľkých televízorov po piatich rokoch prevádzky.",
          onsetYears: [4, 8],
          repairCost: [140, 190],
          basis: "estimate",
          difficulty: "medium",
          sourceIds: [],
        },
        {
          component: "Základná doska",
          description:
            "Zlyhá príjem signálu alebo sa televízor zasekáva pri štarte systému.",
          riskLevel: "low",
          probability: 11,
          frequency: "Menej častá porucha, no oprava býva drahá.",
          onsetYears: [3, 8],
          repairCost: [180, 260],
          basis: "assumption",
          difficulty: "medium",
          sourceIds: [],
        },
      ],
      worstCase: {
        component: "Výmena podsvietenia celého panela",
        cost: [250, 320],
        note: "Pri poškodení samotného panela sa oprava spravidla už neoplatí.",
      },
      partsAvailability: {
        rating: "fair",
        note: "LED lišty a napájacie zdroje sú dostupné, no pri staršom modeli treba počítať s čakaním.",
      },
      repairDifficulty: {
        rating: "high",
        note: "Výmena podsvietenia znamená rozobratie celého panela. Práca tvorí väčšinu ceny opravy.",
      },
      strengths: [
        "Kvalitný obraz aj po rokoch prevádzky",
        "Rozšírená sieť servisov na Slovensku",
        "Dobrá dostupnosť bežných náhradných dielov",
      ],
      weaknesses: [
        "Podsvietenie je slabým miestom celej série",
        "Rozobratie veľkého panela je náročné a drahé",
        "Podpora systému Tizen postupne končí",
      ],
      serviceExperience:
        "Servisní technici považujú túto sériu za opraviteľnú, ale prácnu. Diagnostika býva rýchla, samotná oprava podsvietenia však zaberie niekoľko hodín.",
      ownerExperience:
        "Majitelia hodnotia obraz dobre. Sťažnosti sa najčastejšie týkajú stmavnutých pásov v spodnej časti obrazovky po niekoľkých rokoch.",
      competitors: [
        {
          name: "LG UHD rovnakej triedy",
          standing: "similar",
          note: "Podobná poruchovosť, o niečo lacnejšie diely.",
        },
        {
          name: "Sony Bravia rovnakej uhlopriečky",
          standing: "better",
          note: "Spoľahlivejšie podsvietenie, vyššia obstarávacia cena.",
        },
      ],
      goodFor: [
        "Domácnosti, ktoré chcú veľkú uhlopriečku za rozumnú cenu",
        "Bežné sledovanie televízie a filmov",
      ],
      notGoodFor: [
        "Používanie viac ako desať hodín denne",
        "Kupujúcich, ktorí nechcú riešiť žiadnu opravu",
      ],
      summary:
        "Televízor s dobrým obrazom a známou slabinou v podsvietení. Pri bežnom používaní vydrží roky, no na jednu nákladnejšiu opravu je rozumné myslieť dopredu.",
      sources: [],
    },
  },
  {
    aliases: ["iphone 13", "apple iphone 13", "iphone13", "a2633"],
    evidence: {
      product: {
        brand: "Apple",
        model: "iPhone 13",
        category: "Smartfón",
        releaseYear: 2021,
        specs: ['6,1" OLED', "A15 Bionic", "128 GB", "5G"],
        matchLevel: "exact",
        estimatedPrice: 520,
        priceBasis: "estimate",
        serviceLifeYears: 5,
      },
      evidenceNote:
        "Ide o ukážkovú analýzu. Ilustruje, ako vyzerá hodnotenie modelu s bohatými verejnými servisnými údajmi.",
      failures: [
        {
          component: "Batéria",
          description:
            "Kapacita klesne pod osemdesiat percent a telefón nevydrží celý deň. Systém začne obmedzovať výkon.",
          riskLevel: "high",
          probability: 45,
          frequency: "Prakticky u každého telefónu po troch až štyroch rokoch používania.",
          onsetYears: [3, 4],
          repairCost: [89, 119],
          basis: "estimate",
          difficulty: "low",
          sourceIds: [],
        },
        {
          component: "Displej",
          description: "Prasknuté sklo alebo poškodený OLED panel po páde.",
          riskLevel: "medium",
          probability: 16,
          frequency: "Závisí najmä od používania. S ochranným krytom výrazne menej.",
          onsetYears: null,
          repairCost: [279, 329],
          basis: "estimate",
          difficulty: "medium",
          sourceIds: [],
        },
        {
          component: "Nabíjací konektor",
          description: "Nabíjanie sa prerušuje alebo kábel v konektore nedrží.",
          riskLevel: "low",
          probability: 7,
          frequency: "Zriedkavé, väčšinou stačí vyčistenie konektora.",
          onsetYears: [2, 5],
          repairCost: [60, 90],
          basis: "assumption",
          difficulty: "medium",
          sourceIds: [],
        },
      ],
      worstCase: {
        component: "Výmena displeja v autorizovanom servise",
        cost: [279, 329],
        note: "Pri poškodení základnej dosky sa oprava spravidla neoplatí.",
      },
      partsAvailability: {
        rating: "good",
        note: "Diely sú bežne dostupné v autorizovaných aj nezávislých servisoch.",
      },
      repairDifficulty: {
        rating: "low",
        note: "Výmena batérie je rutinný zákrok, ktorý väčšina servisov zvládne v priebehu hodiny.",
      },
      strengths: [
        "Dlhá softvérová podpora",
        "Vynikajúca dostupnosť servisov a dielov",
        "Vysoká zostatková hodnota",
      ],
      weaknesses: [
        "Výmena displeja je drahá",
        "Batéria je spotrebný diel s predvídateľnou životnosťou",
      ],
      serviceExperience:
        "Servisy hodnotia model ako bezproblémový. Najčastejším zákrokom je výmena batérie, ktorá je rýchla a lacná.",
      ownerExperience:
        "Majitelia sú spokojní s výdržou aj rýchlosťou. Po treťom roku sa opakovane spomína potreba výmeny batérie.",
      competitors: [
        {
          name: "Samsung Galaxy S21",
          standing: "similar",
          note: "Porovnateľná poruchovosť, kratšia softvérová podpora.",
        },
        {
          name: "Google Pixel 6",
          standing: "worse",
          note: "Viac hlásených problémov s modemom a čítačkou odtlačkov.",
        },
      ],
      goodFor: [
        "Používateľov, ktorí chcú telefón na štyri a viac rokov",
        "Tých, ktorí oceňujú dostupný servis",
      ],
      notGoodFor: [
        "Kupujúcich s najnižším rozpočtom na prípadnú opravu displeja",
      ],
      summary:
        "Spoľahlivý telefón s predvídateľnými nákladmi. Počítajte s jednou výmenou batérie, inak je riziko nákladnej opravy nízke.",
      sources: [],
    },
  },
  {
    aliases: ["bosch wan28160by", "wan28160by", "wan 28160", "bosch wan28160"],
    evidence: {
      product: {
        brand: "Bosch",
        model: "WAN28160BY",
        category: "Práčka",
        releaseYear: 2020,
        specs: ["7 kg", "1400 ot./min", "EcoSilence Drive", "Trieda A+++"],
        matchLevel: "family",
        estimatedPrice: 430,
        priceBasis: "estimate",
        serviceLifeYears: 12,
      },
      evidenceNote:
        "Ide o ukážkovú analýzu. Ilustruje, ako vyzerá hodnotenie spotrebiča, pri ktorom sa vychádza z konštrukcie a skúseností servisov.",
      failures: [
        {
          component: "Ložiská bubna",
          description:
            "Práčka pri odstreďovaní hlučí a bubon má vôľu. Ide o typickú poruchu na konci životnosti.",
          riskLevel: "high",
          probability: 26,
          frequency: "Objavuje sa najmä po siedmich a viac rokoch intenzívneho prania.",
          onsetYears: [7, 10],
          repairCost: [180, 250],
          basis: "estimate",
          difficulty: "high",
          sourceIds: [],
        },
        {
          component: "Vypúšťacie čerpadlo",
          description: "Práčka nevypustí vodu a zastaví program s chybou.",
          riskLevel: "medium",
          probability: 17,
          frequency: "Bežná porucha, často stačí vyčistiť filter alebo vymeniť čerpadlo.",
          onsetYears: [3, 6],
          repairCost: [80, 120],
          basis: "estimate",
          difficulty: "low",
          sourceIds: [],
        },
        {
          component: "Riadiaca elektronika",
          description: "Program sa nespustí alebo sa spotrebič náhodne vypína.",
          riskLevel: "low",
          probability: 8,
          frequency: "Menej častá porucha, no jedna z drahších.",
          onsetYears: [4, 9],
          repairCost: [150, 220],
          basis: "assumption",
          difficulty: "medium",
          sourceIds: [],
        },
      ],
      worstCase: {
        component: "Výmena ložísk spolu s vaňou",
        cost: [180, 250],
        note: "Pri modeloch s nedeliteľnou vaňou sa oprava po ôsmich rokoch už často neoplatí.",
      },
      partsAvailability: {
        rating: "good",
        note: "Bosch drží náhradné diely dlho a sú dostupné aj cez nezávislé servisy.",
      },
      repairDifficulty: {
        rating: "medium",
        note: "Čerpadlo a elektroniku vymení servis rýchlo, ložiská si vyžadujú rozobratie spotrebiča.",
      },
      strengths: [
        "Dlhá dostupnosť náhradných dielov",
        "Nízka spotreba vody aj energie",
        "Tichý chod počas väčšiny programov",
      ],
      weaknesses: [
        "Oprava ložísk je pracná",
        "Kapacita 7 kg je pre väčšiu rodinu tesná",
      ],
      serviceExperience:
        "Servisy označujú túto radu za nadpriemerne spoľahlivú. Väčšina zásahov sa týka čerpadla a bežného opotrebenia.",
      ownerExperience:
        "Majitelia opakovane uvádzajú bezproblémovú prevádzku počas prvých piatich rokov a spokojnosť s tichým chodom.",
      competitors: [
        {
          name: "Beko rovnakej triedy",
          standing: "worse",
          note: "Nižšia cena, ale kratšia životnosť a horšia dostupnosť dielov.",
        },
        {
          name: "Miele základná rada",
          standing: "better",
          note: "Výrazne dlhšia životnosť za podstatne vyššiu cenu.",
        },
      ],
      goodFor: [
        "Jednotlivcov a menšie domácnosti",
        "Kupujúcich, ktorí plánujú spotrebič používať osem a viac rokov",
      ],
      notGoodFor: [
        "Domácnosti, ktoré perú každý deň veľké dávky",
      ],
      summary:
        "Spoľahlivá práčka s dobrou dostupnosťou dielov. Riziko drahej opravy prichádza až v neskorších rokoch životnosti.",
      sources: [],
    },
  },
];

/** Matches a query against the demo catalogue; `null` when nothing fits. */
export function findDemoAnalysis(query: string): AnalysisEvidence | null {
  const needle = normalizeQuery(query);
  if (!needle) return null;

  const match = DEMO_ANALYSES.find((demo) =>
    demo.aliases.some((alias) => alias === needle || alias.includes(needle) || needle.includes(alias)),
  );
  return match?.evidence ?? null;
}
