import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldError, HelpText, Label } from '@/components/ui/Label'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { submitBacktest } from '@/api/backtests'
import { toApiError, type ApiError } from '@/api/client'

const schema = z
  .object({
    from: z.string().min(1, '시작일을 입력하세요'),
    to: z.string().min(1, '종료일을 입력하세요'),
    /** 비워두면 빈 문자열, 있으면 정수 문자열 */
    seed: z
      .string()
      .optional()
      .refine((v) => !v || /^-?\d+$/.test(v), '정수만 가능합니다'),
  })
  .refine((d) => new Date(d.from).getTime() < new Date(d.to).getTime(), {
    message: '종료일은 시작일보다 뒤여야 합니다',
    path: ['to'],
  })

type FormValues = z.infer<typeof schema>

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

export function BacktestSubmitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<ApiError | null>(null)
  const range = defaultRange()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { from: range.from, to: range.to, seed: '' },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!id) throw new Error('strategyId missing')
      const seed =
        values.seed && values.seed.trim() !== '' ? Number(values.seed) : undefined
      return submitBacktest({
        strategyId: id,
        from: new Date(values.from).toISOString(),
        to: new Date(values.to).toISOString(),
        seed,
      })
    },
    onSuccess: (result) => {
      navigate(`/runs/${result.runId}`, { replace: true })
    },
    onError: (err) => setError(toApiError(err)),
  })

  if (!id) return null

  return (
    <>
      <PageHeader title="새 백테스트" subtitle="기간 + 시드" back={`/strategies/${id}`} />
      <div className="px-4 py-4 space-y-4">
        {error && <ErrorBanner error={error} onRetry={() => setError(null)} />}
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="space-y-6"
          noValidate
        >
          <div>
            <Label htmlFor="from" required>
              시작일
            </Label>
            <Input
              id="from"
              type="date"
              invalid={!!form.formState.errors.from}
              {...form.register('from')}
            />
            <FieldError message={form.formState.errors.from?.message} />
          </div>

          <div>
            <Label htmlFor="to" required>
              종료일
            </Label>
            <Input
              id="to"
              type="date"
              invalid={!!form.formState.errors.to}
              {...form.register('to')}
            />
            <FieldError message={form.formState.errors.to?.message} />
          </div>

          <div>
            <Label htmlFor="seed">시드 (옵션)</Label>
            <Input
              id="seed"
              type="text"
              inputMode="numeric"
              placeholder="비워두면 시스템 자동"
              invalid={!!form.formState.errors.seed}
              {...form.register('seed')}
            />
            <FieldError message={form.formState.errors.seed?.message} />
            <HelpText>결정론 재실행을 위해 같은 시드를 사용하세요.</HelpText>
          </div>

          <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? '실행 중...' : '백테스트 실행'}
          </Button>
        </form>
      </div>
    </>
  )
}
