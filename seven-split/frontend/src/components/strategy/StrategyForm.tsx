import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldError, HelpText, Label } from '@/components/ui/Label'
import type { CreateStrategyRequest } from '@/types/api'
import { useEffect, useState } from 'react'

const SYMBOLS = ['BTC_KRW', 'ETH_KRW'] as const

// zod schema — 백엔드 INV-07 미러
const schema = z.object({
  targetSymbol: z.enum(SYMBOLS),
  roundCount: z
    .number({ invalid_type_error: '회차 수를 입력하세요' })
    .int('정수만 가능')
    .min(1, '최소 1회차')
    .max(50, '최대 50회차'),
  entryGapPercent: z
    .number({ invalid_type_error: '간격 %를 입력하세요' })
    .lt(0, '음수여야 합니다 (예: -3.0)')
    .gte(-50, '-50% 이상으로 설정하세요'),
  initialOrderAmount: z
    .number({ invalid_type_error: '회차당 매수 금액을 입력하세요' })
    .positive('0보다 커야 합니다'),
  // takeProfitPerRound — 동적 길이
  takeProfit: z
    .array(
      z.object({
        value: z
          .number({ invalid_type_error: '익절 %를 입력하세요' })
          .positive('양수여야 합니다 (원칙 7: 손절 없음)')
          .max(100, '100% 이하로 설정하세요'),
      }),
    )
    .min(1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultRoundCount?: number
  defaultUnifiedTakeProfit?: number
  onSubmit: (req: CreateStrategyRequest) => void | Promise<void>
  submitting?: boolean
}

export function StrategyForm({
  defaultRoundCount = 7,
  defaultUnifiedTakeProfit = 5,
  onSubmit,
  submitting = false,
}: Props) {
  const [unified, setUnified] = useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetSymbol: 'BTC_KRW',
      roundCount: defaultRoundCount,
      entryGapPercent: -3,
      initialOrderAmount: 100_000,
      takeProfit: Array.from({ length: defaultRoundCount }, () => ({
        value: defaultUnifiedTakeProfit,
      })),
    },
  })

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'takeProfit',
  })

  const watchedRoundCount = form.watch('roundCount')

  // roundCount 변경 시 takeProfit 배열 길이 동기화
  useEffect(() => {
    const target = Math.max(1, Math.min(50, Math.floor(watchedRoundCount || 0)))
    if (Number.isNaN(target)) return
    if (target === fields.length) return
    const current = form.getValues('takeProfit')
    const unifiedValue = current[0]?.value ?? defaultUnifiedTakeProfit
    if (unified) {
      replace(Array.from({ length: target }, () => ({ value: unifiedValue })))
    } else if (target > fields.length) {
      replace([
        ...current,
        ...Array.from({ length: target - current.length }, () => ({
          value: unifiedValue,
        })),
      ])
    } else {
      replace(current.slice(0, target))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedRoundCount, unified])

  function handleUnifiedToggle(next: boolean) {
    setUnified(next)
    if (next) {
      const first = form.getValues('takeProfit')[0]?.value ?? defaultUnifiedTakeProfit
      replace(Array.from({ length: fields.length }, () => ({ value: first })))
    }
  }

  function handleUnifiedChange(value: number) {
    if (!unified) return
    replace(Array.from({ length: fields.length }, () => ({ value })))
  }

  async function handleSubmit(values: FormValues) {
    const req: CreateStrategyRequest = {
      executionMode: 'BACKTEST',
      config: {
        targetSymbol: values.targetSymbol,
        roundCount: values.roundCount,
        entryGapPercent: values.entryGapPercent.toString(),
        initialOrderAmount: values.initialOrderAmount.toString(),
        takeProfitPercentPerRound: values.takeProfit.map((t) => t.value.toString()),
      },
    }
    await onSubmit(req)
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="space-y-6"
      noValidate
    >
      <div>
        <Label htmlFor="symbol" required>
          거래쌍
        </Label>
        <Select id="symbol" {...form.register('targetSymbol')}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', '/')}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="roundCount" required>
          회차 수
        </Label>
        <Input
          id="roundCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          step={1}
          invalid={!!form.formState.errors.roundCount}
          {...form.register('roundCount', { valueAsNumber: true })}
        />
        <FieldError message={form.formState.errors.roundCount?.message} />
        <HelpText>1 ~ 50 회차</HelpText>
      </div>

      <div>
        <Label htmlFor="entryGap" required>
          매수 간격 % (음수)
        </Label>
        <Input
          id="entryGap"
          type="number"
          inputMode="decimal"
          step={0.1}
          invalid={!!form.formState.errors.entryGapPercent}
          {...form.register('entryGapPercent', { valueAsNumber: true })}
        />
        <FieldError message={form.formState.errors.entryGapPercent?.message} />
        <HelpText>박성현 7원칙: 직전 회차 대비 -3% (예: -3.0)</HelpText>
      </div>

      <div>
        <Label htmlFor="amount" required>
          회차당 매수 금액 (KRW)
        </Label>
        <Input
          id="amount"
          type="number"
          inputMode="numeric"
          min={0}
          step={10_000}
          invalid={!!form.formState.errors.initialOrderAmount}
          {...form.register('initialOrderAmount', { valueAsNumber: true })}
        />
        <FieldError message={form.formState.errors.initialOrderAmount?.message} />
        <HelpText>모든 회차에 동일 금액 (원칙 6)</HelpText>
      </div>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium text-ink-700">
            회차별 익절 %
          </legend>
          <label className="inline-flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={unified}
              onChange={(e) => handleUnifiedToggle(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            동일값 일괄 적용
          </label>
        </div>

        {unified ? (
          <div>
            <Input
              type="number"
              inputMode="decimal"
              step={0.1}
              defaultValue={defaultUnifiedTakeProfit}
              onChange={(e) => handleUnifiedChange(Number(e.target.value))}
              aria-label="모든 회차 익절 %"
              invalid={!!form.formState.errors.takeProfit}
            />
            <HelpText>
              {fields.length}개 회차 모두에 같은 % 적용 (예: 5.0 = +5%)
            </HelpText>
          </div>
        ) : (
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-sm text-ink-500 tabular-nums">
                  {index + 1}회차
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  aria-label={`${index + 1}회차 익절 %`}
                  invalid={!!form.formState.errors.takeProfit?.[index]?.value}
                  {...form.register(`takeProfit.${index}.value`, {
                    valueAsNumber: true,
                  })}
                />
              </li>
            ))}
          </ul>
        )}
        <FieldError
          message={
            typeof form.formState.errors.takeProfit?.message === 'string'
              ? form.formState.errors.takeProfit?.message
              : undefined
          }
        />
      </fieldset>

      <Button type="submit" size="lg" fullWidth disabled={submitting}>
        {submitting ? '저장 중...' : '전략 저장'}
      </Button>
    </form>
  )
}
