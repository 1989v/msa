import axios from 'axios';
import type { StewardStatus, EditorStore, StoreInput } from '../../api/marketStewardApi';
export const stewardScreen = (status: StewardStatus | null) => status === 'ACTIVE' ? 'manage' : status === 'PENDING' ? 'pending' : status === 'SUSPENDED' ? 'suspended' : 'apply';
export function applicationErrors(org: string, contact: string) {
  return { orgName: !org.trim() ? '단체명을 입력하세요.' : org.trim().length > 300 ? '단체명은 300자 이내로 입력하세요.' : '', contact: !contact.trim() ? '연락처를 입력하세요.' : contact.trim().length > 500 ? '연락처는 500자 이내로 입력하세요.' : '' };
}
export function stewardError(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 403) return '이 시장 관리 권한이 없습니다.';
  if (status === 401) return '로그인이 필요합니다. 다시 로그인해 주세요.';
  if (status === 409) return '신청 또는 정보가 변경되었습니다. 새로 불러온 뒤 다시 시도하세요.';
  return '불러오거나 저장하지 못했습니다. 입력과 연결을 확인하고 다시 시도하세요.';
}
export function storeInput(row?: EditorStore | null): StoreInput { return { name: row?.source.name ?? '', items: row?.source.items ?? null, zoneId: row?.source.zoneId ?? null, membership: row?.source.membership.status ?? 'IN', pinKind: row?.source.pinKind ?? 'REFERENCE', latitude: row?.source.latitude ?? null, longitude: row?.source.longitude ?? null, referenceStoreId: row?.source.referenceStoreId ?? null, relativePosition: row?.source.relativePosition ?? '옆', positionNote: row?.source.positionNote ?? null }; }
export const referenceStores = (rows: EditorStore[], editedId?: number) => rows.filter(row => row.source.id !== editedId && row.display.pinKind === 'EXACT' && row.display.membership.status === 'IN' && row.display.coordinate != null);
export function validManual(form: StoreInput) { return !!form.name.trim() && form.name.trim().length <= 300 && (form.pinKind === 'EXACT' ? form.latitude != null && form.longitude != null : form.referenceStoreId != null && !!form.relativePosition?.trim() && !!form.positionNote?.trim()); }
export const managePath = (id: number, lang: 'ko' | 'en') => `${lang === 'en' ? '/en' : ''}/markets/${id}/manage`;
