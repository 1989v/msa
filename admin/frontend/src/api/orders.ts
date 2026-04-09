import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export interface Order {
  id: number;
  memberId: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
}

export async function fetchOrders(page = 0, size = 20, status?: string): Promise<PageResponse<Order>> {
  try {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.set('status', status);
    const res = await apiClient.get<ApiResponse<PageResponse<Order>>>(`/api/v1/orders?${params}`);
    return res.data.data;
  } catch {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  }
}

export async function fetchOrder(id: number): Promise<OrderDetail | null> {
  try {
    const res = await apiClient.get<ApiResponse<OrderDetail>>(`/api/v1/orders/${id}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  await apiClient.patch(`/api/v1/orders/${id}/status`, { status });
}
