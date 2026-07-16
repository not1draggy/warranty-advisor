export type RiskLevel = "high" | "medium" | "low";

export interface Source {
  name: string;
  url: string;
  date: string;
  authorityLabel: string;
  authorityPoints: number;
}

export interface PriceBreakdown {
  part: number;
  labor: number;
  diagnostics: number;
  transport: number;
}

export interface Failure {
  component: string;
  riskLevel: RiskLevel;
  probability: number;
  priceBreakdown: PriceBreakdown;
  totalRange: [number, number];
  confidence: number;
  sources: Source[];
}

export interface WarrantyTier {
  years: number;
  price: number;
}

export interface Product {
  id: string;
  brand: string;
  model: string;
  category: string;
  releaseYear: number;
  specs: string[];
  aliases?: string[];
  extendedWarrantyPrice: number;
  warrantyTiers: WarrantyTier[];
  avgRepairRange: [number, number];
  mostCommonFailure: string;
  failures: Failure[];
  riskyComponents: string[];
  saferComponents: string[];
}

export const mockProducts: Product[] = [
  {
    id: "samsung-ue75nu8000",
    brand: "Samsung",
    model: "UE75NU8000",
    category: "Televízor",
    releaseYear: 2018,
    specs: ['75" 4K UHD', "HDR10+", "Smart TV Tizen", "Priama LED"],
    aliases: ["75NU8E0B3LA", "UE75NU8000TXXH", "NU8000"],
    extendedWarrantyPrice: 89,
    warrantyTiers: [
      { years: 1, price: 89 },
      { years: 2, price: 149 },
      { years: 3, price: 199 },
    ],
    avgRepairRange: [250, 300],
    mostCommonFailure: "LED podsvietenie",
    failures: [
      {
        component: "LED podsvietenie",
        riskLevel: "high",
        probability: 42,
        priceBreakdown: { part: 140, labor: 90, diagnostics: 20, transport: 25 },
        totalRange: [250, 300],
        confidence: 82,
        sources: [
          {
            name: "Samsung Authorized Service SK",
            url: "#",
            date: "2025-09-12",
            authorityLabel: "Autorizovaný servis",
            authorityPoints: 95,
          },
          {
            name: "TV Service Manual BN44-00932",
            url: "#",
            date: "2024-11-03",
            authorityLabel: "Servisný manuál",
            authorityPoints: 90,
          },
          {
            name: "AVForums – NU8000 backlight thread",
            url: "#",
            date: "2025-06-21",
            authorityLabel: "Fórum",
            authorityPoints: 40,
          },
        ],
      },
      {
        component: "Napájací zdroj",
        riskLevel: "medium",
        probability: 18,
        priceBreakdown: { part: 75, labor: 55, diagnostics: 20, transport: 25 },
        totalRange: [140, 190],
        confidence: 74,
        sources: [
          {
            name: "TV-Servis.sk cenník 2025",
            url: "#",
            date: "2025-08-04",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
          {
            name: "ElektroFórum SK",
            url: "#",
            date: "2025-05-17",
            authorityLabel: "Fórum",
            authorityPoints: 40,
          },
        ],
      },
      {
        component: "Mainboard",
        riskLevel: "medium",
        probability: 12,
        priceBreakdown: { part: 120, labor: 70, diagnostics: 25, transport: 25 },
        totalRange: [180, 260],
        confidence: 61,
        sources: [
          {
            name: "TV-Servis.sk cenník 2025",
            url: "#",
            date: "2025-08-04",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
          {
            name: "Reddit r/television",
            url: "#",
            date: "2025-02-11",
            authorityLabel: "Reddit",
            authorityPoints: 30,
          },
        ],
      },
      {
        component: "Reproduktory",
        riskLevel: "low",
        probability: 4,
        priceBreakdown: { part: 25, labor: 25, diagnostics: 15, transport: 15 },
        totalRange: [60, 90],
        confidence: 55,
        sources: [
          {
            name: "TV-Servis.sk cenník 2025",
            url: "#",
            date: "2025-08-04",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
          {
            name: "Reddit r/4kTV",
            url: "#",
            date: "2024-12-02",
            authorityLabel: "Reddit",
            authorityPoints: 30,
          },
        ],
      },
    ],
    riskyComponents: ["LED podsvietenie", "Napájací zdroj", "Mainboard"],
    saferComponents: ["Reproduktory", "Diaľkový ovládač", "Wi-Fi modul"],
  },
  {
    id: "iphone-13",
    brand: "Apple",
    model: "iPhone 13",
    category: "Smartfón",
    releaseYear: 2021,
    specs: ['6.1" OLED', "A15 Bionic", "128 GB", "5G"],
    aliases: ["A2633", "iphone13"],
    extendedWarrantyPrice: 129,
    warrantyTiers: [
      { years: 1, price: 129 },
      { years: 2, price: 199 },
      { years: 3, price: 249 },
    ],
    avgRepairRange: [89, 329],
    mostCommonFailure: "Batéria",
    failures: [
      {
        component: "Batéria",
        riskLevel: "high",
        probability: 38,
        priceBreakdown: { part: 45, labor: 35, diagnostics: 9, transport: 15 },
        totalRange: [89, 119],
        confidence: 88,
        sources: [
          {
            name: "Apple Authorized Service Provider",
            url: "#",
            date: "2025-10-01",
            authorityLabel: "Autorizovaný servis",
            authorityPoints: 95,
          },
          {
            name: "iFixit iPhone 13 Battery Guide",
            url: "#",
            date: "2025-03-14",
            authorityLabel: "Servisný manuál",
            authorityPoints: 90,
          },
          {
            name: "MobilServis.sk cenník",
            url: "#",
            date: "2025-07-22",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
        ],
      },
      {
        component: "Displej",
        riskLevel: "medium",
        probability: 15,
        priceBreakdown: { part: 190, labor: 70, diagnostics: 15, transport: 20 },
        totalRange: [279, 329],
        confidence: 80,
        sources: [
          {
            name: "Apple Authorized Service Provider",
            url: "#",
            date: "2025-10-01",
            authorityLabel: "Autorizovaný servis",
            authorityPoints: 95,
          },
          {
            name: "MobilServis.sk cenník",
            url: "#",
            date: "2025-07-22",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
        ],
      },
      {
        component: "Nabíjací port",
        riskLevel: "low",
        probability: 6,
        priceBreakdown: { part: 20, labor: 30, diagnostics: 10, transport: 15 },
        totalRange: [60, 90],
        confidence: 65,
        sources: [
          {
            name: "iFixit Lightning Port Repair",
            url: "#",
            date: "2025-01-19",
            authorityLabel: "Servisný manuál",
            authorityPoints: 90,
          },
          {
            name: "Reddit r/iphone",
            url: "#",
            date: "2025-05-05",
            authorityLabel: "Reddit",
            authorityPoints: 30,
          },
        ],
      },
    ],
    riskyComponents: ["Batéria", "Displej"],
    saferComponents: ["Nabíjací port", "Reproduktor", "Zadný kryt"],
  },
  {
    id: "bosch-wan28160by",
    brand: "Bosch",
    model: "WAN28160BY",
    category: "Práčka",
    releaseYear: 2020,
    specs: ["7 kg", "1400 ot./min", "EcoSilence Drive", "A+++"],
    aliases: ["WAN 28160", "WAN28160"],
    extendedWarrantyPrice: 79,
    warrantyTiers: [
      { years: 1, price: 39.9 },
      { years: 2, price: 59.9 },
      { years: 3, price: 70.9 },
    ],
    avgRepairRange: [180, 250],
    mostCommonFailure: "Ložiská bubna",
    failures: [
      {
        component: "Ložiská bubna",
        riskLevel: "high",
        probability: 28,
        priceBreakdown: { part: 70, labor: 130, diagnostics: 20, transport: 30 },
        totalRange: [180, 250],
        confidence: 78,
        sources: [
          {
            name: "Bosch Autorizovaný servis SK",
            url: "#",
            date: "2025-09-08",
            authorityLabel: "Autorizovaný servis",
            authorityPoints: 95,
          },
          {
            name: "Bosch Service Manual WAN2",
            url: "#",
            date: "2024-10-11",
            authorityLabel: "Servisný manuál",
            authorityPoints: 90,
          },
          {
            name: "PračkyServis.sk cenník",
            url: "#",
            date: "2025-06-30",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
        ],
      },
      {
        component: "Vypúšťacie čerpadlo",
        riskLevel: "medium",
        probability: 17,
        priceBreakdown: { part: 30, labor: 40, diagnostics: 15, transport: 25 },
        totalRange: [80, 120],
        confidence: 72,
        sources: [
          {
            name: "PračkyServis.sk cenník",
            url: "#",
            date: "2025-06-30",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
          {
            name: "Modrý koník – diskusia",
            url: "#",
            date: "2025-04-14",
            authorityLabel: "Fórum",
            authorityPoints: 40,
          },
        ],
      },
      {
        component: "Elektronika",
        riskLevel: "low",
        probability: 7,
        priceBreakdown: { part: 90, labor: 40, diagnostics: 20, transport: 25 },
        totalRange: [150, 220],
        confidence: 60,
        sources: [
          {
            name: "PračkyServis.sk cenník",
            url: "#",
            date: "2025-06-30",
            authorityLabel: "Servis s cenníkom",
            authorityPoints: 80,
          },
          {
            name: "Reddit r/appliances",
            url: "#",
            date: "2025-02-27",
            authorityLabel: "Reddit",
            authorityPoints: 30,
          },
        ],
      },
    ],
    riskyComponents: ["Ložiská bubna", "Vypúšťacie čerpadlo"],
    saferComponents: ["Elektronika", "Dvierka", "Ohrievacie teleso"],
  },
];

export interface ParsedQuery {
  productQuery: string;
  years: number | null;
  priceOverride: number | null;
}

export function parseQuery(raw: string): ParsedQuery {
  let working = raw.trim();

  let priceOverride: number | null = null;
  let years: number | null = null;

  const warrantyMatch = working.match(
    /(?:^|\s)\+(\d+)\s*(?:r|rok|roky|rokov)?(?:\s+(\d+(?:[.,]\d{1,2})?)\s*€?)?(?=\s|$)/i,
  );
  if (warrantyMatch) {
    years = parseInt(warrantyMatch[1], 10);
    if (warrantyMatch[2]) {
      priceOverride = parseFloat(warrantyMatch[2].replace(",", "."));
    }
    working = working.replace(warrantyMatch[0], " ");
  }

  return { productQuery: working.trim(), years, priceOverride };
}

export interface SearchResult {
  product: Product;
  selectedTier: WarrantyTier;
}

export function findProduct(query: string): SearchResult | undefined {
  const { productQuery, years, priceOverride } = parseQuery(query);
  const cleaned = productQuery.toLowerCase();
  if (!cleaned) return undefined;

  const product = mockProducts.find((p) => {
    const haystack = [p.model, `${p.brand} ${p.model}`, p.brand, ...(p.aliases ?? [])].map((s) =>
      s.toLowerCase(),
    );
    return haystack.some((h) => h === cleaned || h.includes(cleaned) || cleaned.includes(h));
  });

  if (!product) return undefined;

  const baseTier =
    (years != null && product.warrantyTiers.find((t) => t.years === years)) ||
    product.warrantyTiers[0];

  const selectedTier: WarrantyTier =
    priceOverride != null ? { years: years ?? baseTier.years, price: priceOverride } : baseTier;

  return { product, selectedTier };
}

export const EXAMPLE_QUERIES = ["Samsung UE75NU8000", "iPhone 13", "Bosch WAN28160BY +3 70,90€"];
