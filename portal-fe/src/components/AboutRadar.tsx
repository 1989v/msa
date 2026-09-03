import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface RadarDatum {
  subject: string;
  value: number;
}

/**
 * Tech Radar — 카테고리별 코드 참조 분포. AboutSection 이 lazy 로 끌어온다:
 * recharts 가 메인 번들에 실리면 홈(런처)처럼 레이더를 그리지 않는 화면도 그 값을 치른다.
 */
export default function AboutRadar({ data }: { data: RadarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(108,99,255,0.2)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
        />
        <Radar
          name="Count"
          dataKey="value"
          stroke="#6c63ff"
          fill="#6c63ff"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(13,13,26,0.95)',
            border: '1px solid rgba(108,99,255,0.3)',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: '0.8125rem',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
