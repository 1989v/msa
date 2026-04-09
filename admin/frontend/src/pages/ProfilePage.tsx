import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchProfile, updateProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ProfilePage() {
  const [form, setForm] = useState<Profile>({
    name: '',
    title: '',
    tagline: '',
    linkedinUrl: '',
    githubUrl: '',
    email: '',
    openToWork: false,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });

  useEffect(() => {
    if (profile) {
      setForm(profile);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfile(form),
    onSuccess: () => {
      setMessage({ type: 'success', text: '프로필이 저장되었습니다.' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: () => {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const setField = (field: keyof Profile) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = field === 'openToWork'
      ? (e.target as HTMLInputElement).checked
      : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">프로필 관리</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">이름</label>
          <Input value={form.name} onChange={setField('name')} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">직함</label>
          <Input value={form.title} onChange={setField('title')} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">한 줄 소개</label>
          <textarea
            value={form.tagline}
            onChange={setField('tagline')}
            rows={2}
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">LinkedIn URL</label>
          <Input value={form.linkedinUrl} onChange={setField('linkedinUrl')} type="url" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">GitHub URL</label>
          <Input value={form.githubUrl} onChange={setField('githubUrl')} type="url" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">이메일</label>
          <Input value={form.email} onChange={setField('email')} type="email" required />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="openToWork"
            type="checkbox"
            checked={form.openToWork}
            onChange={setField('openToWork')}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
          />
          <label htmlFor="openToWork" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            구직 중 (Open to Work)
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </Button>
          {message && (
            <span
              className={
                message.type === 'success'
                  ? 'text-sm text-green-600 dark:text-green-400'
                  : 'text-sm text-red-600 dark:text-red-400'
              }
            >
              {message.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
