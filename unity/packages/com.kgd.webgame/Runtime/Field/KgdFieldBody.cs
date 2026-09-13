using UnityEngine;

namespace Kgd.Field
{
    /// <summary>
    /// 밀도 세계에서 움직이는 몸. **상자가 격자에 부딪히는 것이 아니라, 구 몇 개가 장 밖으로
    /// 밀려나는 것**이다 — 면이 어디 있는지는 밀도가 알고, 어디로 밀어야 하는지는 그 기울기가 안다.
    ///
    /// 발·허리·머리 자리에 같은 반지름의 구를 세운다. **점으로 재면 안 된다** — 점이 표면에 닿을 때
    /// 몸의 절반은 이미 땅속이다(실제 신고: 다리가 땅에 묻혔다).
    /// </summary>
    public sealed class KgdFieldBody
    {
        public readonly float Radius, Height, EyeY;

        public struct Hit { public bool Ground, Ceiling, Wall; }

        public KgdFieldBody(float radius, float height)
        {
            Radius = radius;
            Height = height;
            EyeY = height - 0.16f;
        }

        /// <summary>
        /// 몸을 옮기고 장 밖으로 밀어낸다. 되돌려주는 자리는 발이다.
        /// **한 번에 반지름보다 멀리 가지 않는다** — 빠른 낙하를 한 번에 옮기면 바닥을 통째로
        /// 건너뛰어 땅속에 박힌다. 잘게 나눠 걸음마다 밀어낸다.
        /// </summary>
        /// <param name="stepUp">
        /// 땅에 서 있을 때 참으로 준다 — 벽에 막히면 <see cref="StepUp"/> 까지 턱을 걸어 올라간다.
        /// 등치면은 완만한 턱을 비탈로 펴 주지만, 지은 것의 모서리처럼 곧추선 한 칸 턱은 그대로 남는다.
        /// 그것까지 뛰어야 넘게 하면 폰에서 한 발짝마다 점프 버튼을 누르게 된다.
        /// </param>
        public Vector3 Move(KgdFieldWorld w, Vector3 pos, Vector3 delta, out Hit hit, bool stepUp = false)
        {
            hit = default;
            var from = pos;
            int steps = Mathf.Max(1, Mathf.CeilToInt(delta.magnitude / (Radius * 0.8f)));
            var step = delta / steps;
            for (int i = 0; i < steps; i++)
            {
                pos = Push(w, pos + step, ref hit);
                // 땅에 닿았으면 남은 낙하는 버린다 — 바닥을 뚫고 계속 내려갈 이유가 없다
                if (hit.Ground && step.y < 0f) step.y = 0f;
            }

            // 턱 오르기 — 앞으로 가려 했는데 못 갔고(막힘), 한 걸음 앞의 땅이 지금보다 높되 상한 안이면 올라선다.
            // 벽인지 비탈인지 면의 기울기로 가르지 않는다: 지은 것의 모서리는 위가 둥글어 「비탈」로 읽히고,
            // 두 칸 벼랑의 자락은 「땅」으로 읽혀 어느 쪽으로 가르든 한쪽이 틀렸다(실측 여러 번).
            var flat = new Vector3(delta.x, 0f, delta.z);
            if (stepUp && flat.sqrMagnitude > 1e-8f)
            {
                var went = new Vector3(pos.x - from.x, 0f, pos.z - from.z);
                bool stuck = Vector3.Dot(went, flat) < flat.sqrMagnitude * 0.5f;
                if (stuck)
                {
                    var dir = flat.normalized;
                    var ahead = from + dir * (Radius + 0.15f);
                    float baseY = Floor(w, from, from.y + 0.3f);
                    float top = Floor(w, ahead, baseY + StepUp);
                    // 반 걸음 앞에서 이미 오르고 있으면 턱이 아니라 비탈이다 — 비탈은 걷거나(완만) 막힌다(가파름)
                    float half = Floor(w, from + dir * (Radius * 0.75f), baseY + StepUp);
                    bool ledge = half <= baseY + 0.35f;
                    if (ledge && top > from.y + 0.2f && top <= baseY + StepUp + 0.05f)
                    {
                        var cand = new Vector3(ahead.x, top, ahead.z);
                        if (!Blocked(w, cand))
                        {
                            var settled = default(Hit);
                            pos = Push(w, cand, ref settled);
                            hit.Ground = true;
                            hit.Wall = settled.Wall;
                        }
                    }
                }
            }
            return pos;
        }

        /// <summary>면의 위쪽 성분이 이보다 커야 땅이다 — 57° 까지 걷고 그보다 가파르면 벽이다.</summary>
        public const float WalkableUp = 0.55f;

        /// <summary>
        /// 걸어서 오르는 턱의 상한(칸). 두 칸은 뛰어야 넘는다 — 지형이 길을 정한다.
        /// 한 칸을 쌓아 붙인 것의 표면은 밀도 보간 때문에 한 칸보다 조금 높이(약 1.3) 선다 — 그래서 1 이 아니다.
        /// </summary>
        public const float StepUp = 1.35f;

        /// <summary>이 자리에서 발이 닿는 땅의 높이 — 위에서 내려오며 처음 닿는 표면.</summary>
        private float Floor(KgdFieldWorld w, Vector3 at, float fromY)
        {
            float y = fromY;
            for (int i = 0; i < 24; i++)
            {
                if (w.Depth(new Vector3(at.x, y + Radius, at.z), out _) + Radius > -0.03f) return y;
                y -= 0.08f;
            }
            return y;
        }

        private Vector3 Push(KgdFieldWorld w, Vector3 pos, ref Hit hit)
        {
            for (int pass = 0; pass < 5; pass++)
            {
                bool moved = false;
                for (float h = Radius; h <= Height - Radius + 0.01f; h += 0.6f)
                {
                    var probe = pos + Vector3.up * Mathf.Min(h, Height - Radius);
                    float depth = w.Depth(probe, out var outward) + Radius;
                    if (depth <= 0f) continue;

                    Vector3 push;
                    if (outward.y > WalkableUp) { push = outward * Mathf.Min(depth, 0.5f); hit.Ground = true; }
                    else if (outward.y < -0.5f) { push = outward * Mathf.Min(depth, 0.5f); hit.Ceiling = true; }
                    else
                    {
                        // 벽은 **옆으로만** 민다. 기울기대로 밀면 벽의 둥근 윗모서리가 몸을 조금씩 들어 올려
                        // 두 칸 벼랑을 걸어 오른다(실측) — 오르는 것은 땅과 턱 오르기만 한다
                        var flat = new Vector3(outward.x, 0f, outward.z);
                        float len = flat.magnitude;
                        push = len < 1e-4f ? Vector3.zero : flat / len * Mathf.Min(depth, 0.5f);
                        hit.Wall = true;
                    }
                    pos += push;
                    moved = true;
                }
                if (!moved) break;
            }
            return pos;
        }

        /// <summary>발밑이 가깝나 — 비탈에서 미끄러지듯 굴러떨어지지 않게 조금 여유를 둔다.</summary>
        public bool Grounded(KgdFieldWorld w, Vector3 pos)
        {
            var foot = pos + Vector3.up * Radius;
            return w.Depth(foot, out var outward) + Radius > -0.14f && outward.y > WalkableUp - 0.15f;
        }

        /// <summary>이 자리에 서면 몸이 땅에 겹치나. 아직 안 만든 곳은 막힌 것으로 친다 — 들어가면 다음 프레임에 땅속이다.</summary>
        public bool Blocked(KgdFieldWorld w, Vector3 pos)
        {
            if (!w.Ready(Mathf.FloorToInt(pos.x), Mathf.FloorToInt(pos.z))) return true;
            for (float h = Radius; h <= Height - Radius + 0.01f; h += 0.6f)
                if (w.Depth(pos + Vector3.up * Mathf.Min(h, Height - Radius), out _) + Radius > 0.05f) return true;
            return false;
        }

        /// <summary>몸이 액체에 잠긴 비율 0~1. 발부터 머리까지 몇 군데를 본다.</summary>
        public float Submerged(KgdFieldWorld w, Vector3 pos)
        {
            const int N = 6;
            int wet = 0;
            for (int i = 0; i < N; i++)
            {
                var p = pos + Vector3.up * (Height * (i + 0.5f) / N);
                if (w.IsLiquid(Mathf.FloorToInt(p.x), Mathf.FloorToInt(p.y), Mathf.FloorToInt(p.z))) wet++;
            }
            return wet / (float)N;
        }
    }
}
