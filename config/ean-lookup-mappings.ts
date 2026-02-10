// EAN-Lookup: Mapping-Funktionen für Gemini-Ergebnisse auf Zalando-Felder

import { BRAND_OPTIONS } from './brands';
import { ZALANDO_SILHOUETTES } from './zalando-attributes';

// ─── Silhouette-Mapping ─────────────────────────────────────────────────────

interface SilhouetteMapping {
  readonly key: string;
  readonly aliases: readonly string[];
}

const SILHOUETTE_ALIASES: readonly SilhouetteMapping[] = [
  { key: 'sneaker', aliases: ['sneaker', 'sneakers', 'turnschuh', 'turnschuhe', 'trainers', 'sportschuh', 'laufschuh', 'running shoe'] },
  { key: 'boots', aliases: ['boots', 'stiefel', 'winterstiefel', 'boot'] },
  { key: 'ankle_boots', aliases: ['ankle boots', 'stiefelette', 'stiefeletten', 'bootie', 'booties', 'chelsea boot', 'chelsea boots'] },
  { key: 'low_shoe', aliases: ['low shoe', 'halbschuh', 'halbschuhe', 'schnürschuh', 'derby', 'oxford', 'loafer', 'mokassin', 'slipper'] },
  { key: 'sandals', aliases: ['sandal', 'sandals', 'sandale', 'sandalen', 'sandalette', 'flip flop', 'zehentrenner'] },
  { key: 'pumps', aliases: ['pump', 'pumps', 'high heel', 'high heels', 'stiletto'] },
  { key: 'ballerina_shoe', aliases: ['ballerina', 'ballerinas', 'ballerina shoe', 'ballet flat', 'ballet flats'] },
  { key: 'backless_slipper', aliases: ['backless slipper', 'pantolette', 'pantoletten', 'mule', 'mules', 'slide', 'slides', 'clog', 'clogs'] },
  { key: 'jacket', aliases: ['jacket', 'jacke', 'jacken', 'blouson', 'blazer', 'jeansjacke', 'denim jacket', 'lederjacke', 'leather jacket', 'bomberjacke', 'bomber', 'windbreaker', 'regenjacke'] },
  { key: 'coat', aliases: ['coat', 'mantel', 'parka', 'trenchcoat', 'trench', 'wintermantel', 'daunenmantel', 'overcoat', 'wollmantel'] },
  { key: 'vest', aliases: ['weste', 'gilet', 'bodywarmer', 'daunenweste', 'outdoor vest', 'fleeceweste'] },
  { key: 't_shirt_top', aliases: ['t-shirt', 'tshirt', 't shirt', 'top', 'tank top', 'tanktop', 'unterhemd', 'shirt', 'polo', 'poloshirt', 'polo shirt', 'longsleeve', 'langarmshirt', 'baby tee', 'baby t-shirt', 'babytee', 'vest top', 'crop top', 'croptop', 'tee'] },
  { key: 'shirt', aliases: ['hemd', 'bluse', 'blouse', 'dress shirt', 'button down', 'flanellhemd', 'hawaiihemd', 'leinenhemd'] },
  { key: 'pullover', aliases: ['pullover', 'sweater', 'sweatshirt', 'hoodie', 'kapuzenpullover', 'strickpullover', 'jumper', 'knit', 'fleece'] },
  { key: 'cardigan', aliases: ['cardigan', 'strickjacke', 'strickjacken', 'zip hoodie'] },
  { key: 'trouser', aliases: ['trouser', 'trousers', 'hose', 'hosen', 'jeans', 'chino', 'chinos', 'jogginghose', 'sweatpants', 'shorts', 'bermuda', 'cargo', 'leggings'] },
  { key: 'dress', aliases: ['dress', 'kleid', 'kleider', 'cocktailkleid', 'abendkleid', 'sommerkleid', 'maxikleid', 'midikleid', 'minikleid', 'shirtkleid'] },
  { key: 'skirt', aliases: ['skirt', 'rock', 'minirock', 'midirock', 'maxirock', 'faltenrock', 'jeansrock'] },
  { key: 'one_piece_suit', aliases: ['jumpsuit', 'overall', 'einteiler', 'romper', 'playsuit', 'onesie'] },
  { key: 'combination_clothing', aliases: ['set', 'kombination', 'outfit set', 'twin set', 'twinset', 'anzug', 'suit', 'trainingsanzug', 'jogginganzug'] },
  { key: 'belt', aliases: ['belt', 'gürtel', 'ledergürtel', 'stoffgürtel'] },
  { key: 'gloves', aliases: ['gloves', 'handschuhe', 'handschuh', 'fäustlinge', 'fingerhandschuhe'] },
  { key: 'headgear', aliases: ['hat', 'cap', 'mütze', 'beanie', 'hut', 'kappe', 'basecap', 'snapback', 'bucket hat', 'kopfbedeckung', 'stirnband', 'headband'] },
  { key: 'backpack', aliases: ['backpack', 'rucksack', 'daypack', 'tagesrucksack'] },
  { key: 'bag', aliases: ['bag', 'tasche', 'handtasche', 'umhängetasche', 'schultertasche', 'shopper', 'tote', 'crossbody', 'clutch', 'beutel', 'weekender', 'sporttasche', 'duffel'] },
  { key: 'wallet', aliases: ['wallet', 'geldbörse', 'portemonnaie', 'geldbeutel', 'brieftasche', 'kartenetui', 'card holder'] },
  { key: 'etui', aliases: ['etui', 'case', 'hülle', 'schlüsseletui', 'kosmetiketui', 'brillenetui'] },
  { key: 'shoe_accessoires', aliases: ['shoe accessory', 'schuhzubehör', 'einlegesohle', 'schuhpflege', 'schuhspanner', 'schnürsenkel'] },
  { key: 'travel_equipment', aliases: ['travel equipment', 'reisegepäck', 'koffer', 'trolley', 'suitcase', 'reisetasche', 'packwürfel', 'kulturbeutel', 'necessaire'] },
];

/**
 * Mappt einen Kategorie-String von Gemini auf einen Zalando-Silhouette-Key.
 * Nutzt Fuzzy-Matching mit Alias-Liste.
 */
export function mapToSilhouetteKey(category: string): string | null {
  if (!category) return null;

  const normalized = category.toLowerCase().trim();

  // Exakter Match auf Silhouette-Key
  const directMatch = ZALANDO_SILHOUETTES.find(s => s.key === normalized);
  if (directMatch) return directMatch.key;

  // Exakter Match auf Silhouette-Label
  const labelMatch = ZALANDO_SILHOUETTES.find(
    s => s.label.toLowerCase() === normalized
  );
  if (labelMatch) return labelMatch.key;

  // Alias-Match (enthält oder genau)
  for (const mapping of SILHOUETTE_ALIASES) {
    for (const alias of mapping.aliases) {
      if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
        return mapping.key;
      }
    }
  }

  return null;
}

// ─── Brand-Mapping ──────────────────────────────────────────────────────────

/**
 * Mappt einen Marken-String von Gemini auf den Wert in BRAND_OPTIONS.
 * Nutzt Normalisierung + Fuzzy-Matching.
 */
export function mapToBrandCode(brand: string): string | null {
  if (!brand) return null;

  const normalized = brand.toUpperCase().trim();

  // Exakter Match
  const exactMatch = BRAND_OPTIONS.find(b => b.value === normalized);
  if (exactMatch) return exactMatch.value;

  // Enthält-Match (z.B. "Dr. Martens" → "DR.MARTENS")
  const containsMatch = BRAND_OPTIONS.find(b => {
    const brandNorm = b.value.replace(/[.\s&`´']/g, '').toUpperCase();
    const inputNorm = normalized.replace(/[.\s&`´']/g, '');
    return brandNorm === inputNorm;
  });
  if (containsMatch) return containsMatch.value;

  // Teilstring-Match
  const partialMatch = BRAND_OPTIONS.find(b => {
    const brandNorm = b.value.toLowerCase();
    const inputNorm = normalized.toLowerCase();
    return brandNorm.includes(inputNorm) || inputNorm.includes(brandNorm);
  });
  if (partialMatch) return partialMatch.value;

  return null;
}

// ─── Gender-Mapping ─────────────────────────────────────────────────────────

// Gender-Mapping: Werte entsprechen genderOptions in config/product.ts
const GENDER_MAP: Record<string, string> = {
  'herren': 'mann',
  'männer': 'mann',
  'men': 'mann',
  'male': 'mann',
  'man': 'mann',
  'damen': 'frau',
  'frauen': 'frau',
  'women': 'frau',
  'female': 'frau',
  'woman': 'frau',
  'unisex': 'unisex',
  'kinder': 'kinder',
  'kids': 'kinder',
  'children': 'kinder',
  'jungen': 'kinder',
  'mädchen': 'kinder',
  'boys': 'kinder',
  'girls': 'kinder',
  'baby': 'kinder',
};

/**
 * Mappt einen Gender-String auf den internen Wert (mann, frau, unisex, kinder).
 */
export function mapToGender(gender: string): string | null {
  if (!gender) return null;

  const normalized = gender.toLowerCase().trim();

  // Direkt-Match
  if (GENDER_MAP[normalized]) return GENDER_MAP[normalized];

  // Teilstring-Match
  for (const [key, value] of Object.entries(GENDER_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

// ─── Color-Mapping ──────────────────────────────────────────────────────────

// Offizielle Zalando Farbcodes (nur diese 18 Werte sind erlaubt!)
// beige, black, blue, brown, gold, green, grey, multicoloured, olive, orange, petrol, pink, purple, red, silver, turquoise, white, yellow
const ZALANDO_COLOR_MAP: Record<string, string> = {
  // Schwarz
  'schwarz': 'black',
  'black': 'black',
  'anthrazit': 'black',
  'anthracite': 'black',
  // Weiß
  'weiß': 'white',
  'weiss': 'white',
  'white': 'white',
  'off-white': 'white',
  'offwhite': 'white',
  'ecru': 'white',
  // Blau
  'blau': 'blue',
  'blue': 'blue',
  'dunkelblau': 'blue',
  'navy': 'blue',
  'hellblau': 'blue',
  'light blue': 'blue',
  'dark blue': 'blue',
  'marine': 'blue',
  'kobalt': 'blue',
  'royal blue': 'blue',
  // Rot
  'rot': 'red',
  'red': 'red',
  'bordeaux': 'red',
  'burgundy': 'red',
  'weinrot': 'red',
  'kirschrot': 'red',
  // Grün
  'grün': 'green',
  'green': 'green',
  'mint': 'green',
  'mintgrün': 'green',
  'neon green': 'green',
  'forest green': 'green',
  'dunkelgrün': 'green',
  'hellgrün': 'green',
  // Gelb
  'gelb': 'yellow',
  'yellow': 'yellow',
  'neon yellow': 'yellow',
  'senf': 'yellow',
  'mustard': 'yellow',
  // Orange
  'orange': 'orange',
  'koralle': 'orange',
  'coral': 'orange',
  'apricot': 'orange',
  // Braun
  'braun': 'brown',
  'brown': 'brown',
  'cognac': 'brown',
  'camel': 'brown',
  'chocolate': 'brown',
  'schokolade': 'brown',
  // Grau
  'grau': 'grey',
  'gray': 'grey',
  'grey': 'grey',
  'hellgrau': 'grey',
  'dunkelgrau': 'grey',
  'charcoal': 'grey',
  // Pink
  'rosa': 'pink',
  'pink': 'pink',
  'magenta': 'pink',
  'fuchsia': 'pink',
  'altrosa': 'pink',
  // Lila/Purple
  'lila': 'purple',
  'violett': 'purple',
  'purple': 'purple',
  'lavender': 'purple',
  'lavendel': 'purple',
  'mauve': 'purple',
  // Beige
  'beige': 'beige',
  'creme': 'beige',
  'cream': 'beige',
  'taupe': 'beige',
  'nude': 'beige',
  'sand': 'beige',
  'sandfarben': 'beige',
  // Silber
  'silber': 'silver',
  'silver': 'silver',
  // Gold
  'gold': 'gold',
  'golden': 'gold',
  'bronze': 'gold',
  'kupfer': 'gold',
  'copper': 'gold',
  // Oliv
  'olive': 'olive',
  'oliv': 'olive',
  'khaki': 'olive',
  // Türkis
  'türkis': 'turquoise',
  'turquoise': 'turquoise',
  'cyan': 'turquoise',
  'aqua': 'turquoise',
  // Petrol
  'petrol': 'petrol',
  'teal': 'petrol',
  // Mehrfarbig
  'multicolor': 'multicoloured',
  'multicoloured': 'multicoloured',
  'multicolored': 'multicoloured',
  'bunt': 'multicoloured',
  'mehrfarbig': 'multicoloured',
  'gemustert': 'multicoloured',
  'neon': 'multicoloured',
  'regenbogen': 'multicoloured',
  'rainbow': 'multicoloured',
};

/**
 * Mappt einen Farb-String auf einen offiziellen Zalando-Farbcode.
 * Gibt nur gültige Werte zurück: beige, black, blue, brown, gold, green, grey,
 * multicoloured, olive, orange, petrol, pink, purple, red, silver, turquoise, white, yellow
 */
export function mapToColor(color: string): string | null {
  if (!color) return null;

  const normalized = color.toLowerCase().trim();

  // Direkt-Match
  if (ZALANDO_COLOR_MAP[normalized]) return ZALANDO_COLOR_MAP[normalized];

  // Teilstring-Match (z.B. "dunkelblau meliert" → "blue")
  for (const [key, value] of Object.entries(ZALANDO_COLOR_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return null; // Kein Match = kein gültiger Zalando-Farbcode
}

// ─── Ergebnis-Interface ─────────────────────────────────────────────────────

export interface EanLookupResult {
  readonly found: boolean;
  readonly name?: string;
  readonly brand?: string;
  readonly brandCode?: string;
  readonly color?: string;
  readonly colorCode?: string;
  readonly gender?: string;
  readonly genderCode?: string;
  readonly silhouette?: string;
  readonly silhouetteKey?: string;
  readonly material?: string;
  readonly confidence?: 'high' | 'medium' | 'low';
  readonly source?: 'shopify' | 'gemini' | string;

  // Shopify-spezifische Felder
  readonly sku?: string;
  readonly price?: string;
  readonly compareAtPrice?: string;
  readonly description?: string;
  readonly images?: readonly string[];
  readonly size?: string;
  readonly tags?: readonly string[];
  readonly inventoryQuantity?: number;
  readonly barcode?: string;
}
