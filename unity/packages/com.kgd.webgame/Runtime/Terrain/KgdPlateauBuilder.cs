using UnityEngine;

namespace Kgd.Terrain
{
    /// <summary>
    /// 고지대 한 덩이를 그리고 막는다. 게임은 <see cref="IKgdTerrainSink"/> 하나만 구현하면 된다.
    ///
    /// 만드는 것은 넷이다:
    ///  ① 팔각 절벽 — 램프가 난 면 하나만 비운다
    ///  ② 윗면 — 주변 지면색을 조금 밝혀 이어 붙인다
    ///  ③ 비탈 — 위가 좁고 아래가 넓은 초크
    ///  ④ 비탈 양옆 벽 — 절벽과 같은 재질로 이어져 깔때기가 된다. **여기가 막혀야 규칙이 산다**
    /// </summary>
    public static class KgdPlateauBuilder
    {
        public static void Build(KgdPlateau p, IKgdTerrainSink sink, KgdPlateauPalette palette)
        {
            var corners = p.Corners();

            // ① 팔각 절벽
            //
            // 변마다 상자를 놓되 **두께만큼 짧게** 놓고, 꼭짓점에 기둥을 따로 세운다.
            // 변을 꼭짓점까지 꽉 채우면 45° 이음매에서 상자 모서리가 서로를 뚫고 나와
            // 절벽이 톱니처럼 보인다 — 각진 지형에서 가장 먼저 티가 나는 자리다.
            const float Thick = 2.4f;
            for (int e = 0; e < 8; e++)
            {
                var v0 = corners[e];
                var v1 = corners[(e + 1) % 8];
                var mid = (v0 + v1) * 0.5f;
                float len = Vector3.Distance(v0, v1);
                var edge = (v1 - v0).normalized;
                float yaw = Mathf.Atan2(edge.x, edge.z) * Mathf.Rad2Deg + 90f;

                float midYaw = Mathf.Atan2(mid.x, mid.z) * Mathf.Rad2Deg;
                bool isRamp = Mathf.Abs(Mathf.DeltaAngle(midYaw, p.RampYaw)) < 22.5f;

                // 꼭짓점 기둥 — 램프 면이든 아니든 세운다. 여기가 비면 절벽이 끊겨 보인다
                var post = v0;
                sink.Box(post + Vector3.up * (p.Height * 0.5f),
                         new Vector3(Thick, p.Height, Thick), Quaternion.identity, palette.Cliff);
                sink.Box(post + Vector3.up * (p.Height - 0.16f),
                         new Vector3(Thick, 0.32f, Thick), Quaternion.identity, palette.Lip);

                if (isRamp) continue;   // 램프가 난 면은 벽을 세우지 않는다

                var rot = Quaternion.Euler(0f, yaw, 0f);
                float span = Mathf.Max(0.2f, len - Thick);
                sink.Box(mid + Vector3.up * (p.Height * 0.5f), new Vector3(span, p.Height, Thick),
                         rot, palette.Cliff);

                // 안쪽으로 한 겹 물린 그림자 면 — 두께가 없으면 위에서 볼 때 선 한 줄로만 보인다
                var inward = new Vector3(-mid.x, 0f, -mid.z).normalized * 1.5f;
                sink.Box(mid + inward + Vector3.up * (p.Height * 0.42f),
                         new Vector3(span * 0.98f, p.Height * 0.84f, 1.6f), rot, palette.Cliff * 0.72f);

                sink.Box(mid + Vector3.up * (p.Height - 0.16f), new Vector3(span, 0.32f, 1.15f),
                         rot, palette.Lip);

                // 테두리 원판 — **꼭짓점은 건너뛴다.** 양쪽 변이 같은 자리에 하나씩 놓으면
                // 원판이 겹쳐 그 자리에 선 배우의 관통 깊이가 두 배로 잡힌다.
                int n = Mathf.Max(2, Mathf.CeilToInt(len / 2.0f));
                for (int k = 1; k < n; k++)
                    sink.Blocker(p.Center + Vector3.Lerp(v0, v1, k / (float)n), 1.25f);
                sink.Blocker(p.Center + v0, 1.25f);
            }

            // ② 윗면
            for (float x = -p.Radius; x <= p.Radius; x += 2.2f)
            for (float z = -p.Radius; z <= p.Radius; z += 2.2f)
            {
                var world = p.Center + new Vector3(x, 0f, z);
                if (p.EdgeDistance(world) > 0f) continue;
                sink.Quad(new Vector3(x, p.Height + 0.02f, z), 2.2f, 2.2f,
                          sink.GroundColorAt(world) * 1.12f);
            }

            float rr = p.RampYaw * Mathf.Deg2Rad;
            var dir = new Vector3(Mathf.Sin(rr), 0f, Mathf.Cos(rr));
            var ramp = Quaternion.Euler(0f, p.RampYaw, 0f);
            float inner = p.Radius * 0.94f;

            // ③ 비탈 — 조각을 촘촘히 눕혀 매끈하게. 계단으로 쌓으면 턱 하나가 사람 키만 해진다
            const int slices = 34;
            for (int i = 0; i < slices; i++)
            {
                float t0 = i / (float)slices, t1 = (i + 1) / (float)slices;
                float tm = (t0 + t1) * 0.5f;
                float d0 = inner + p.RampLength * t0;
                float d1 = inner + p.RampLength * t1;
                float h = p.Height * (1f - tm);
                float w = Mathf.Lerp(p.RampTopWidth, p.RampBottomWidth, tm);
                var mid = dir * ((d0 + d1) * 0.5f);
                mid.y = h * 0.5f;
                sink.Box(mid, new Vector3(w, Mathf.Max(0.12f, h), (d1 - d0) * 1.35f), ramp,
                         palette.Ramp * (1f + (i % 2) * 0.06f));
            }

            // ④ 비탈 양옆 벽
            var side = ramp * Vector3.right;
            for (int sgn = -1; sgn <= 1; sgn += 2)
            {
                const int posts = 10;
                for (int i = 0; i < posts; i++)
                {
                    float t = (i + 0.5f) / posts;
                    float d = inner + p.RampLength * t;
                    float h = p.Height * (1f - t) + 1.1f;
                    float half = Mathf.Lerp(p.RampTopWidth, p.RampBottomWidth, t) * 0.5f + 0.85f;
                    var at = dir * d + side * (half * sgn);
                    sink.Box(new Vector3(at.x, h * 0.5f, at.z),
                             new Vector3(1.5f, h, p.RampLength / posts * 1.4f), ramp, palette.Cliff);
                    sink.Blocker(p.Center + at, 0.8f);
                }
            }

            // 위로 이어지는 길 — 올라선 뒤에도 어디로 들어왔는지 보인다
            for (float t = 0f; t <= 1f; t += 0.12f)
            {
                var at = dir * (p.Radius * (1f - t) * 0.9f);
                sink.Box(new Vector3(at.x, p.Height + 0.06f, at.z),
                         new Vector3(p.RampTopWidth, 0.12f, p.Radius * 0.16f), ramp, palette.Ramp);
            }
        }
    }
}
