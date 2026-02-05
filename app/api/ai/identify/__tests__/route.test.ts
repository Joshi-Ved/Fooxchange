/**
 * API Tests for Vision Endpoint
 */

import { POST } from '@/app/api/ai/identify/route';
import { NextRequest } from 'next/server';
import { identifyIngredientsFromImage } from '@/lib/services/vision-service';

// Mock the vision service
jest.mock('@/lib/services/vision-service');

describe('POST /api/ai/identify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 when no image is provided', async () => {
        const formData = new FormData();
        const request = new NextRequest('http://localhost:3000/api/ai/identify', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('No image provided');
    });

    it('should return 400 for invalid image type', async () => {
        const formData = new FormData();
        const file = new File(['fake content'], 'test.pdf', { type: 'application/pdf' });
        formData.append('image', file);

        const request = new NextRequest('http://localhost:3000/api/ai/identify', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Invalid image format');
    });

    it('should return 400 for images larger than 5MB', async () => {
        const formData = new FormData();
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
        const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' });
        formData.append('image', file);

        const request = new NextRequest('http://localhost:3000/api/ai/identify', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('too large');
    });

    it('should successfully identify ingredients from valid image', async () => {
        const mockResult = {
            ingredients: [
                { name: 'Tomato', quantity: '3', confidence: 0.95, unit: 'pieces' },
            ],
            processingTimeMs: 1250,
        };

        (identifyIngredientsFromImage as jest.Mock).mockResolvedValue(mockResult);

        const formData = new FormData();
        const buffer = Buffer.from('fake-image-data');
        const file = new File([buffer], 'test.jpg', { type: 'image/jpeg' });
        formData.append('image', file);

        const request = new NextRequest('http://localhost:3000/api/ai/identify', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.ingredients).toHaveLength(1);
        expect(data.ingredients[0].name).toBe('Tomato');
    });

    it('should return 500 when GEMINI_API_KEY is not configured', async () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const formData = new FormData();
        const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
        formData.append('image', file);

        const request = new NextRequest('http://localhost:3000/api/ai/identify', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toContain('not configured');

        // Restore
        process.env.GEMINI_API_KEY = originalKey;
    });
});
