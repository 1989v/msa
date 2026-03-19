import type { ChartType } from '../App'
import { CandlestickChart, LineChart, AreaChart, Maximize2 } from 'lucide-react'

const CHART_TYPES: { value: ChartType; icon: typeof CandlestickChart; label: string }[] = [
  { value: 'candle', icon: CandlestickChart, label: '캔들' },
  { value: 'line', icon: LineChart, label: '라인' },
  { value: 'area', icon: AreaChart, label: '영역' },
]

interface Props {
  chartType: ChartType
  onChartTypeChange: (type: ChartType) => void
  onFullscreen: () => void
}

export function ChartToolbar({ chartType, onChartTypeChange, onFullscreen }: Props) {
  return (
    <div className="flex items-center gap-1">
      {/* Chart type buttons */}
      <div className="flex bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
        {CHART_TYPES.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => onChartTypeChange(value)}
            className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-all ${
              chartType === value
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Fullscreen button */}
      <button
        onClick={onFullscreen}
        className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
        title="전체화면"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
