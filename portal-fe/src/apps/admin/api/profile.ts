import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

export interface Profile {
  name: string;
  title: string;
  tagline: string;
  linkedinUrl: string;
  githubUrl: string;
  email: string;
  openToWork: boolean;
}

const DEFAULT_PROFILE: Profile = {
  name: 'Gideok Kwon',
  title: 'Backend Engineer',
  tagline: 'MSA + Clean Architecture 기반 커머스 플랫폼을 설계하고 구현합니다',
  linkedinUrl: 'https://www.linkedin.com/in/gideok-kwon-57531b2a9/',
  githubUrl: 'https://github.com/1989v/msa',
  email: '1989v@naver.com',
  openToWork: true,
};

export async function fetchProfile(): Promise<Profile> {
  try {
    const res = await apiClient.get<ApiResponse<Profile>>('/api/v1/profile');
    return res.data.data;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function updateProfile(data: Profile): Promise<void> {
  await apiClient.put('/api/v1/profile', data);
}
