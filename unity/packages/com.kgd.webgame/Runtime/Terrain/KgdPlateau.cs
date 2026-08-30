using UnityEngine;

namespace Kgd.Terrain
{
    /// <summary>
    /// 고지대 한 덩이 — 램프 하나로만 오르내리는 팔각 절벽.
    ///
    /// **원이 아니라 팔각형인 이유.** 스타크래프트 절벽은 타일 격자를 따라 각져 있고,
    /// 언덕 입구는 「대각선 왼쪽 아래 / 오른쪽 아래」 두 방향으로만 난다 — 위로 난 입구
    /// (역입구)는 절벽·입구·다리 타일 조각을 손으로 이어 붙여야 나온다. 둥근 언덕은
    /// 아무리 높여도 그 느낌이 나지 않는다: 모서리가 없으면 「여기가 절벽 끝」이라는
    /// 선이 안 생기고, 램프가 「면 하나를 잘라낸 자국」으로 읽히지 않는다.
    ///
    /// 이 타입은 **모양과 높이만** 안다. 그리는 일과 충돌 등록은
    /// <see cref="KgdPlateauBuilder"/> 가 게임이 넘긴 싱크로 위임한다 — 게임마다
    /// 메시 빌더도 충돌 구조도 다르기 때문이다.
    /// </summary>
    public sealed class KgdPlateau
    {
        public Vector3 Center;

        /// <summary>
        /// 게임이 붙이는 꼬리표. 패키지는 이 값을 읽지 않는다 — 「어느 구역의 언덕인가」 같은
        /// 것은 게임마다 다르고, 그걸 패키지가 알면 다음 게임이 그 개념부터 들고 와야 한다.
        /// </summary>
        public int Tag;

        /// <summary>축 방향 반폭. 팔각형의 최대 반경은 이 값보다 조금 크다.</summary>
        public float Radius = 12f;

        public float Height = 5f;

        /// <summary>
        /// 램프가 난 방향(도). **넣는 즉시 대각선(또는 축)에 붙는다.**
        ///
        /// 어중간한 각도를 넣으면 팔각형의 받침선과 램프가 자르는 면이 어긋나, 걷는 면이
        /// 그려진 면보다 최대 0.8 유닛 높아지고(마루 위를 공중에서 걷는다) 비탈 아래 모서리
        /// 일부는 반대로 바닥으로 꺼진다. 스냅하면 둘이 정확히 일치한다.
        /// </summary>
        public float RampYaw
        {
            get => _rampYaw;
            set
            {
                _rampYaw = SnapRampYaw(value);
                _rampBoundary = -1f;
                _trig = false;
            }
        }

        private float _rampYaw;

        /// <summary>모서리를 얼마나 깎는가. 1.414 면 사각형, 1.0 이면 마름모, 1.16 이 팔각.</summary>
        public float Chamfer = 1.16f;

        /// <summary>비탈 길이. 높이 대비 너무 짧으면 걸어 오르는 느낌이 아니라 벽을 타는 느낌이 된다.</summary>
        public float RampLength = 8f;



        /// <summary>비탈 위쪽 폭(초크). 좁아야 고지를 지키는 일이 성립한다.</summary>
        public float RampTopWidth = 3.4f;

        /// <summary>비탈 아래쪽 폭. 위보다 넓어야 입구가 깔때기로 읽힌다.</summary>
        public float RampBottomWidth = 5.6f;

        /// <summary>테두리까지의 거리. 안이면 음수, 밖이면 양수.</summary>
        public float EdgeDistance(Vector3 p)
        {
            float x = Mathf.Abs(p.x - Center.x);
            float z = Mathf.Abs(p.z - Center.z);
            return Mathf.Max(Mathf.Max(x - Radius, z - Radius),
                             (x + z) * 0.70710678f - Radius * Chamfer);
        }

        public bool Covers(Vector3 p) => EdgeDistance(p) <= 0f;

        /// <summary>바닥 높이. 비탈 위에서는 경사로 이어지고, 그 밖의 테두리 밖은 0 이다.</summary>
        public float HeightAt(Vector3 p)
        {
            float d = EdgeDistance(p);
            if (d <= 0f) return Height;
            if (d > RampLength) return 0f;
            if (!OnRamp(p)) return 0f;
            // 비탈의 경사는 **램프 축 방향 거리**로 잰다 — 그려진 면이 그 기준이라,
            // 테두리 거리로 재면 비탈 가장자리에서 그림과 몇 십 cm 씩 어긋난다.
            Trig();
            float along = (p.x - Center.x) * _sin + (p.z - Center.z) * _cos;
            float t = Mathf.Clamp01((along - RampBoundary) / RampLength);
            return Height * (1f - t);
        }

        /// <summary>
        /// 비탈 위인가 — **그려진 사다리꼴과 같은 모양으로 잰다.**
        ///
        /// 고정 반각(15°)으로 재던 때는 걸을 수 있는 범위가 그려진 비탈보다 양옆으로
        /// 1.6~2.8 유닛 넓었다(반경 12.5 기준). 비탈 옆 허공을 딛고 오를 수 있다는 뜻이다.
        /// 그림과 판정이 같은 식을 쓰면 그 틈이 원천적으로 없다.
        /// </summary>
        public bool OnRamp(Vector3 p)
        {
            float dx = p.x - Center.x, dz = p.z - Center.z;
            if (dx * dx + dz * dz < 0.0001f) return true;

            Trig();
            float along = dx * _sin + dz * _cos;
            float lateral = Mathf.Abs(dx * _cos - dz * _sin);

            // **여기서 「고원 몸통이면 참」 같은 지름길을 두면 안 된다.** 그렇게 했더니
            // 반대편까지 포함해 테두리 밖 10유닛 앞마당 전체가 참이 되어, HeightAt 이
            // 그 땅을 통째로 절벽 높이로 들어 올렸다(약 985㎡, 최대 6.8). 좀비가 언덕
            // 근처에만 오면 공중을 걸었다. 몸통은 HeightAt 이 EdgeDistance 로 이미 걸러낸다.
            float t = (along - RampBoundary) / RampLength;
            if (t < 0f || t > 1f) return false;
            return lateral <= Mathf.Lerp(RampTopWidth, RampBottomWidth, t) * 0.5f;
        }

        /// <summary>
        /// 램프 방향의 경계 거리. **한 번만 재서 들고 있는다** — 개체마다 매 프레임 부르는
        /// 경로라 이진 탐색을 그때마다 돌리면 안 된다.
        /// </summary>
        public float RampBoundary
        {
            get
            {
                if (_rampBoundary < 0f)
                {
                    Trig();
                    _rampBoundary = BoundaryAlong(new Vector3(_sin, 0f, _cos));
                }
                return _rampBoundary;
            }
        }

        private float _rampBoundary = -1f;
        private bool _trig;
        private float _sin, _cos;

        private void Trig()
        {
            if (_trig) return;
            float rr = _rampYaw * Mathf.Deg2Rad;
            _sin = Mathf.Sin(rr);
            _cos = Mathf.Cos(rr);
            _trig = true;
        }

        /// <summary>
        /// <paramref name="dir"/> 방향으로 중심에서 테두리까지의 거리.
        ///
        /// **비탈 메시는 반드시 이 값에서 시작해야 한다.** 메시를 중심 거리로, 높이를
        /// 테두리 거리로 재면 둘이 어긋나 비탈 끝이 지면에 닿지 못하고 턱이 생긴다
        /// (팔각형이라 대각선 쪽은 축 쪽보다 2~3 유닛 멀다).
        /// </summary>
        public float BoundaryAlong(Vector3 dir)
        {
            float lo = 0f, hi = Radius * 2f;
            for (int i = 0; i < 24; i++)
            {
                float mid = (lo + hi) * 0.5f;
                if (EdgeDistance(Center + dir * mid) <= 0f) lo = mid; else hi = mid;
            }
            return lo;
        }

        /// <summary>높이 조회를 건너뛰어도 되는 거리. 개체가 많으면 이걸로 먼저 걸러야 한다.</summary>
        public float Reach
        {
            get
            {
                // {EdgeDistance <= RampLength} 는 각 반평면을 그만큼 민 팔각형이다. 그 꼭짓점까지가
                // 참 상한 — 1.45 배 어림은 Chamfer 1.414(문서가 권하는 값) 에서 모자라, 비탈 아래
                // 모서리에서 높이 조회가 잘려 배우가 램프 속으로 꺼진다.
                float a = Radius + RampLength;
                float b = 1.41421356f * (Radius * Chamfer + RampLength) - a;
                return Mathf.Sqrt(a * a + b * b);
            }
        }

        /// <summary>팔각형 꼭짓점 여덟 개(중심 기준 로컬, 시계 반대).</summary>
        public Vector3[] Corners()
        {
            float r = Radius;
            float t = r * Chamfer * 1.41421356f - r;
            return new[]
            {
                new Vector3( r, 0f,  t), new Vector3( t, 0f,  r),
                new Vector3(-t, 0f,  r), new Vector3(-r, 0f,  t),
                new Vector3(-r, 0f, -t), new Vector3(-t, 0f, -r),
                new Vector3( t, 0f, -r), new Vector3( r, 0f, -t),
            };
        }

        /// <summary>
        /// 램프를 대각선에 붙인다. 임의 각도로 두면 절벽 모서리를 비스듬히 잘라
        /// 「깎다 만 자리」처럼 보인다 — 원작의 입구가 대각선인 것도 같은 이유다.
        /// </summary>
        /// <summary>
        /// 팔각형은 면이 여덟이므로 **입구도 여덟 방향**이다 — 축 넷(N·E·S·W)과 대각선 넷.
        /// 45° 눈금에 붙이면 램프가 자르는 면과 팔각형의 받침선이 정확히 겹쳐, 걷는 면과
        /// 그려진 면이 어긋나지 않는다(눈금 밖 각도는 최대 0.8 유닛 뜬다).
        ///
        /// 축 면은 길고(2t) 대각선 면은 짧다(√2(R−t)) — 반경 10·Chamfer 1.16 이면 12.8 대
        /// 5.1 이다. 램프 위쪽 폭이 짧은 쪽 면보다 넓으면 입구가 이웃 벽에 걸리므로,
        /// `RampTopWidth` 는 √2(Radius − t) 아래로 둔다.
        /// </summary>
        public static float SnapRampYaw(float yaw) => Mathf.Round(yaw / 45f) * 45f;
    }
}
