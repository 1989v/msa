/**
 * 업로드 검사용 이미지 바이트 — 헤더만 규격대로 쓰고 픽셀은 채우지 않는다.
 * 검사 대상은 헤더이므로 풀 수 있는 이미지일 필요가 없다(풀리면 오히려 판정이 헤더인지 디코딩인지 가릴 수 없다).
 */

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const be16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];

/** PNG 서명 + IHDR(가로·세로) */
export function pngBytes(width: number, height: number, padTo = 0): Uint8Array<ArrayBuffer> {
  const head = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be32(13), 0x49, 0x48, 0x44, 0x52, ...be32(width), ...be32(height), 8, 6, 0, 0, 0,
    0, 0, 0, 0,
  ];
  return pad(head, padTo);
}

/** JPEG SOI + APP0 + SOF0(세로·가로) + SOS */
export function jpegBytes(width: number, height: number, padTo = 0): Uint8Array<ArrayBuffer> {
  const app0 = [0xff, 0xe0, ...be16(16), 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof0 = [0xff, 0xc0, ...be16(17), 8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return pad([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xda], padTo);
}

function pad(head: number[], padTo: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(Math.max(head.length, padTo)));
  out.set(head);
  return out;
}

export function imageFile(bytes: Uint8Array<ArrayBuffer>, name: string, type = ''): File {
  return new File([bytes], name, { type });
}
