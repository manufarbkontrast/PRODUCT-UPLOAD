import { GoogleGenerativeAI } from '@google/generative-ai';
import { SHOE_VIEWS } from '@/config/shoe-views';

/** Lazy-initialized GenAI client (shared pattern with gemini-processor.ts). */
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY ist nicht gesetzt.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export interface ClassificationInput {
  readonly id: string;
  readonly imageUrl: string;
}

export interface ClassificationResult {
  readonly id: string;
  readonly viewKey: string;
  readonly label: string;
  readonly sortOrder: number;
}

const validViewKeys = new Set(SHOE_VIEWS.map((v) => v.key));

const CLASSIFY_PROMPT = `You are a shoe photography classifier for an e-commerce store.

FIRST: Count the number of shoes visible in each image. This is the most important step.

Classify each image into exactly ONE of these view types:

TWO SHOES (a pair):
- back_pair_angled: TWO shoes photographed from behind at a slight angle. You can see the back/heel area of both shoes. They are placed side by side.
- heel_pair: TWO shoes photographed STRAIGHT from behind (perfectly symmetric). Both heels clearly visible, perfectly aligned.

ONE SHOE only:
- side_outer: ONE shoe from the side (lateral/profile view). The full length of the shoe is visible horizontally.
- sole: The bottom/outsole of ONE shoe. You see the tread pattern and sole material.
- angled_front: ONE shoe at a 3/4 angle from the front. The toe area faces toward the camera at an angle.

CRITICAL RULES:
1. FIRST count shoes: 1 shoe or 2 shoes? This determines the category.
2. TWO shoes = ALWAYS "back_pair_angled" or "heel_pair" (never "angled_front")
3. ONE shoe from the side = "side_outer"
4. ONE shoe at an angle = "angled_front"
5. Sole/bottom view = "sole"
6. If uncertain, use "unknown"

Return ONLY a JSON array, no other text. Example:
[{"index": 0, "view": "side_outer"}, {"index": 1, "view": "back_pair_angled"}]`;

/**
 * Classifies shoe images by view type using Gemini vision.
 * Sends all images in a single multi-image request for efficiency.
 */
export async function classifyShoeImages(
  images: readonly ClassificationInput[]
): Promise<readonly ClassificationResult[]> {
  if (images.length === 0) return [];

  // Download all images and convert to base64
  const imageContents = await Promise.all(
    images.map(async (img) => {
      const response = await fetch(img.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image ${img.id}: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return {
        id: img.id,
        base64: buffer.toString('base64'),
        mimeType,
      };
    })
  );

  // Build multi-image request
  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

  for (let i = 0; i < imageContents.length; i++) {
    parts.push({
      inlineData: {
        mimeType: imageContents[i].mimeType,
        data: imageContents[i].base64,
      },
    });
    parts.push({ text: `Image ${i}` });
  }

  parts.push({ text: CLASSIFY_PROMPT });

  // Use a fast text+vision model (not the image editing model)
  const modelName = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-2.0-flash';
  console.log(`[Classifier] Classifying ${images.length} images with ${modelName}`);

  const model = getGenAI().getGenerativeModel({ model: modelName });
  const result = await model.generateContent(parts);

  const responseText = result.response.text();
  console.log(`[Classifier] Raw response: ${responseText}`);

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Gemini returned no valid JSON array for classification');
  }

  const parsed: Array<{ index: number; view: string }> = JSON.parse(jsonMatch[0]);

  // Map results back to image IDs with sort orders
  const viewKeyToSortOrder = new Map(SHOE_VIEWS.map((v) => [v.key, v.sortOrder]));
  const viewKeyToLabel = new Map(SHOE_VIEWS.map((v) => [v.key, v.label]));
  const usedSortOrders = new Set<number>();

  const results: ClassificationResult[] = [];

  for (const entry of parsed) {
    if (entry.index < 0 || entry.index >= images.length) continue;

    const viewKey = validViewKeys.has(entry.view) ? entry.view : 'unknown';
    const standardSortOrder = viewKeyToSortOrder.get(viewKey);

    // Assign sort order: standard position if available, otherwise append
    let sortOrder: number;
    if (standardSortOrder !== undefined && !usedSortOrders.has(standardSortOrder)) {
      sortOrder = standardSortOrder;
      usedSortOrders.add(sortOrder);
    } else {
      // Duplicate or unknown: find next available slot >= 5
      sortOrder = 5;
      while (usedSortOrders.has(sortOrder)) sortOrder++;
      usedSortOrders.add(sortOrder);
    }

    results.push({
      id: images[entry.index].id,
      viewKey,
      label: viewKeyToLabel.get(viewKey) || 'Unbekannt',
      sortOrder,
    });
  }

  // Handle any images that weren't in Gemini's response
  for (let i = 0; i < images.length; i++) {
    const alreadyClassified = results.some((r) => r.id === images[i].id);
    if (!alreadyClassified) {
      let sortOrder = 5;
      while (usedSortOrders.has(sortOrder)) sortOrder++;
      usedSortOrders.add(sortOrder);

      results.push({
        id: images[i].id,
        viewKey: 'unknown',
        label: 'Unbekannt',
        sortOrder,
      });
    }
  }

  return results;
}
