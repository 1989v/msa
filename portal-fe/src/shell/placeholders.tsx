/**
 * 통합 셸 sub-app 슬롯 플레이스홀더 (ADR-0058 R3 FE 통합 P1).
 *
 * P2 에서 admin/quant/gifticon/agent-viewer 의 실제 앱 라우터를 lazy import 로 이 자리에 꽂는다.
 * 지금은 슬롯이 정상 배선됐음을 보여주는 자리표시자.
 */
function Placeholder({ name }: { name: string }) {
  return (
    <div style={{ padding: 32, color: 'var(--ko-text-secondary)' }}>
      <h2 style={{ color: 'var(--ko-text-primary)', marginBottom: 8 }}>{name}</h2>
      <p>이 앱은 FE 통합 P2 에서 이 셸로 흡수됩니다. (coming in P2)</p>
    </div>
  );
}

export const AdminApp = () => <Placeholder name="Admin" />;
export const QuantApp = () => <Placeholder name="Quant" />;
export const GifticonApp = () => <Placeholder name="Gifticon" />;
export const AgentViewerApp = () => <Placeholder name="Agent Viewer" />;
