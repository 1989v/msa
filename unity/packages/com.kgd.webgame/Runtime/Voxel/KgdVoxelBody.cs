using UnityEngine;

namespace Kgd.Voxel
{
    /// <summary>
    /// 블록 세계를 걸어 다니는 몸. 상자 하나가 격자에 부딪히는 것뿐이다.
    ///
    /// **유니티 물리를 쓰지 않는다.** WebGL 빌드는 엔진 코드 스트리핑으로 Physics 모듈이
    /// 빠져 <c>CapsuleCollider</c> 조차 없을 수 있다. 격자에서는 그게 손해도 아니다 —
    /// 상자 대 정수 격자는 축마다 따로 밀면 정확히 풀린다.
    ///
    /// **축을 따로 민다.** 셋을 한꺼번에 풀면 모서리에서 두 면을 동시에 밀어 튕겨 나간다.
    /// 위아래를 먼저 풀어야 「땅에 서 있다」가 정해지고, 그래야 옆으로 막혔을 때
    /// 한 칸 올라설지(<see cref="StepUp"/>) 판단할 수 있다.
    /// </summary>
    public readonly struct KgdVoxelBody
    {
        /// <summary>몸 반폭. 0.3 이면 한 칸(1.0) 통로를 여유 있게 지난다.</summary>
        public readonly float Radius;

        /// <summary>키. 발밑이 기준점이고 눈은 <see cref="EyeY"/> 에 있다.</summary>
        public readonly float Height;

        /// <summary>걸어서 올라설 수 있는 턱. 0 이면 한 칸도 못 올라 매번 뛰어야 한다.</summary>
        public readonly float StepUp;

        public KgdVoxelBody(float radius, float height, float stepUp)
        {
            Radius = radius;
            Height = height;
            StepUp = stepUp;
        }

        public float EyeY => Height - 0.22f;

        public struct Hit
        {
            /// <summary>발이 바닥에 닿았다.</summary>
            public bool Ground;

            /// <summary>머리가 천장을 쳤다.</summary>
            public bool Ceiling;

            /// <summary>옆이 막혔다 — 올라서기로도 못 풀었다.</summary>
            public bool Wall;

            /// <summary>이번에 턱을 밟고 올라섰다.</summary>
            public bool Stepped;
        }

        /// <summary>
        /// <paramref name="delta"/> 만큼 밀어 본다. 막힌 축은 그 자리에 두고 나머지만 간다.
        /// </summary>
        public Vector3 Move(KgdVoxelWorld w, Vector3 pos, Vector3 delta, out Hit hit)
        {
            hit = default;

            // 위아래 먼저 — 「서 있다」가 정해져야 옆이 막혔을 때 올라설지 알 수 있다.
            //
            // **지나간 자리를 전부 훑는다.** 도착 지점만 보면 한 프레임에 여러 칸을 떨어질 때
            // 바닥을 통째로 지나쳐, 낙하 속도가 붙은 순간 땅속에 박힌다.
            if (delta.y < 0f)
            {
                float want = pos.y + delta.y;
                float support = TopBetween(w, pos, pos.y, want);
                if (support > want) { pos.y = support; hit.Ground = true; }
                else pos.y = want;
            }
            else if (delta.y > 0f)
            {
                float want = pos.y + delta.y;
                float ceiling = BottomBetween(w, pos, pos.y + Height, want + Height);
                if (ceiling < want + Height) { pos.y = ceiling - Height - 0.001f; hit.Ceiling = true; }
                else pos.y = want;
            }

            bool onGround = hit.Ground || Grounded(w, pos);

            pos = Slide(w, pos, new Vector3(delta.x, 0f, 0f), onGround, ref hit);
            pos = Slide(w, pos, new Vector3(0f, 0f, delta.z), onGround, ref hit);
            return pos;
        }

        private Vector3 Slide(KgdVoxelWorld w, Vector3 pos, Vector3 delta, bool onGround, ref Hit hit)
        {
            if (delta.sqrMagnitude < 1e-10f) return pos;

            var next = pos + delta;
            if (!Blocked(w, next)) return next;

            // 한 칸 턱이면 올라선다. 안 그러면 블록 세계에서 한 발짝마다 뛰어야 한다 —
            // 화면 버튼으로 노는 폰에서 그건 곧 못 논다는 뜻이다.
            if (onGround && StepUp > 0f)
            {
                var up = next;
                up.y += StepUp;
                if (!Blocked(w, up))
                {
                    // **들어 올린 높이가 아니라 밟을 면을 찾는다.** 올린 자리의 칸 경계를
                    // 그대로 쓰면 턱보다 한 칸 위에 올라서서, 한 칸 턱이 두 칸으로 읽힌다.
                    float support = TopBetween(w, up, up.y, pos.y);
                    if (support > pos.y - 0.001f && support - pos.y <= StepUp + 0.001f)
                    {
                        up.y = support;
                        if (!Blocked(w, up))
                        {
                            hit.Stepped = true;
                            return up;
                        }
                    }
                }
            }

            hit.Wall = true;
            return pos;
        }

        /// <summary>
        /// <paramref name="fromY"/> 에서 <paramref name="toY"/> 까지 내려가며 만나는
        /// **가장 높은 바닥면**. 못 만나면 아주 낮은 값을 낸다.
        /// </summary>
        private float TopBetween(KgdVoxelWorld w, Vector3 p, float fromY, float toY)
        {
            int x0 = Mathf.FloorToInt(p.x - Radius), x1 = Mathf.FloorToInt(p.x + Radius);
            int z0 = Mathf.FloorToInt(p.z - Radius), z1 = Mathf.FloorToInt(p.z + Radius);
            int yTop = Mathf.FloorToInt(fromY), yBot = Mathf.FloorToInt(toY);

            for (int y = yTop; y >= yBot; y--)
            {
                if (y < 0) return 0f;              // 세계 밑바닥 — 더 내려갈 곳이 없다
                if (y >= w.Height) continue;
                for (int x = x0; x <= x1; x++)
                {
                    for (int z = z0; z <= z1; z++)
                    {
                        var k = w.Kinds[w.Get(x, y, z)];
                        if (k.Solid && !k.Liquid) return y + 1;
                    }
                }
            }
            return float.NegativeInfinity;
        }

        /// <summary>올라가며 만나는 **가장 낮은 천장면**. 못 만나면 아주 높은 값을 낸다.</summary>
        private float BottomBetween(KgdVoxelWorld w, Vector3 p, float fromY, float toY)
        {
            int x0 = Mathf.FloorToInt(p.x - Radius), x1 = Mathf.FloorToInt(p.x + Radius);
            int z0 = Mathf.FloorToInt(p.z - Radius), z1 = Mathf.FloorToInt(p.z + Radius);
            int yBot = Mathf.FloorToInt(fromY), yTop = Mathf.FloorToInt(toY);

            for (int y = yBot; y <= yTop; y++)
            {
                if (y < 0 || y >= w.Height) continue;
                for (int x = x0; x <= x1; x++)
                {
                    for (int z = z0; z <= z1; z++)
                    {
                        var k = w.Kinds[w.Get(x, y, z)];
                        if (k.Solid && !k.Liquid) return y;
                    }
                }
            }
            return float.PositiveInfinity;
        }

        /// <summary>이 자리에 몸이 들어가는가. 아직 안 만든 청크는 막힌 것으로 친다.</summary>
        public bool Blocked(KgdVoxelWorld w, Vector3 p)
        {
            int x0 = Mathf.FloorToInt(p.x - Radius), x1 = Mathf.FloorToInt(p.x + Radius);
            int z0 = Mathf.FloorToInt(p.z - Radius), z1 = Mathf.FloorToInt(p.z + Radius);
            int y0 = Mathf.FloorToInt(p.y + 0.001f), y1 = Mathf.FloorToInt(p.y + Height - 0.001f);

            for (int x = x0; x <= x1; x++)
            {
                for (int z = z0; z <= z1; z++)
                {
                    // 아직 안 만든 곳으로는 걸어 들어가지 않는다. 들어가면 다음 프레임에
                    // 지형이 생기면서 몸이 돌 속에 박힌다.
                    if (!w.Ready(x, z)) return true;
                    for (int y = y0; y <= y1; y++)
                    {
                        if (y < 0) return true;
                        if (y >= w.Height) continue;
                        var k = w.Kinds[w.Get(x, y, z)];
                        if (k.Solid && !k.Liquid) return true;
                    }
                }
            }
            return false;
        }

        /// <summary>발밑이 막혔는가.</summary>
        public bool Grounded(KgdVoxelWorld w, Vector3 p)
        {
            var probe = p;
            probe.y -= 0.02f;
            return Blocked(w, probe);
        }

        /// <summary>몸의 어디까지 물에 잠겼는가 0~1. 눈까지 잠기면 화면을 물빛으로 덮는다.</summary>
        public float Submerged(KgdVoxelWorld w, Vector3 p)
        {
            int x = Mathf.FloorToInt(p.x), z = Mathf.FloorToInt(p.z);
            int y0 = Mathf.FloorToInt(p.y), y1 = Mathf.FloorToInt(p.y + Height);
            int wet = 0, total = 0;
            for (int y = y0; y <= y1; y++)
            {
                total++;
                if (y >= 0 && y < w.Height && w.IsLiquid(x, y, z)) wet++;
            }
            return total == 0 ? 0f : (float)wet / total;
        }

        /// <summary>이 자리에 발을 딛고 설 수 있는 가장 낮은 높이. 판을 처음 깔 때 쓴다.</summary>
        public float DropTo(KgdVoxelWorld w, int x, int z, int fromY)
        {
            for (int y = Mathf.Min(fromY, w.Height - 1); y > 0; y--)
            {
                var k = w.Kinds[w.Get(x, y, z)];
                if (!k.Solid || k.Liquid) continue;
                return y + 1;
            }
            return 1f;
        }
    }
}
