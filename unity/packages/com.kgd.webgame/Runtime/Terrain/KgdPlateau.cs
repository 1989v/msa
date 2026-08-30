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

        /// <summary>램프가 난 방향(도). <see cref="SnapRampYaw"/> 로 대각선에 붙여 쓴다.</summary>
        public float RampYaw;

        /// <summary>모서리를 얼마나 깎는가. 1.414 면 사각형, 1.0 이면 마름모, 1.16 이 팔각.</summary>
        public float Chamfer = 1.16f;

        /// <summary>비탈 길이. 높이 대비 너무 짧으면 걸어 오르는 느낌이 아니라 벽을 타는 느낌이 된다.</summary>
        public float RampLength = 12f;

        /// <summary>비탈이 덮는 반각(도). 팔각형 한 면이 45°라 22.5 를 넘기지 않는다.</summary>
        public float RampHalfAngle = 15f;

        /// <summary>비탈 위쪽 폭(초크). 좁아야 고지를 지키는 일이 성립한다.</summary>
        public float RampTopWidth = 5f;

        /// <summary>비탈 아래쪽 폭. 위보다 넓어야 입구가 깔때기로 읽힌다.</summary>
        public float RampBottomWidth = 10f;

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
            return Height * (1f - d / RampLength);
        }

        public bool OnRamp(Vector3 p)
        {
            float dx = p.x - Center.x, dz = p.z - Center.z;
            if (dx * dx + dz * dz < 0.0001f) return true;
            float yaw = Mathf.Atan2(dx, dz) * Mathf.Rad2Deg;
            return Mathf.Abs(Mathf.DeltaAngle(yaw, RampYaw)) <= RampHalfAngle;
        }

        /// <summary>높이 조회를 건너뛰어도 되는 거리. 개체가 많으면 이걸로 먼저 걸러야 한다.</summary>
        public float Reach => Radius * 1.45f + RampLength;

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
        public static float SnapRampYaw(float yaw) => Mathf.Round((yaw - 45f) / 90f) * 90f + 45f;
    }
}
