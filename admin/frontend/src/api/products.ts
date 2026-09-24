import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  status: string;
  stockQuantity: number;
  description: string;
  createdAt: string;
}

export async function fetchProducts(page = 0, size = 20, search?: string): Promise<PageResponse<Product>> {
  try {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search) params.set('search', search);
    const res = await apiClient.get<ApiResponse<PageResponse<Product>>>(`/api/v1/products?${params}`);
    return res.data.data;
  } catch {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  }
}

export async function fetchProduct(id: number): Promise<Product | null> {
  try {
    const res = await apiClient.get<ApiResponse<Product>>(`/api/v1/products/${id}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
  await apiClient.post('/api/v1/products', data);
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<void> {
  await apiClient.put(`/api/v1/products/${id}`, data);
}

export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/products/${id}`);
}
