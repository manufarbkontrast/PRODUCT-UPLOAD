import { GoogleGenerativeAI } from '@google/generative-ai';
import { getImagePromptForCategory } from '@/config/image-processing';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GeminiProcessResult {
  readonly imageBuffer: Buffer;
  readonly mimeType: string;
  readonly format: string;
}

/**
 * Process a product image using Gemini Flash model.
 * Downloads the original, sends it to Gemini with the category-specific prompt,
 * and returns the processed image buffer.
 */
export async function processImageWithGemini(
  imageUrl: string,
  category: string
): Promise<GeminiProcessResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ist nicht gesetzt. Bitte in .env eintragen.');
  }

  const prompt = getImagePromptForCategory(category);

  // 1. Download the original image
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

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      // @ts-expect-error - responseModalities ist unterstützt aber nicht in Types
      responseModalities: ['Text', 'Image'],
    },
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

  // 4. Return Gemini output directly (no Sharp post-processing)
  const processedBuffer = Buffer.from(processedImageData, 'base64');
  const format = mimeToFormat(processedMimeType);

  console.log(`[Gemini] Processed image: ${(processedBuffer.length / 1024).toFixed(0)} KB, ${processedMimeType}`);

  return {
    imageBuffer: processedBuffer,
    mimeType: processedMimeType,
    format,
  };
}

/**
 * Map MIME type to file extension
 */
function mimeToFormat(mimeType: string): string {
  const mapping: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mapping[mimeType] || 'png';
}
