import { useEffect, useState } from 'react';
import { fetchCreativeImage } from '@/api/ads';

/** 심사 전 소재 이미지는 공개 경로에 없다 — 어드민 미리보기 API 에서 Bearer 로 받아 blob 으로 그린다. */
export function AdminPreviewImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return undefined;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchCreativeImage(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src ? (
    <img src={src} alt={alt} className="aspect-[1.91/1] w-full rounded-md object-cover" />
  ) : (
    <div className="aspect-[1.91/1] w-full rounded-md bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />
  );
}
