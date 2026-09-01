using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 손에 든 것의 **규칙**. 값은 게임이 든다.
    ///
    /// 사거리·범위·속도·피해가 한 벌로 움직여야 한다 — 길게 닿는 것은 좁게 닿고,
    /// 세게 치는 것은 느리다. 하나만 세면 나머지를 들 이유가 없어진다.
    ///
    /// 동작(<see cref="Swing"/>)도 무기가 정한다. 같은 휘두르기를 색만 바꿔 쓰면
    /// **무엇을 들었는지가 화면에서 안 읽힌다.**
    /// </summary>
    public readonly struct KgdWeapon
    {
        /// <summary>휘두르는 모양. 골격에 공격 클립이 없어도 몸을 돌려 만들 수 있게 각도로 낸다.</summary>
        public enum Swing
        {
            /// <summary>맨손 — 짧게 두 번 지른다. 몸을 좌우로 번갈아 튼다.</summary>
            Jab,
            /// <summary>검 — 뒤로 감았다 옆으로 크게 벤다.</summary>
            Slash,
            /// <summary>도끼 — 위로 들었다 내리찍는다. 좌우로는 안 돈다.</summary>
            Chop,
            /// <summary>창 — 앞으로 깊게 찌른다. 몸은 거의 안 돈다.</summary>
            Thrust,
            /// <summary>활·투척 — 당겼다 놓는다. 닿는 것은 몸이 아니라 날아간 것이다.</summary>
            Shoot,
        }

        public readonly string Name;
        public readonly float Damage;
        public readonly float Reach;
        /// <summary>이 값보다 정면에 가까워야 맞는다(내적). 클수록 좁다.</summary>
        public readonly float ArcDot;
        public readonly float Time;
        /// <summary>휘두른 것이 닿는 순간까지 남은 시간. 앞뒤로 예비·후딜이 남아야 난타가 안 된다.</summary>
        public readonly float HitAt;
        public readonly Swing Style;
        public readonly Color Tint;

        /// <summary>두 손으로 쥔다. 무거운 것은 한 손으로 휘두르면 무게가 안 읽힌다.</summary>
        public readonly bool TwoHanded;

        /// <summary>날아가는 것의 속도(월드/초). 0 이면 근접 무기다.</summary>
        public readonly float ShotSpeed;

        /// <summary>날아가는 것이 있나.</summary>
        public bool Ranged => ShotSpeed > 0f;

        public KgdWeapon(string name, float damage, float reach, float arcDot, float time,
                         float hitAt, Swing style, Color tint,
                         bool twoHanded = false, float shotSpeed = 0f)
        {
            Name = name; Damage = damage; Reach = reach; ArcDot = arcDot;
            Time = time; HitAt = hitAt; Style = style; Tint = tint;
            TwoHanded = twoHanded; ShotSpeed = shotSpeed;
        }

        /// <summary>초당 피해. 무기끼리 견주는 유일한 공통 축이다.</summary>
        public float Dps => Time > 0f ? Damage / Time : 0f;

        /// <summary>이 방향이 맞는 범위 안인가.</summary>
        public bool Covers(Vector3 facing, Vector3 toTarget)
        {
            var flat = new Vector3(toTarget.x, 0f, toTarget.z);
            if (flat.magnitude > Reach) return false;
            return Vector3.Dot(flat.normalized, facing) >= ArcDot;
        }

        /// <summary>휘두르는 동안의 몸 각도. t 는 0(시작)~1(끝).</summary>
        public void Pose(float t, out float pitch, out float yaw, out float lunge)
        {
            switch (Style)
            {
                case Swing.Jab:
                    // 두 번 지른다 — 한 번에 한 번씩 몸을 반대로 튼다
                    float jab = Mathf.Sin(t * Mathf.PI * 2f);
                    pitch = 10f * Mathf.Sin(t * Mathf.PI);
                    yaw = jab * 18f;
                    lunge = Mathf.Abs(jab) * 5f;
                    break;

                case Swing.Chop:
                    pitch = t < 0.42f ? Mathf.Lerp(0f, -38f, t / 0.42f)
                                      : Mathf.Lerp(-38f, 46f, (t - 0.42f) / 0.58f);
                    yaw = 0f;
                    lunge = t < 0.42f ? 0f : 4f;
                    break;

                case Swing.Thrust:
                    // **몸이 걸어 나가면 찌르기가 아니라 걷기로 읽힌다**(실제 신고).
                    // 앞으로 내미는 것은 팔이 하고(Arms), 몸은 살짝 기울기만 한다.
                    float push = Mathf.Sin(Mathf.Clamp01(t / 0.6f) * Mathf.PI);
                    pitch = push * 8f;
                    yaw = 0f;
                    lunge = push * 3.5f;
                    break;

                case Swing.Shoot:
                    // 당겼다 놓는다 — 몸은 거의 안 움직이고 반동만 남는다
                    pitch = t < 0.7f ? -4f * (t / 0.7f) : Mathf.Lerp(-4f, 6f, (t - 0.7f) / 0.3f);
                    yaw = 0f;
                    lunge = 0f;
                    break;

                default:   // Slash
                    if (t < 0.30f) { yaw = Mathf.Lerp(0f, -34f, t / 0.30f); pitch = -6f * (t / 0.30f); }
                    else if (t < 0.62f) { float u = (t - 0.30f) / 0.32f; yaw = Mathf.Lerp(-34f, 62f, u); pitch = Mathf.Lerp(-6f, 34f, u); }
                    else { float u = (t - 0.62f) / 0.38f; yaw = Mathf.Lerp(62f, 0f, u); pitch = Mathf.Lerp(34f, 0f, u); }
                    lunge = 6f;
                    break;
            }
        }

        /// <summary>
        /// 휘두르는 동안의 **팔 각도**. 몸통만 돌리면 무엇을 들었든 같은 동작으로 보인다 —
        /// 창이 찌르기가 아니라 휘두르기로 읽힌 것도 이 때문이었다(실제 신고).
        ///
        /// 각도는 어깨 기준 X축(앞으로 내미는 방향)이다. 왼팔은 두 손 무기일 때만 따라온다.
        /// </summary>
        public void Arms(float t, out float right, out float left, out float grip)
        {
            switch (Style)
            {
                case Swing.Thrust:
                    // 뒤로 당겼다 앞으로 곧게 뻗는다
                    float p = t < 0.35f ? -Mathf.Lerp(0f, 40f, t / 0.35f)
                                        : Mathf.Lerp(-40f, -104f, (t - 0.35f) / 0.65f);
                    right = p; left = p * 0.72f; grip = 1f;
                    break;

                case Swing.Chop:
                    // 머리 위로 들었다 내리찍는다
                    right = t < 0.42f ? Mathf.Lerp(-20f, 66f, t / 0.42f)
                                      : Mathf.Lerp(66f, -78f, (t - 0.42f) / 0.58f);
                    left = right; grip = 1f;
                    break;

                case Swing.Shoot:
                    // 오른팔은 시위를 당기고 왼팔은 활을 든 채 고정한다
                    right = t < 0.7f ? Mathf.Lerp(-30f, 6f, t / 0.7f) : -34f;
                    left = -86f; grip = 1f;
                    break;

                case Swing.Slash:
                    right = t < 0.30f ? Mathf.Lerp(-10f, 24f, t / 0.30f)
                          : t < 0.62f ? Mathf.Lerp(24f, -46f, (t - 0.30f) / 0.32f)
                                      : Mathf.Lerp(-46f, -10f, (t - 0.62f) / 0.38f);
                    left = 0f; grip = 0f;
                    break;

                default:   // Jab — 번갈아 짧게 지른다
                    float j = Mathf.Sin(t * Mathf.PI * 2f);
                    right = -46f * Mathf.Max(0f, j);
                    left = -46f * Mathf.Max(0f, -j);
                    grip = 0f;
                    break;
            }
            if (!TwoHanded && Style != Swing.Shoot && Style != Swing.Jab) { left = 0f; grip = 0f; }
        }

        /// <summary>
        /// 휘두른 자국의 폭. **그림과 판정이 같은 값에서 나와야** 「어디까지 닿는지」를
        /// 화면으로 배울 수 있다.
        /// </summary>
        public float ArcWidth => Reach * Mathf.Clamp(1f - ArcDot, 0.18f, 0.95f);
    }
}
