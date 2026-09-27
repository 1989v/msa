import type { UploadRules } from '../../api/adsConsoleApi';

/**
 * 소재 이미지를 **풀지 않고** 올리기 전에 거른다 — 서버 `CreativeImageRules` 와 같은 헤더 규칙.
 *
 * 형식은 파일 앞 바이트로 본다(MIME·확장자는 믿지 않는다 — 끌어다 놓은 파일은 MIME 이 비어 오기도 한다).
 * 가로·세로는 PNG IHDR · JPEG SOF 에서 읽는다. 브라우저로 이미지를 풀어 크기를 재면 300KB 안에 담긴
 * 20000×20000 PNG 가 수백 MB 로 풀려 탭이 멈춘다. 미리보기(디코딩)는 모든 검사를 통과한 뒤에만 한다.
 * 한도 값은 카탈로그의 업로드 규칙에서 받는다. 최종 판정은 서버다.
 */

export type ImageKind = 'PNG' | 'JPEG';

/** 앞 바이트로 읽은 종류 ↔ 카탈로그 업로드 규칙의 MIME */
const KIND_MIME: Record<ImageKind, string> = { PNG: 'image/png', JPEG: 'image/jpeg' };

/** 규칙의 MIME 목록을 사람이 읽는 이름으로 — `image/png` → `PNG` */
export function fileTypeLabels(fileTypes: string[]): string {
  return fileTypes.map((type) => type.replace(/^image\//, '').toUpperCase()).join(' · ');
}

export interface ImageHeader {
  kind: ImageKind;
  width: number;
  height: number;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

// SOF0~SOF15 중 DHT(C4)·JPG(C8)·DAC(CC) 는 프레임 마커가 아니다
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);

export function sniffKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, PNG_MAGIC)) return 'PNG';
  if (startsWith(bytes, JPEG_MAGIC)) return 'JPEG';
  return null;
}

const uint16 = (b: Uint8Array, at: number) => (at + 1 < b.length ? (b[at] << 8) | b[at + 1] : -1);
const uint32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

/** PNG 는 서명 다음이 반드시 IHDR 청크이고, 그 앞 8바이트가 가로·세로(빅엔디언)다 */
function readPng(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (type !== 'IHDR') return null;
  return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
}

/** JPEG 는 세그먼트를 따라가 스캔(SOS) 전의 첫 SOF 마커에서 가로·세로를 읽는다 */
function readJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // 채움 바이트
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // 길이 없는 마커
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null;
    const length = uint16(bytes, i + 2);
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      const height = uint16(bytes, i + 5);
      const width = uint16(bytes, i + 7);
      return height < 0 || width < 0 ? null : { width, height };
    }
    i += 2 + length;
  }
  return null;
}

/** 형식과 헤더의 가로·세로. 형식을 모르거나 헤더를 읽을 수 없으면 null */
export function readImageHeader(bytes: Uint8Array): ImageHeader | null {
  const kind = sniffKind(bytes);
  if (!kind) return null;
  const size = kind === 'PNG' ? readPng(bytes) : readJpeg(bytes);
  if (!size || size.width <= 0 || size.height <= 0) return null;
  return { kind, ...size };
}

/** `6.4:1` 표기를 비율 수로 */
function ratioValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return w / h;
}

/** 서버 `AspectRatio.fits` 와 같은 식 — 상대 오차가 허용 오차 이하 */
export function fitsRatio(width: number, height: number, ratio: string, tolerance: number): boolean {
  return width > 0 && height > 0 && Math.abs(width / height / ratioValue(ratio) - 1) <= tolerance;
}

export type UploadCheckKey = 'format' | 'bytes' | 'dimension' | 'ratio';

export interface UploadCheck {
  key: UploadCheckKey;
  /** 허용 값을 담은 항목 이름 */
  label: string;
  /** 이 파일의 실제 값 */
  actual: string;
  ok: boolean;
}

export interface UploadInspection {
  checks: UploadCheck[];
  ok: boolean;
}

const kb = (bytes: number) => `${Math.ceil(bytes / 1024).toLocaleString('ko-KR')}KB`;

/**
 * 파일 하나를 검사한다 — ① 앞 바이트 형식 ② 용량 ③ 헤더의 가로·세로 ④ 비율.
 * 형식을 읽지 못하면 ③④ 는 판정할 수 없어 실패로 둔다. 다른 항목은 하나가 실패해도 모두 판정해 함께 보여 준다.
 *
 * @param ratioGroups 타기팅한 지면마다 그 형태 규격의 허용 비율 — 모든 지면에서 하나 이상 맞아야 한다
 */
export async function inspectUpload(file: Blob, rules: UploadRules, ratioGroups: string[][]): Promise<UploadInspection> {
  // 헤더는 파일 앞부분에 있다. 한도 안의 파일은 통째로, 넘는 파일은 한도만큼만 읽는다
  const bytes = await readBytes(file.slice(0, Math.min(file.size, rules.maxBytes)));
  const header = readImageHeader(bytes);
  const kind = header?.kind ?? sniffKind(bytes);
  const dims = header ? `${header.width}×${header.height}` : '읽지 못함';
  const ratios = [...new Set(ratioGroups.flat())];

  const checks: UploadCheck[] = [
    {
      key: 'format',
      label: `형식 — ${fileTypeLabels(rules.fileTypes)}`,
      actual: kind ?? '알 수 없음',
      ok: kind !== null && rules.fileTypes.includes(KIND_MIME[kind]),
    },
    { key: 'bytes', label: `용량 — ${kb(rules.maxBytes)} 이하`, actual: kb(file.size), ok: file.size <= rules.maxBytes },
    {
      key: 'dimension',
      label: `가로·세로 — 각 ${rules.maxDimension.toLocaleString('ko-KR')}px 이하`,
      actual: dims,
      ok: header !== null && header.width <= rules.maxDimension && header.height <= rules.maxDimension,
    },
    {
      key: 'ratio',
      label: `비율 — ${ratios.length > 0 ? ratios.join(' 또는 ') : '지면 규격'}`,
      actual: header ? `${dims} (${(header.width / header.height).toFixed(2)}:1)` : '읽지 못함',
      ok:
        header !== null &&
        ratioGroups.every((group) => group.some((r) => fitsRatio(header.width, header.height, r, rules.aspectTolerance))),
    },
  ];
  return { checks, ok: checks.every((c) => c.ok) };
}

/** `Blob.arrayBuffer` 가 없는 환경도 있어 FileReader 로 읽는다 */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
