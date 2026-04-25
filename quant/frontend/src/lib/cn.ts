/**
 * 단순 className 결합 유틸 (clsx 미설치).
 * falsy 는 제외, 중복 공백 정리.
 */
export function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
