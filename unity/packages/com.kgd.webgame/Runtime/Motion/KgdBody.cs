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
        public bool CanEnter(IKgdGround ground, Vector3 from, Vector3 to) => CanEnter(ground, from, to, StepUp);

        /// <summary>
        /// 턱을 따로 주는 판 — 공중에서는 걷는 무릎보다 낮은 턱을 쓴다(덩이 속에 들어가지 않게).
        /// **이미 파고든 자리에서는 「더 깊어지지 않으면」 허용한다** — 안 그러면 벽 옆에 붙은 몸이 어느
        /// 방향으로도 못 움직인다(공중 턱을 낮추자 벽 옆 낙하의 조향이 통째로 죽었다: 실측 2.23 → 0.04).
        /// </summary>
        public bool CanEnter(IKgdGround ground, Vector3 from, Vector3 to, float stepUp)
            => CanEnter(ground, from, to, stepUp, false);

        /// <summary>
        /// <paramref name="graze"/> 가 켜지면 **이미 벽을 스치고 있는 몸**의 이동을 「둘레가 더 나빠지지 않으면」
        /// 허용한다(중심은 여전히 절대 못 들어간다). 안 켜면 예전 규칙 — 표본 하나라도 턱 위면 막는다.
        /// 층층이 뜬 단단한 발판 지형은 켜야 한다: 공중 턱을 낮추면 옆 덩이에 스친 몸이 어느 방향으로도 못
        /// 움직여 벽 옆 낙하의 조향이 통째로 죽는다(실측 2.23 → 0.04). 하이트맵 게임에서 켜면 봇 이동이
        /// 미세하게 달라져 판정이 흔들린다(마지막 한 사람 무기 균형 28 → 29%).
        /// </summary>
        public bool CanEnter(IKgdGround ground, Vector3 from, Vector3 to, float stepUp, bool graze)
        {
            float limit = from.y + stepUp;
            // ① **중심은 절대 지형 속으로 못 들어간다.** 중심이 들어가면 빠져나올 방향이 없어 Unstick 이 몸을
            //    위로 올리고, 그것이 화면에서 「끼였다 빠진다」다.
            if (ground.HeightAt(to) > limit) return false;
            int after = Blocked(ground, to, limit);
            if (after == 0) return true;
            // ② 둘레는 **더 나빠지지 않으면** 허용 (graze) / 하나라도 걸리면 막음 (옛 규칙)
            return graze && after <= Blocked(ground, from, limit);
        }

        /// <summary>
        /// 몸 둘레 여덟 표본 중 턱 위로 솟은 것의 수. **여덟 방향을 본다** — 넷만 보면 그 사이 45° 로 들어오는
        /// 모서리를 지나쳐 몸이 지형에 파고든다.
        /// </summary>
        private int Blocked(IKgdGround ground, Vector3 at, float limit)
        {
            int n = 0;
            for (int i = 0; i < 8; i++)
            {
                float a = i * Mathf.PI * 0.25f;
                var edge = at + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * Radius;
                if (ground.HeightAt(edge) > limit) n++;
            }
            return n;
        }

        /// <summary>
        /// 수평 이동을 지형에 대고 푼다. **축을 갈라 다시 시도한다** — 안 그러면 벽에
        /// 비스듬히 닿는 순간 그 자리에 붙어 버린다.
        /// </summary>
        public Vector3 Resolve(IKgdGround ground, Vector3 from, Vector3 to) => Resolve(ground, from, to, StepUp, false);

        public Vector3 Resolve(IKgdGround ground, Vector3 from, Vector3 to, float stepUp, bool graze)
        {
            // **한 번에 크게 옮기지 않는다.** 달리기(10.6)에 dt 0.05 면 한 프레임에 0.53 을
            // 건너뛰는데, 그 사이에 있는 얇은 것은 표본에 걸리지 않고 통과한다.
            // 반지름의 절반씩 끊어서 옮긴다.
            var delta = new Vector3(to.x - from.x, 0f, to.z - from.z);
            float span = delta.magnitude;
            float step = Radius * 0.5f;
            if (span > step)
            {
                int n = Mathf.Min(8, Mathf.CeilToInt(span / step));
                var at = from;
                for (int i = 1; i <= n; i++)
                {
                    var next = new Vector3(from.x + delta.x * i / n, at.y, from.z + delta.z * i / n);
                    at = Step(ground, at, next, stepUp, graze);
                }
                return new Vector3(at.x, to.y, at.z);
            }
            var one = Step(ground, from, new Vector3(to.x, from.y, to.z), stepUp, graze);
            return new Vector3(one.x, to.y, one.z);
        }

        /// <summary>한 칸 옮긴다. 막히면 축을 갈라 미끄러진다.</summary>
        private Vector3 Step(IKgdGround ground, Vector3 from, Vector3 to, float stepUp, bool graze)
        {
            var flat = new Vector3(to.x, from.y, to.z);
            if (CanEnter(ground, from, flat, stepUp, graze)) return flat;

            var xOnly = new Vector3(to.x, from.y, from.z);
            if (CanEnter(ground, from, xOnly, stepUp, graze)) return xOnly;

            var zOnly = new Vector3(from.x, from.y, to.z);
            if (CanEnter(ground, from, zOnly, stepUp, graze)) return zOnly;

            return from;
        }

        /// <summary>
        /// 몸 둘레가 벽 속이면 살짝 밀어낸다 — 한 프레임에 0.06, 여러 프레임에 걸쳐 빠져나온다.
        /// <see cref="Resolve"/> 는 들어가는 것을 막지만 **수직 낙하는 둘레를 안 보므로** 벽 옆으로 떨어진
        /// 몸은 어깨가 벽면 안에 박힌 채 선다. 표본은 반지름보다 0.04 안쪽이라 Resolve 가 세운 자리
        /// (면에서 반지름 밖)에서는 밀지 않는다 — 벽 옆에 서 있기만 해도 밀리면 걷다 멈추다를 되풀이한다.
        /// </summary>
        public Vector3 PushOut(IKgdGround ground, Vector3 at, float stepUp)
        {
            float limit = at.y + stepUp;
            float r = Radius - 0.04f;
            // **한 프레임 안에 빠져나오게 여러 번 민다.** 0.06 한 번으로는 낙하 속도(프레임당 0.67)를 못 이겨
            // 몸이 벽 속에 계속 잠기고, 그러면 Unstick 이 몸을 **위로 올려** 「끼였다 빠진다」가 된다.
            int score = Blocked(ground, at, limit);
            for (int step = 0; step < 6 && score > 0; step++)
            {
                var away = Vector3.zero;
                for (int i = 0; i < 8; i++)
                {
                    float a = i * Mathf.PI * 0.25f;
                    var dir = new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a));
                    if (ground.HeightAt(at + dir * r) > limit) away -= dir;
                }
                if (away.sqrMagnitude < 0.0001f) return at;
                var pushed = at + away.normalized * 0.08f;
                // 판정은 **걸린 표본 수**로 — 중심 높이로 보면 덩이 밑에 있는 자리가 전부 「더 나쁘다」로 읽혀
                // 첫 걸음에 포기하고, 그러면 Unstick 이 몸을 위로 올린다(실측 1.06 솟음)
                int after = Blocked(ground, pushed, limit);
                if (after > score) return at;
                at = pushed;
                score = after;
            }
            return at;
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
