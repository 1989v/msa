using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 걸어 다니는 몸 하나의 판정. **유니티 물리를 쓰지 않는다** — 엔진 코드 스트리핑이
    /// Physics 모듈을 빼기 때문에 WebGL 빌드에서는 `CapsuleCollider` 조차 없을 수 있다.
    ///
    /// 규칙은 하나다: **바닥이 발보다 <see cref="StepUp"/> 넘게 솟아 있으면 못 들어간다.**
    /// 벽·계단·장애물이 전부 이 하나에서 나온다. 발 높이가 기준이라 뛰어오르면 낮은 턱은
    /// 넘어가고, 높은 턱은 뛰어도 못 넘는다 — 그 경계를 StepUp 과 점프 높이가 정한다.
    ///
    /// 실제로 이 규칙 없이 만들었다가 벽을 뚫고 걸어 다녔고, 점프하면 계단 꼭대기로
    /// 순간이동했다 (아홉 종, 2026-09-01).
    /// </summary>
    public readonly struct KgdBody
    {
        /// <summary>몸통 반지름. 가운데 한 점만 보면 모델이 절벽에 박힌다.</summary>
        public readonly float Radius;

        /// <summary>걸어 올라갈 수 있는 턱.</summary>
        public readonly float StepUp;

        /// <summary>
        /// 내리막에서 바닥에 붙는 한계. **없으면 비탈을 내려갈 때 매 프레임 공중 상태가 된다** —
        /// 그러면 달리기 애니메이션이 끊기고 지면 보정도 안 걸린다.
        /// 가장 가파른 비탈의 한 프레임 낙차보다 크고, 떨어져야 할 절벽보다는 작아야 한다.
        /// </summary>
        public readonly float StepDown;

        public KgdBody(float radius, float stepUp, float stepDown)
        { Radius = radius; StepUp = stepUp; StepDown = stepDown; }

        /// <summary>
        /// 여기서 저기로 걸어 들어갈 수 있나. **게임과 검사가 이 함수를 같이 쓴다** —
        /// 검사가 사본을 들면 게임 쪽 배선이 끊겨도 초록불이 난다.
        /// </summary>
        public bool CanEnter(IKgdGround ground, Vector3 from, Vector3 to)
        {
            float limit = from.y + StepUp;
            if (ground.HeightAt(to) > limit) return false;
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI * 0.5f;
                var edge = to + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * Radius;
                if (ground.HeightAt(edge) > limit) return false;
            }
            return true;
        }

        /// <summary>
        /// 수평 이동을 지형에 대고 푼다. **축을 갈라 다시 시도한다** — 안 그러면 벽에
        /// 비스듬히 닿는 순간 그 자리에 붙어 버린다.
        /// </summary>
        public Vector3 Resolve(IKgdGround ground, Vector3 from, Vector3 to)
        {
            var flat = new Vector3(to.x, from.y, to.z);
            if (CanEnter(ground, from, flat)) return new Vector3(flat.x, to.y, flat.z);

            var xOnly = new Vector3(to.x, from.y, from.z);
            if (CanEnter(ground, from, xOnly)) return new Vector3(xOnly.x, to.y, from.z);

            var zOnly = new Vector3(from.x, from.y, to.z);
            if (CanEnter(ground, from, zOnly)) return new Vector3(from.x, to.y, zOnly.z);

            return new Vector3(from.x, to.y, from.z);
        }

        /// <summary>
        /// 이미 지형에 박혔으면 밀어낸다. <see cref="CanEnter"/> 는 **들어가는 것**만 막아서
        /// 떨어지거나 미끄러져 박힌 경우를 못 푼다.
        ///
        /// **내 자리가 실제로 벽 안일 때만 민다.** 테두리 표본으로 판정하면 벽 **옆에**
        /// 서 있기만 해도 매 프레임 밀려나 달리다 멈추다를 되풀이한다.
        /// </summary>
        public Vector3 Unstick(IKgdGround ground, Vector3 at)
        {
            float limit = at.y + StepUp;
            if (ground.HeightAt(at) <= limit) return at;

            var away = Vector3.zero;
            for (int i = 0; i < 8; i++)
            {
                float a = i * Mathf.PI * 0.25f;
                var dir = new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a));
                if (ground.HeightAt(at + dir * Radius * 2f) <= limit) away += dir;
            }
            if (away.sqrMagnitude > 0.0001f) return at + away.normalized * (Radius * 0.8f);

            // **빠질 곳이 없으면 위로 올린다.** 지형 안에 갇히면 조작으로는 절대 못 나온다 —
            // 위는 막히고 옆은 벽이라 그 자리에서 게임이 끝난다(실제 신고: 비탈 옆으로
            // 떨어져 비탈 밑에 박혔다). 어디로도 못 가는 것보다 위에 서는 편이 낫다.
            return new Vector3(at.x, ground.HeightAt(at) + 0.05f, at.z);
        }

        /// <summary>
        /// 착지·비탈 붙기. 돌려주는 것은 새 y 이고, <paramref name="grounded"/> 는
        /// 바닥에 있는지다. 공중이면 그대로 둔다.
        /// </summary>
        public float Settle(float y, float ground, bool onGround, out bool landed)
        {
            landed = false;
            if (y <= ground) { landed = true; return ground; }
            if (onGround && y - ground <= StepDown) return ground;
            return y;
        }
    }
}
