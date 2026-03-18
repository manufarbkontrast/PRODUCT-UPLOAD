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

// Schuh-Profil: Mit leichtem Schatten, Spitze immer nach links
export const SHOES_PROMPT = `Professional e-commerce product photography with these EXACT specifications:

CONSISTENT FRAMING - HIGHEST PRIORITY:
- The product MUST occupy exactly 60-65% of the total image HEIGHT
- If the product is too small in the original photo, ENLARGE it to fill 60-65% of image height
- If the product is too large, REDUCE it to fill 60-65% of image height
- This consistent sizing is critical so all products look identical in the online shop
- Camera ANGLE must stay the same (do not change the viewing perspective)
- Product proportions must remain accurate (no stretching or distortion)
- Front and back views: keep original orientation

SHOE ORIENTATION - CRITICAL:
- The shoe toe MUST ALWAYS point to the LEFT side of the image
- The heel MUST ALWAYS point to the RIGHT side of the image
- If the original shoe points to the right, MIRROR/FLIP the shoe horizontally so the toe faces left
- If the original shoe already points to the left, keep it as-is
- This applies to ALL side-view shoe images without exception
- For a pair of shoes: both toes pointing left
- Front view and back view: keep original orientation (no flipping needed)
- This is the #1 most important rule for shoe photography

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

MAINTAIN:
- Camera angle (viewing perspective) MUST stay identical
- Product proportions remain accurate (no stretching)
- Horizontal flip ONLY allowed to ensure toe points left
ALLOWED TO CHANGE:
- Product size in frame (zoom in/out to achieve 60-65% height)
- Background (replace with pure white)
- Lighting (improve to studio quality)

OUTPUT STYLE:
- Clean, minimal aesthetic
- Focus on product details and materials
- Professional e-commerce standard
- Optimized for website product pages
- No people, hands, or styling props visible

TRANSFORM: lighting, background to pure white, centering, add subtle shadow, horizontal flip if toe points right, resize product to fill 60-65% of image height
NEVER CHANGE: camera angle, product proportions`;

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

// ─── Ansichtsspezifische Schuh-Prompts ─────────────────────────────────────────

const SHOE_BASE = `Professional e-commerce product photography with these specifications:

CONSISTENT FRAMING - HIGHEST PRIORITY:
- The product MUST occupy exactly 60-65% of the total image HEIGHT
- If the product is too small in the original photo, ENLARGE it to fill 60-65% of image height
- If the product is too large, REDUCE it to fill 60-65% of image height
- This consistent sizing is critical so all products look identical in the online shop
- Every shoe product on the website must have the same visual weight and proportion
- Camera ANGLE must stay the same (do not change the viewing perspective)
- Product proportions must remain accurate (no stretching or distortion)

LIGHTING SETUP:
- Soft, diffused studio lighting from top-left at 45-degree angle
- Creates gentle, natural shadow falling to bottom-right
- Shadow opacity approximately 15-20%, very soft edges
- Even, consistent lighting across entire product
- Color temperature: neutral daylight (5500K)

BACKGROUND & COMPOSITION:
- Pure white background (#FFFFFF), completely clean
- Product perfectly centered horizontally and vertically
- Equal white space margins on all sides (15-20%)
- The shoe should be positioned in the vertical center of the image

PRODUCT POSITIONING:
- Product sits naturally on invisible surface
- Realistic contact shadow directly beneath product

TECHNICAL REQUIREMENTS:
- Ultra-high resolution, sharp focus throughout
- Clean edges, no background artifacts
- Professional color accuracy
- No people, hands, or styling props visible

MAINTAIN:
- Camera angle (viewing perspective) MUST stay identical
- Product proportions remain accurate (no stretching)
- Product details and textures preserved
ALLOWED TO CHANGE:
- Product size in frame (zoom in/out to achieve 60-65% height)
- Background (replace with pure white)
- Lighting (improve to studio quality)`;

const SHOE_VIEW_PROMPTS: Record<string, string> = {
  side_outer: `${SHOE_BASE}

VIEW-SPECIFIC RULES FOR SIDE VIEW:
- This is a SINGLE shoe photographed from the side (profile/lateral view)
- The shoe toe MUST point to the LEFT side of the image
- The heel MUST point to the RIGHT side of the image
- If the toe points to the RIGHT, MIRROR/FLIP the entire image horizontally
- If the toe already points LEFT, keep orientation as-is
- This horizontal flip rule is the #1 most important rule
- The shoe should show its full profile from toe to heel

TRANSFORM: background to white, lighting, centering, add subtle shadow, horizontal flip if toe points right, resize product to fill 60-65% of image height
NEVER CHANGE: camera angle, product proportions`,

  back_pair_angled: `${SHOE_BASE}

VIEW-SPECIFIC RULES FOR BACK PAIR ANGLED VIEW:
- This is a PAIR of shoes (TWO shoes) photographed from behind at a slight angle
- Both shoes must be fully visible and clearly separated
- The shoe toes MUST point to the LEFT side of the image
- If the toes point to the RIGHT, MIRROR/FLIP the entire image horizontally
- If the toes already point LEFT, keep orientation as-is
- Both shoes should be evenly lit and equally sharp
- The angle should show the back/heel area of both shoes
- Maintain the natural spacing between the two shoes

TRANSFORM: background to white, lighting, centering, add subtle shadow, horizontal flip if toes point right, resize product to fill 60-65% of image height
NEVER CHANGE: shoe arrangement, camera angle, product proportions`,

  heel_pair: `${SHOE_BASE}

VIEW-SPECIFIC RULES FOR HEEL PAIR VIEW:
- This is a PAIR of shoes (TWO shoes) photographed STRAIGHT from behind
- Both heels must be clearly visible and perfectly aligned
- The view should be symmetric - both shoes at equal distance from center
- Do NOT flip or mirror this image
- Both shoes should be evenly lit
- The heel counter, pull tabs, and back details should be clearly visible

TRANSFORM: background to white, lighting, centering, add subtle shadow, resize product to fill 60-65% of image height
NEVER CHANGE: shoe arrangement, symmetry, orientation, camera angle, product proportions`,

  sole: `${SHOE_BASE}

VIEW-SPECIFIC RULES FOR SOLE VIEW:
- This shows the BOTTOM/OUTSOLE of the shoe
- The tread pattern and sole material must be clearly visible
- The toe end of the sole should point UPWARD in the image
- The heel end should be at the BOTTOM of the image
- If the orientation is wrong, rotate so toe points up
- Do NOT flip horizontally
- Maximize the sole visibility in the frame

TRANSFORM: background to white, lighting, centering, rotation if needed for toe-up orientation, resize product to fill 60-65% of image height
NEVER CHANGE: camera angle, product proportions`,

  angled_front: `${SHOE_BASE}

VIEW-SPECIFIC RULES FOR ANGLED FRONT VIEW:
- This is a SINGLE shoe at a 3/4 angle from the front
- The toe area faces toward the camera at an angle
- The shoe toe should generally point toward the LEFT side of the image
- If the toe clearly points to the right, MIRROR/FLIP horizontally
- The 3/4 angle should show both the front and one side of the shoe
- Materials, textures and front details should be clearly visible

TRANSFORM: background to white, lighting, centering, add subtle shadow, horizontal flip if toe points right, resize product to fill 60-65% of image height
NEVER CHANGE: camera angle, product proportions`,
};

/**
 * Returns a view-specific prompt for shoe images based on the classified view type.
 * Falls back to the generic SHOES_PROMPT for unknown view types.
 */
export function getShoeViewPrompt(viewKey: string): string {
  return SHOE_VIEW_PROMPTS[viewKey] || SHOES_PROMPT;
}

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
