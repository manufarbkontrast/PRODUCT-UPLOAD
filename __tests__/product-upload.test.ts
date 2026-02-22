import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all Google API dependencies before importing the module under test
vi.mock('@/lib/google/drive', () => ({
  createFolder: vi.fn(),
  uploadFile: vi.fn(),
  makeFilePublic: vi.fn(),
  listFiles: vi.fn(),
  getFile: vi.fn(),
}));

// Mock URL validation so test URLs are accepted
vi.mock('@/lib/validation/url', () => ({
  validateImageUrl: vi.fn(),
}));

import { uploadProductToDrive, type ProductUploadData } from '@/lib/google/product-upload';
import { createFolder, uploadFile, makeFilePublic } from '@/lib/google/drive';

const mockCreateFolder = vi.mocked(createFolder);
const mockUploadFile = vi.mocked(uploadFile);
const mockMakeFilePublic = vi.mocked(makeFilePublic);

function makeProduct(overrides?: Partial<ProductUploadData>): ProductUploadData {
  return {
    id: 'prod-1',
    ean: '1234567890123',
    name: 'Test Sneaker',
    gender: 'male',
    category: 'sneakers',
    description: 'A test product',
    sku: 'TST-001',
    images: [
      {
        id: 'img-1',
        originalPath: 'https://storage.example.com/original1.jpg',
        processedPath: 'https://storage.example.com/processed1.jpg',
        filename: 'photo1.jpg',
        sortOrder: 0,
      },
      {
        id: 'img-2',
        originalPath: 'https://storage.example.com/original2.jpg',
        processedPath: 'https://storage.example.com/processed2.jpg',
        filename: 'photo2.jpg',
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

// Helper to mock fetch for image downloads
function mockFetchForImages() {
  const mockBuffer = Buffer.from('fake-image-data');
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
    headers: new Headers({ 'content-type': 'image/jpeg' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mockCreateFolder.mockResolvedValue({
    id: 'folder-123',
    name: 'Test Sneaker',
    webViewLink: 'https://drive.google.com/drive/folders/folder-123',
    webContentLink: '',
  });

  mockUploadFile.mockResolvedValue({
    id: 'file-123',
    name: '1_TST-001.jpg',
    webViewLink: 'https://drive.google.com/file/d/file-123/view',
    webContentLink: '',
  });

  mockMakeFilePublic.mockResolvedValue();

  mockFetchForImages();
});

describe('uploadProductToDrive', () => {
  it('should upload all images successfully and return folder URL', async () => {
    const product = makeProduct();

    const result = await uploadProductToDrive(product);

    expect(result.folderId).toBe('folder-123');
    expect(result.folderUrl).toBe('https://drive.google.com/drive/folders/folder-123');
    expect(result.uploadedFiles).toHaveLength(2);

    // Verify folder creation
    expect(mockCreateFolder).toHaveBeenCalledOnce();
    expect(mockCreateFolder).toHaveBeenCalledWith('Test Sneaker');

    // Verify both images uploaded
    expect(mockUploadFile).toHaveBeenCalledTimes(2);

    // Verify files made public (folder + 2 images = 3)
    expect(mockMakeFilePublic).toHaveBeenCalledTimes(3);
  });

  it('should continue uploading remaining images when one fails', async () => {
    const product = makeProduct({
      images: [
        {
          id: 'img-1',
          originalPath: 'https://storage.example.com/original1.jpg',
          processedPath: 'https://storage.example.com/processed1.jpg',
          filename: 'photo1.jpg',
          sortOrder: 0,
        },
        {
          id: 'img-2',
          originalPath: 'https://storage.example.com/original2.jpg',
          processedPath: 'https://storage.example.com/processed2.jpg',
          filename: 'photo2.jpg',
          sortOrder: 1,
        },
        {
          id: 'img-3',
          originalPath: 'https://storage.example.com/original3.jpg',
          processedPath: 'https://storage.example.com/processed3.jpg',
          filename: 'photo3.jpg',
          sortOrder: 2,
        },
      ],
    });

    // First image succeeds, second fails, third succeeds
    mockUploadFile
      .mockResolvedValueOnce({
        id: 'file-1',
        name: '1_TST-001.jpg',
        webViewLink: 'https://drive.google.com/file/d/file-1/view',
        webContentLink: '',
      })
      .mockRejectedValueOnce(new Error('Google Drive API rate limit'))
      .mockResolvedValueOnce({
        id: 'file-3',
        name: '3_TST-001.jpg',
        webViewLink: 'https://drive.google.com/file/d/file-3/view',
        webContentLink: '',
      });

    // This should NOT throw - it should continue with remaining images
    const result = await uploadProductToDrive(product);

    // Should have uploaded 2 of 3 images (the ones that didn't fail)
    expect(result.uploadedFiles).toHaveLength(2);
    expect(result.folderId).toBe('folder-123');

    // All 3 upload attempts should have been made
    expect(mockUploadFile).toHaveBeenCalledTimes(3);
  });

  it('should not throw when image download fails', async () => {
    // Use images without processedPath so there's no fallback URL
    const product = makeProduct({
      images: [
        {
          id: 'img-1',
          originalPath: 'https://storage.example.com/original1.jpg',
          processedPath: null,
          filename: 'photo1.jpg',
          sortOrder: 0,
        },
        {
          id: 'img-2',
          originalPath: 'https://storage.example.com/original2.jpg',
          processedPath: null,
          filename: 'photo2.jpg',
          sortOrder: 1,
        },
      ],
    });

    const failResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };
    const successResponse = {
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('fake').buffer),
      headers: new Headers({ 'content-type': 'image/jpeg' }),
    };

    // First image: all 3 retry attempts fail (404)
    // Second image: succeeds on first attempt
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(failResponse)
      .mockResolvedValueOnce(successResponse);

    // Should not throw
    const result = await uploadProductToDrive(product);

    // Only 1 image should have been uploaded (the second one)
    expect(result.uploadedFiles).toHaveLength(1);
  });

  it('should use processedPath when available, originalPath as fallback', async () => {
    const product = makeProduct({
      images: [
        {
          id: 'img-1',
          originalPath: 'https://storage.example.com/original.jpg',
          processedPath: 'https://storage.example.com/processed.jpg',
          filename: 'photo1.jpg',
          sortOrder: 0,
        },
        {
          id: 'img-2',
          originalPath: 'https://storage.example.com/original2.jpg',
          processedPath: null,
          filename: 'photo2.jpg',
          sortOrder: 1,
        },
      ],
    });

    await uploadProductToDrive(product);

    // Check that fetch was called with processedPath for first and originalPath for second
    expect(global.fetch).toHaveBeenCalledWith('https://storage.example.com/processed.jpg');
    expect(global.fetch).toHaveBeenCalledWith('https://storage.example.com/original2.jpg');
  });

  it('should skip images with no URL at all', async () => {
    const product = makeProduct({
      images: [
        {
          id: 'img-1',
          originalPath: '',
          processedPath: null,
          filename: 'photo1.jpg',
          sortOrder: 0,
        },
        {
          id: 'img-2',
          originalPath: 'https://storage.example.com/original2.jpg',
          processedPath: null,
          filename: 'photo2.jpg',
          sortOrder: 1,
        },
      ],
    });

    const result = await uploadProductToDrive(product);

    // Only 1 image should have been downloaded/uploaded
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.uploadedFiles).toHaveLength(1);
  });

  it('should sort images by sortOrder before uploading', async () => {
    const product = makeProduct({
      images: [
        {
          id: 'img-b',
          originalPath: 'https://storage.example.com/b.jpg',
          processedPath: null,
          filename: 'second.jpg',
          sortOrder: 1,
        },
        {
          id: 'img-a',
          originalPath: 'https://storage.example.com/a.jpg',
          processedPath: null,
          filename: 'first.jpg',
          sortOrder: 0,
        },
      ],
    });

    await uploadProductToDrive(product);

    // First fetch should be for sortOrder 0 (a.jpg)
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls[0][0]).toBe('https://storage.example.com/a.jpg');
    expect(fetchCalls[1][0]).toBe('https://storage.example.com/b.jpg');
  });
});
