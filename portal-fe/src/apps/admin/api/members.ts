import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export interface Member {
  id: number;
  email: string;
  name: string;
  ssoProvider: string;
  status: string;
  createdAt: string;
}

export interface MemberRole {
  memberId: number;
  role: string;
  assignedAt: string;
}

export async function fetchMembers(page = 0, size = 20): Promise<PageResponse<Member>> {
  try {
    const res = await apiClient.get<ApiResponse<PageResponse<Member>>>(`/api/members?page=${page}&size=${size}`);
    return res.data.data;
  } catch {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  }
}

export async function fetchMemberRoles(memberId: number): Promise<MemberRole[]> {
  try {
    const res = await apiClient.get<ApiResponse<MemberRole[]>>(`/api/auth/roles/${memberId}`);
    return res.data.data;
  } catch {
    return [];
  }
}

export async function assignRole(memberId: number, role: string): Promise<void> {
  await apiClient.post(`/api/auth/roles/${memberId}`, { role });
}

export async function removeRole(memberId: number, role: string): Promise<void> {
  await apiClient.delete(`/api/auth/roles/${memberId}/${role}`);
}
