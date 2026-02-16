// Zalando Silhouetten-Attribute — generiert aus zalando_attribute_manu.xlsx
// NUR mandatory Attribute (Pflichtfelder)

export type AttributeRequirement = 'mandatory';

export interface ZalandoAttribute {
  readonly key: string;
  readonly label: string;
  readonly requirement: AttributeRequirement;
  readonly type: 'text' | 'select' | 'number' | 'textarea';
  readonly options?: readonly string[];
  readonly notApplicable?: boolean;
}

export interface ZalandoSilhouette {
  readonly key: string;
  readonly label: string;
  readonly attributes: readonly ZalandoAttribute[];
  readonly imageType: 'shoes' | 'clothing' | 'accessories';
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────────

export function getSilhouetteByKey(key: string): ZalandoSilhouette | undefined {
  return ZALANDO_SILHOUETTES.find(s => s.key === key);
}

export function getSilhouetteOptions(): readonly { value: string; label: string }[] {
  return ZALANDO_SILHOUETTES.map(s => ({ value: s.key, label: s.label }));
}

// ─── Gemeinsame Konstanten ──────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  'beige', 'black', 'blue', 'brown', 'gold', 'green', 'grey',
  'multicoloured', 'olive', 'orange', 'petrol', 'pink', 'purple',
  'red', 'silver', 'turquoise', 'white', 'yellow',
] as const;

const SEASON_OPTIONS = ['FS25', 'HW25', 'FS26', 'HW26', 'NOOS'] as const;

const SIZE_GROUP_OPTIONS = ['EU', 'DE', 'UK', 'US', 'IT', 'FR'] as const;

const AGE_GROUP_OPTIONS = ['Erwachsene', 'Kinder', 'Baby', 'Teenager'] as const;

const GENDER_OPTIONS = ['Herren', 'Damen', 'Unisex', 'Kinder'] as const;

const MATERIAL_OPTIONS = [
  'Baumwolle', 'Polyester', 'Viskose', 'Elasthan', 'Polyamid',
  'Wolle', 'Leinen', 'Seide', 'Leder', 'Kunstleder', 'Wildleder',
  'Nylon', 'Kaschmir', 'Modal', 'Lyocell', 'Acryl', 'Fleece',
  'Denim', 'Canvas', 'Gummi', 'Synthetik', 'Textil', 'Nicht zutreffend',
] as const;

// ─── Gemeinsame Basis-Attribute ─────────────────────────────────────────────────

const BASE_ATTRIBUTES: readonly ZalandoAttribute[] = [
  { key: 'brand_code', label: 'Marke', requirement: 'mandatory', type: 'text' },
  { key: 'color_code_primary', label: 'Hauptfarbe', requirement: 'mandatory', type: 'select', options: COLOR_OPTIONS },
  { key: 'description', label: 'Produktbeschreibung', requirement: 'mandatory', type: 'textarea' },
  { key: 'ean', label: 'EAN / GTIN', requirement: 'mandatory', type: 'text' },
] as const;

const BASE_ATTRIBUTES_AFTER_MATERIAL: readonly ZalandoAttribute[] = [
  { key: 'media', label: 'Medien', requirement: 'mandatory', type: 'text' },
  { key: 'name', label: 'Produktname', requirement: 'mandatory', type: 'text' },
  { key: 'season_code', label: 'Saison', requirement: 'mandatory', type: 'select', options: SEASON_OPTIONS },
  { key: 'size_codes', label: 'Größenangaben', requirement: 'mandatory', type: 'text' },
  { key: 'size_group', label: 'Größensystem', requirement: 'mandatory', type: 'select', options: SIZE_GROUP_OPTIONS },
  { key: 'target_age_groups', label: 'Altersgruppe', requirement: 'mandatory', type: 'select', options: AGE_GROUP_OPTIONS },
  { key: 'target_genders', label: 'Geschlecht', requirement: 'mandatory', type: 'select', options: GENDER_OPTIONS },
] as const;

// ─── Material-Attribute nach Kategorie ──────────────────────────────────────────

// Schuhe & einfache Accessoires: nur Obermaterial
const MATERIAL_SHOES: readonly ZalandoAttribute[] = [
  { key: 'material_upper_material_clothing', label: 'Hauptmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS },
] as const;

// Gürtel: Obermaterial + Vorderseite + Rückseite
const MATERIAL_BELT: readonly ZalandoAttribute[] = [
  { key: 'material_upper_material_back', label: 'Obermaterial Rückseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_clothing', label: 'Hauptmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS },
  { key: 'material_upper_material_front', label: 'Obermaterial Vorderseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
] as const;

// Kopfbedeckung & Handschuhe: Obermaterial + Futter
const MATERIAL_HEADGEAR_GLOVES: readonly ZalandoAttribute[] = [
  { key: 'material_futter_clothing', label: 'Futter', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_clothing', label: 'Hauptmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS },
] as const;

// Einfache Bekleidung: Obermaterial + Futter + Vorderseite + Rückseite + Ärmel + Füllung
const MATERIAL_SIMPLE_CLOTHING: readonly ZalandoAttribute[] = [
  { key: 'material_filling', label: 'Füllung', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_futter_clothing', label: 'Futter', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_back', label: 'Obermaterial Rückseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_clothing', label: 'Hauptmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS },
  { key: 'material_upper_material_front', label: 'Obermaterial Vorderseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_sleeves', label: 'Obermaterial Ärmel', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
] as const;

// Jacken & Mäntel: ALLE Material-Attribute
const MATERIAL_JACKET_COAT: readonly ZalandoAttribute[] = [
  { key: 'material_faux_fur_collar_material', label: 'Kunstfellkragen Material', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_filling', label: 'Füllung', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_futter_clothing', label: 'Futter', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_inner_jacket_lining', label: 'Innenjacke Futter', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_inner_jacket_outer_material', label: 'Innenjacke Außenmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_inner_jacket_padding', label: 'Innenjacke Polsterung', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_middle_layer_material', label: 'Mittellage Material', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_outer_jacket_inner_material', label: 'Außenjacke Innenmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_sleeve_lining', label: 'Ärmel-Futter', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_trim_material', label: 'Besatz-Material', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_back', label: 'Obermaterial Rückseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_bottom', label: 'Obermaterial Unterteil', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_clothing', label: 'Hauptmaterial', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS },
  { key: 'material_upper_material_front', label: 'Obermaterial Vorderseite', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_insert', label: 'Obermaterial Einsatz', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_middle', label: 'Obermaterial Mittelteil', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_sleeves', label: 'Obermaterial Ärmel', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
  { key: 'material_upper_material_top', label: 'Obermaterial Oberteil', requirement: 'mandatory', type: 'select', options: MATERIAL_OPTIONS, notApplicable: true },
] as const;

// ─── Hilfsfunktion: Attribute zusammenbauen ─────────────────────────────────────

function buildAttributes(
  materialAttrs: readonly ZalandoAttribute[],
  extraAfterMaterial?: readonly ZalandoAttribute[],
): readonly ZalandoAttribute[] {
  return [
    ...BASE_ATTRIBUTES,
    ...materialAttrs,
    ...(extraAfterMaterial ?? []),
    ...BASE_ATTRIBUTES_AFTER_MATERIAL,
  ];
}

// ─── Silhouetten ─────────────────────────────────────────────────────────────

export const ZALANDO_SILHOUETTES: readonly ZalandoSilhouette[] = [
  // ── Schuhe (nur Obermaterial) ──────────────────────────────────────────────
  {
    key: 'ankle_boots',
    label: 'Stiefeletten',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'backless_slipper',
    label: 'Pantoletten',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'ballerina_shoe',
    label: 'Ballerinas',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'boots',
    label: 'Stiefel',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'low_shoe',
    label: 'Halbschuhe',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'pumps',
    label: 'Pumps',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'sandals',
    label: 'Sandalen',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'sneaker',
    label: 'Sneaker',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'shoe_accessoires',
    label: 'Schuhzubehör',
    imageType: 'shoes',
    attributes: buildAttributes(MATERIAL_SHOES, [
      { key: 'volume_ml', label: 'Volumen (ml)', requirement: 'mandatory', type: 'number' },
    ]),
  },

  // ── Einfache Accessoires (nur Obermaterial) ────────────────────────────────
  {
    key: 'backpack',
    label: 'Rucksack',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'bag',
    label: 'Tasche',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'etui',
    label: 'Etui',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'wallet',
    label: 'Geldbörse / Portemonnaie',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_SHOES),
  },
  {
    key: 'travel_equipment',
    label: 'Reisegepäck / Reiseaccessoires',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_SHOES),
  },

  // ── Gürtel (Obermaterial + Vorderseite + Rückseite) ──────────────────────────
  {
    key: 'belt',
    label: 'Gürtel',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_BELT),
  },

  // ── Kopfbedeckung & Handschuhe (Obermaterial + Futter) ─────────────────────
  {
    key: 'headgear',
    label: 'Kopfbedeckung',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_HEADGEAR_GLOVES),
  },
  {
    key: 'gloves',
    label: 'Handschuhe',
    imageType: 'accessories',
    attributes: buildAttributes(MATERIAL_HEADGEAR_GLOVES),
  },

  // ── Einfache Bekleidung ────────────────────────────────────────────────────
  {
    key: 't_shirt_top',
    label: 'T-Shirt / Top',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'shirt',
    label: 'Hemd',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'pullover',
    label: 'Pullover',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'trouser',
    label: 'Hose',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'skirt',
    label: 'Rock',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'dress',
    label: 'Kleid',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'one_piece_suit',
    label: 'Jumpsuit / Overall',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'combination_clothing',
    label: 'Kombinationsbekleidung / Sets',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'vest',
    label: 'Weste',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },
  {
    key: 'cardigan',
    label: 'Strickjacke',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_SIMPLE_CLOTHING),
  },

  // ── Jacken & Mäntel (alle Material-Attribute) ─────────────────────────────────
  {
    key: 'jacket',
    label: 'Jacke',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_JACKET_COAT),
  },
  {
    key: 'coat',
    label: 'Mantel',
    imageType: 'clothing',
    attributes: buildAttributes(MATERIAL_JACKET_COAT),
  },
];
