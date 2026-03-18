import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { getImagePromptForCategory, categoryImageType } from '@/config/image-processing';
import { validateImageUrl } from '@/lib/validation/url';
import { mimeToExtension } from '@/lib/mime';

/** Lazy-initialized GenAI client (avoids reading env at module load). */
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY ist nicht gesetzt. Bitte in .env eintragen.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export interface GeminiProcessResult {
  readonly imageBuffer: Buffer;
  readonly mimeType: string;
  readonly format: string;
}

/**
 * Process a product image using Gemini Flash model.
 * Downloads the original, sends it to Gemini with the category-specific prompt,
 * and returns the processed image buffer.
 *
 * @param promptOverride - Optional custom prompt (e.g. view-specific shoe prompt).
 *                         If provided, overrides the category-based prompt.
 */
export async function processImageWithGemini(
  imageUrl: string,
  category: string,
  promptOverride?: string
): Promise<GeminiProcessResult> {
  const prompt = promptOverride || getImagePromptForCategory(category);

  // 1. Validate and download the original image
  validateImageUrl(imageUrl);
  console.log(`[Gemini] Downloading image: ${imageUrl}`);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBuffer = Buffer.from(imageArrayBuffer);
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

  // Convert to base64 for Gemini API
  const base64Image = imageBuffer.toString('base64');

  console.log(`[Gemini] Processing with category: ${category}`);
  console.log(`[Gemini] Image size: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

  // 2. Call Gemini Flash with image editing
  // Verfügbare Modelle für Bildgenerierung: gemini-2.5-flash-image, gemini-3-pro-image-preview
  const modelName = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  console.log(`[Gemini] Using model: ${modelName}`);

  const model = getGenAI().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    } as Record<string, unknown>,
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: contentType,
        data: base64Image,
      },
    },
    {
      text: `${prompt}\n\nEdit this product image according to the specifications above. Return ONLY the edited image.`,
    },
  ]);

  const response = result.response;
  const candidates = response.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini returned no candidates');
  }

  // 3. Extract the generated image from response
  const parts = candidates[0].content.parts;
  let processedImageData: string | null = null;
  let processedMimeType = 'image/png';

  for (const part of parts) {
    if (part.inlineData) {
      processedImageData = part.inlineData.data;
      processedMimeType = part.inlineData.mimeType || 'image/png';
      break;
    }
  }

  if (!processedImageData) {
    // Log any text response for debugging
    for (const part of parts) {
      if (part.text) {
        console.log('[Gemini] Text response:', part.text);
      }
    }
    throw new Error('Gemini returned no image data. The model may not have been able to process this image.');
  }

  // 4. Post-process with Sharp for consistent framing
  const geminiBuffer = Buffer.from(processedImageData, 'base64');
  console.log(`[Gemini] Raw output: ${(geminiBuffer.length / 1024).toFixed(0)} KB, ${processedMimeType}`);

  const imageType = categoryImageType[category] || 'clothing';
  const finalBuffer = imageType === 'shoes'
    ? await normalizeShoeFraming(geminiBuffer)
    : geminiBuffer;

  const format = mimeToExtension(processedMimeType);

  console.log(`[Gemini] Final image: ${(finalBuffer.length / 1024).toFixed(0)} KB, ${processedMimeType}`);

  return {
    imageBuffer: finalBuffer,
    mimeType: processedMimeType,
    format,
  };
}

/**
 * Post-process shoe images for consistent framing:
 * 1. Flatten to RGB and trim white background to find product bounding box
 * 2. Add uniform padding (product fills ~62.5% of height)
 * 3. Center product on white canvas
 */
async function normalizeShoeFraming(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  // Flatten to RGB (remove alpha) then trim white background
  const flattened = await sharp(imageBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  const trimmedResult = await sharp(flattened)
    .trim({ threshold: 50 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const productWidth = trimmedResult.info.width;
  const productHeight = trimmedResult.info.height;

  console.log(`[Sharp] Product: ${productWidth}x${productHeight} (from ${metadata.width}x${metadata.height})`);

  // Target: product should fill ~62.5% of final image height
  const targetProductRatio = 0.625;
  const finalHeight = Math.round(productHeight / targetProductRatio);
  const finalWidth = Math.max(
    Math.round(finalHeight * 0.75), // minimum 3:4 aspect ratio
    Math.round(productWidth / 0.7)  // product fills max 70% width
  );

  // Center product on white canvas
  const padTop = Math.round((finalHeight - productHeight) / 2);
  const padBottom = finalHeight - productHeight - padTop;
  const padLeft = Math.round((finalWidth - productWidth) / 2);
  const padRight = finalWidth - productWidth - padLeft;

  console.log(`[Sharp] Final: ${finalWidth}x${finalHeight}, product fills ${((productHeight / finalHeight) * 100).toFixed(1)}% height`);

  const result = await sharp(trimmedResult.data)
    .extend({
      top: Math.max(0, padTop),
      bottom: Math.max(0, padBottom),
      left: Math.max(0, padLeft),
      right: Math.max(0, padRight),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  return result;
}
