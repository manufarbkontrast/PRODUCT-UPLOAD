// Zalando Farbcodes - alphabetisch sortiert
// Offizielle Zalando color_code_primary Werte

export const ZALANDO_COLORS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'beige', label: 'Beige' },
  { value: 'black', label: 'Schwarz' },
  { value: 'blue', label: 'Blau' },
  { value: 'brown', label: 'Braun' },
  { value: 'gold', label: 'Gold' },
  { value: 'green', label: 'Grün' },
  { value: 'grey', label: 'Grau' },
  { value: 'multicoloured', label: 'Mehrfarbig' },
  { value: 'olive', label: 'Oliv' },
  { value: 'orange', label: 'Orange' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Lila' },
  { value: 'red', label: 'Rot' },
  { value: 'silver', label: 'Silber' },
  { value: 'turquoise', label: 'Türkis' },
  { value: 'white', label: 'Weiß' },
  { value: 'yellow', label: 'Gelb' },
];

// Mapping von deutschen Farbbezeichnungen zu Zalando-Codes
export const COLOR_CODE_MAP: Record<string, string> = {
  // Deutsch -> Code
  'beige': 'beige',
  'schwarz': 'black',
  'blau': 'blue',
  'braun': 'brown',
  'gold': 'gold',
  'grün': 'green',
  'grau': 'grey',
  'mehrfarbig': 'multicoloured',
  'bunt': 'multicoloured',
  'oliv': 'olive',
  'khaki': 'olive',
  'orange': 'orange',
  'petrol': 'petrol',
  'pink': 'pink',
  'rosa': 'pink',
  'lila': 'purple',
  'violett': 'purple',
  'rot': 'red',
  'silber': 'silver',
  'türkis': 'turquoise',
  'weiß': 'white',
  'weiss': 'white',
  'gelb': 'yellow',
  // Englisch -> Code
  'black': 'black',
  'blue': 'blue',
  'brown': 'brown',
  'green': 'green',
  'grey': 'grey',
  'gray': 'grey',
  'multicoloured': 'multicoloured',
  'multicolored': 'multicoloured',
  'olive': 'olive',
  'purple': 'purple',
  'red': 'red',
  'silver': 'silver',
  'turquoise': 'turquoise',
  'white': 'white',
  'yellow': 'yellow',
  // Zusätzliche Varianten
  'navy': 'blue',
  'dunkelblau': 'blue',
  'hellblau': 'blue',
  'cognac': 'brown',
  'taupe': 'beige',
  'creme': 'beige',
  'cream': 'beige',
  'nude': 'beige',
  'anthrazit': 'grey',
  'anthracite': 'grey',
  'bordeaux': 'red',
  'weinrot': 'red',
  'coral': 'pink',
  'koralle': 'pink',
  'mint': 'green',
  'mintgrün': 'green',
  'neon': 'multicoloured',
  'transparent': 'white',
};

/**
 * Mappt eine Farbbezeichnung zum Zalando-Farbcode
 */
export function mapToZalandoColor(color: string): string | null {
  if (!color) return null;

  const normalized = color.toLowerCase().trim();

  // Direkter Match
  if (COLOR_CODE_MAP[normalized]) {
    return COLOR_CODE_MAP[normalized];
  }

  // Partial Match - prüfe ob die Farbe einen bekannten Teil enthält
  for (const [key, value] of Object.entries(COLOR_CODE_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return null;
}
