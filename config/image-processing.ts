// Bildbearbeitungs-Profile für verschiedene Produktkategorien
// Mapping basiert auf Zalando-Silhouetten-Keys

export type ImageProcessingType = 'shoes' | 'clothing' | 'accessories';

// Silhouetten-Keys → Bildbearbeitungs-Profil
export const categoryImageType: Record<string, ImageProcessingType> = {
  // Schuhe
  ankle_boots: 'shoes',
  backless_slipper: 'shoes',
  ballerina_shoe: 'shoes',
  boots: 'shoes',
  low_shoe: 'shoes',
  pumps: 'shoes',
  sandals: 'shoes',
  sneaker: 'shoes',
  shoe_accessoires: 'shoes',
  // Kleidung
  t_shirt_top: 'clothing',
  shirt: 'clothing',
  pullover: 'clothing',
  cardigan: 'clothing',
  jacket: 'clothing',
  coat: 'clothing',
  vest: 'clothing',
  trouser: 'clothing',
  dress: 'clothing',
  skirt: 'clothing',
  one_piece_suit: 'clothing',
  combination_clothing: 'clothing',
  // Accessoires
  belt: 'accessories',
  gloves: 'accessories',
  headgear: 'accessories',
  backpack: 'accessories',
  bag: 'accessories',
  wallet: 'accessories',
  etui: 'accessories',
  travel_equipment: 'accessories',
  // Legacy-Mapping (falls alte Kategorien noch vorhanden)
  'Schuhe': 'shoes',
  'T-Shirts': 'clothing',
  'Hoodies': 'clothing',
  'Pullover': 'clothing',
  'Jacken': 'clothing',
  'Hosen': 'clothing',
  'Shorts': 'clothing',
  'Kleider': 'clothing',
  'Röcke': 'clothing',
  'Accessoires': 'accessories',
  'Taschen': 'accessories',
  'Sonstiges': 'clothing',
};

// Schuh-Profil: Mit leichtem Schatten
export const SHOES_PROMPT = `Professional e-commerce product photography with these EXACT specifications:

PRESERVE ORIGINAL COMPOSITION - CRITICAL:
- EXACT same camera angle as original image - do NOT change
- EXACT same camera distance to product - do NOT zoom in or out
- EXACT same viewing side (left/right/front/back) - do NOT rotate product
- EXACT same product orientation and perspective - do NOT flip or mirror
- If original shows left side -> keep left side
- If original shows right side -> keep right side
- If original shows front -> keep front view
- If original shows back -> keep back view
- Camera position relative to product MUST stay identical
- Product size in frame MUST match original proportions

LIGHTING SETUP:
- Soft, diffused studio lighting from top-left at 45-degree angle
- Creates gentle, natural shadow falling to bottom-right
- Shadow opacity approximately 15-20%, very soft edges
- Even, consistent lighting across entire product
- No harsh highlights or dark spots
- Color temperature: neutral daylight (5500K)

BACKGROUND & COMPOSITION:
- Pure white to very light gray background (#F5F5F5 to #FFFFFF)
- Product centered in frame
- Generous white space margins: minimum 15-20% on all sides
- Product occupies approximately 60-65% of image height
- Horizontal centering with balanced left/right margins

PRODUCT POSITIONING:
- Product sits naturally on invisible surface
- Realistic contact shadow directly beneath product
- No floating or unnatural positioning

TECHNICAL REQUIREMENTS:
- Ultra-high resolution, sharp focus throughout
- Clean edges, no background artifacts
- Professional color accuracy
- Soft, realistic shadows only
- Studio-quality finish optimized for white backgrounds

MAINTAIN ORIGINAL:
- Camera angle MUST stay identical
- Camera distance MUST stay identical
- Product viewing side MUST stay identical
- Product proportions remain accurate
- No distortion or stretching
- No rotation, flipping, or perspective changes
- No zooming in or out

OUTPUT STYLE:
- Clean, minimal aesthetic
- Focus on product details and materials
- Professional e-commerce standard
- Optimized for website product pages
- No people, hands, or styling props visible

TRANSFORM ONLY: lighting quality, background to pure white/light gray, centering, add subtle shadow
NEVER CHANGE: camera position, viewing angle, product orientation, zoom level`;

// Accessoires-Profil: Für Taschen, Rucksäcke, Gürtel, Mützen etc.
export const ACCESSORIES_PROMPT = `Professional e-commerce product photography for accessories (bags, backpacks, wallets, belts, hats, beanies) with these EXACT specifications:

PRESERVE ORIGINAL COMPOSITION - CRITICAL:
- EXACT same camera angle as original image - do NOT change
- EXACT same camera distance to product - do NOT zoom in or out
- EXACT same viewing side (left/right/front/back) - do NOT rotate product
- EXACT same product orientation and perspective - do NOT flip or mirror
- If original shows front of product -> keep front view
- If original shows back of product -> keep back view
- If original shows side of product -> keep side view
- Camera position relative to product MUST stay identical
- Product size in frame MUST match original proportions
- Do NOT reinterpret or "improve" the viewing angle

LIGHTING SETUP:
- Soft, diffused studio lighting from multiple angles
- Very subtle shadow for depth (5-10% opacity)
- Even, consistent lighting across entire product
- No harsh highlights or dark spots
- Color temperature: neutral daylight (5500K)

BACKGROUND & COMPOSITION:
- Pure white background (#FFFFFF)
- Product centered in frame
- Generous white space margins: minimum 15% on all sides
- Product occupies approximately 70-80% of image area
- Horizontal and vertical centering

PRODUCT POSITIONING:
- Keep product at EXACT same angle as original photo
- Maintain realistic proportions
- Subtle contact shadow for grounding

TECHNICAL REQUIREMENTS:
- Ultra-high resolution, sharp focus throughout
- Clean edges, no background artifacts
- Professional color accuracy
- True-to-life material textures visible
- Details like zippers, buckles, stitching clearly visible

MAINTAIN ORIGINAL:
- Camera angle MUST stay identical
- Camera distance MUST stay identical
- Product viewing side MUST stay identical
- Product proportions remain accurate
- No distortion or stretching
- No rotation, flipping, or perspective changes
- No zooming in or out
- Material textures preserved

OUTPUT STYLE:
- Clean, minimal aesthetic
- Focus on product craftsmanship and details
- Professional e-commerce standard
- Square or near-square aspect ratio preferred
- No people, hands, or styling props visible

TRANSFORM ONLY: lighting quality, background to pure white, centering, add subtle shadow
NEVER CHANGE: camera position, viewing angle, product orientation, zoom level`;

// Kleidung-Profil: Zalando-Standard, komplett schattenlos
export const CLOTHING_PROMPT = `Professional e-commerce product photography optimized for Zalando visualization standards with these EXACT specifications:

ZALANDO FORMAT REQUIREMENTS - CRITICAL:
- Aspect ratio MUST be 1:1.44 (width x height)
- Best practice size: 1801 x 2600 pixels
- Minimum size: 762 x 1100 pixels
- Image type: JPG/JPEG
- Maximum file size: 20MB
- Upright format (portrait orientation)
- High resolution at any image size
- Sharp, clear focus - no blurry images

PRESERVE ORIGINAL COMPOSITION - CRITICAL:
- EXACT same camera angle as original image - do NOT change
- EXACT same camera distance to product - do NOT zoom in or out
- EXACT same viewing side (left/right/front) - do NOT rotate product
- EXACT same product orientation and perspective - do NOT flip or mirror
- If original shows left side → keep left side
- If original shows right side → keep right side
- If original shows front → keep front view
- Camera position relative to product MUST stay identical
- Product size in frame MUST match original proportions

ZALANDO CENTERING REQUIREMENTS:
- Product MUST be perfectly centered in frame
- Both horizontally and vertically centered
- If product is not centered, image will be rejected
- Zalando will NOT handle the editing if centering is incorrect
- Extra white space will be added automatically around the image

PRODUCT POSITIONING & SIZE:
- Product occupies the space between "Minimum Size" and "Maximum Size" boundaries
- Product fits within the blue inner frame (minimum size)
- Product does not exceed the red outer frame (maximum size)
- Product centered with balanced margins on all sides
- Maintain proper proportion within allowed size range

LIGHTING SETUP:
- Soft, diffused studio lighting creating even illumination
- NO shadows anywhere in the image
- Completely shadowless studio photography
- Bright, even lighting from all directions
- No harsh highlights or dark spots
- Color temperature: neutral daylight (5500K)
- Pure flat lighting with no directional shadows

BACKGROUND:
- Pure white background (#FFFFFF)
- Completely clean, no artifacts or imperfections
- Professional studio quality
- No texture or variations in background

TECHNICAL REQUIREMENTS:
- Ultra-high resolution, sharp focus throughout
- Clean edges, no background artifacts
- Professional color accuracy
- Completely shadowless lighting
- No blurry or out-of-focus areas
- Perfect image quality for Zalando standards

MAINTAIN ORIGINAL:
- Camera angle MUST stay identical
- Camera distance MUST stay identical
- Product viewing side MUST stay identical
- Product proportions remain accurate
- No distortion or stretching
- No rotation, flipping, or perspective changes
- No zooming in or out

OUTPUT REQUIREMENTS:
- Upright portrait format (1:1.44 aspect ratio)
- Product perfectly centered
- Completely shadowless presentation
- Pure white background
- Professional e-commerce standard
- Optimized for Zalando platform
- No people, hands, or styling props visible

TRANSFORM ONLY: lighting quality, background to pure white, centering, remove ALL shadows, optimize aspect ratio to 1:1.44
NEVER CHANGE: camera position, viewing angle, product orientation, zoom level`;

// Funktion um den richtigen Prompt basierend auf der Kategorie zu bekommen
export function getImagePromptForCategory(category: string): string {
  const imageType = categoryImageType[category] || 'clothing';
  switch (imageType) {
    case 'shoes':
      return SHOES_PROMPT;
    case 'accessories':
      return ACCESSORIES_PROMPT;
    default:
      return CLOTHING_PROMPT;
  }
}

// Bildspezifikationen pro Typ
export const imageSpecs = {
  shoes: {
    name: 'Schuhe',
    description: 'Mit leichtem Schatten, 60-65% Bildhöhe',
    aspectRatio: null, // Original beibehalten
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 90,
    format: 'webp' as const,
    hasShadow: true,
  },
  clothing: {
    name: 'Kleidung (Zalando)',
    description: 'Schattenlos, 1:1.44 Format, zentriert',
    aspectRatio: 1.44, // height/width = 1.44
    targetWidth: 1801,
    targetHeight: 2600,
    minWidth: 762,
    minHeight: 1100,
    quality: 90,
    format: 'jpg' as const,
    hasShadow: false,
  },
  accessories: {
    name: 'Accessoires',
    description: 'Quadratisch, leichter Schatten, Details sichtbar',
    aspectRatio: 1, // Quadratisch
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 90,
    format: 'webp' as const,
    hasShadow: true,
  },
};

export function getImageSpecsForCategory(category: string) {
  const imageType = categoryImageType[category] || 'clothing';
  return imageSpecs[imageType];
}
