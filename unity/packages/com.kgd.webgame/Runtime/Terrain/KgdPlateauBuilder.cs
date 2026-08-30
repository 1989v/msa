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

            // ① 팔각 절벽 — **각기둥으로 세운다.**
            //
            // 변마다 상자를 놓고 꼭짓점에 기둥을 세우던 방식을 버렸다. 상자는 서로 겹쳐야
            // 이음매가 메워지는데, 겹치면 ⓐ 45° 변에서 축 정렬 기둥의 모서리가 삐져나와
            // 톱니로 보이고 ⓑ 같은 높이의 윗면끼리 깊이 싸움을 해 가까이 가면 깜빡인다.
            // 면을 직접 이어 붙이면 겹치는 곳이 한 군데도 없어 둘 다 사라진다.
            var lipOuter = new Vector3[8];
            var lipInner = new Vector3[8];
            for (int e = 0; e < 8; e++)
            {
                lipOuter[e] = corners[e] * 1.04f + Vector3.up * (p.Height + 0.10f);
                lipInner[e] = corners[e] * 0.90f + Vector3.up * (p.Height + 0.10f);
            }

            for (int e = 0; e < 8; e++)
            {
                var v0 = corners[e];
                var v1 = corners[(e + 1) % 8];
                var mid = (v0 + v1) * 0.5f;
                float midYaw = Mathf.Atan2(mid.x, mid.z) * Mathf.Rad2Deg;
                bool isRamp = Mathf.Abs(Mathf.DeltaAngle(midYaw, p.RampYaw)) < 22.5f;

                // 윗입술은 램프 면에서도 이어진다 — 끊기면 그 자리만 테두리가 사라진 것처럼 보인다
                sink.Face(lipOuter[e], lipOuter[(e + 1) % 8], lipInner[(e + 1) % 8], lipInner[e],
                          palette.Lip);

                if (isRamp) continue;   // 램프가 난 면은 벽을 세우지 않는다

                // 바깥 면 — 밑에서 위로. 변마다 색을 아주 조금씩 달리해 면이 갈려 보이게 한다
                var a = v0;
                var b = v1;
                var c = v1 + Vector3.up * p.Height;
                var d = v0 + Vector3.up * p.Height;
                sink.Face(a, b, c, d, palette.Cliff * (0.92f + 0.04f * (e % 3)));

                int n = Mathf.Max(2, Mathf.CeilToInt(Vector3.Distance(v0, v1) / 2.0f));
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
                // **위가 더 밝다.** 주변 지면과 같은 밝기면 절벽 옆면 말고는 높이를 알 길이
                // 없어, 위에서 내려다보는 각도에서 평지처럼 보인다. 원작도 고지대를 다른
                // 색으로 칠해 한눈에 갈리게 한다.
                sink.Quad(new Vector3(x, p.Height + 0.02f, z), 2.2f, 2.2f,
                          sink.GroundColorAt(world) * 1.42f);
            }

            float rr = p.RampYaw * Mathf.Deg2Rad;
            var dir = new Vector3(Mathf.Sin(rr), 0f, Mathf.Cos(rr));
            var ramp = Quaternion.Euler(0f, p.RampYaw, 0f);
            var side = ramp * Vector3.right;
            float inner = p.Radius * 0.94f;

            // ③ 비탈 — **면 하나로 편다.**
            //
            // 조각을 쌓아 만들면 층마다 턱이 지고 밝기가 갈려 격자무늬가 된다(실제로 그렇게 보였다).
            // 네 꼭짓점을 직접 주면 경사가 한 장으로 이어지고, HeightAt 의 선형 경사와도
            // 정확히 같아진다 — 근사가 아니라 같은 면 위를 걷는다.
            float topHalf = p.RampTopWidth * 0.5f;
            float botHalf = p.RampBottomWidth * 0.5f;
            var topIn  = dir * inner + Vector3.up * p.Height;
            var botOut = dir * (inner + p.RampLength);
            sink.Face(topIn - side * topHalf, topIn + side * topHalf,
                      botOut + side * botHalf, botOut - side * botHalf, palette.Ramp);

            // 비탈 양옆 얇은 턱 — 경사면과 옆벽 사이를 메워 틈이 보이지 않게 한다
            for (int sgn = -1; sgn <= 1; sgn += 2)
            {
                var t0 = topIn + side * (topHalf * sgn);
                var b0 = botOut + side * (botHalf * sgn);
                sink.Face(t0, t0 + Vector3.up * 0.18f, b0 + Vector3.up * 0.18f, b0,
                          palette.Ramp * 0.86f);
            }

            // ④ 비탈 양옆 벽 — **이어진 면으로.**
            //
            // 기둥을 여러 개 세우면 사이가 벌어지거나 겹쳐서 톱니가 된다. 위·아래 두 선을
            // 따라 사각을 이어 붙이면 이웃한 면이 변을 공유해 틈도 겹침도 없다.
            const int wall = 12;
            for (int sgn = -1; sgn <= 1; sgn += 2)
            {
                Vector3 prevBase = default, prevTop = default;
                for (int i = 0; i <= wall; i++)
                {
                    float t = i / (float)wall;
                    float d = inner + p.RampLength * t;
                    float half = Mathf.Lerp(p.RampTopWidth, p.RampBottomWidth, t) * 0.5f + 0.9f;
                    float rampY = p.Height * (1f - t);          // 이 자리의 비탈 높이
                    var at = dir * d + side * (half * sgn);
                    var b = new Vector3(at.x, 0f, at.z);
                    var tp = new Vector3(at.x, rampY + 1.2f, at.z);   // 비탈보다 늘 조금 높다

                    if (i > 0)
                    {
                        // 바깥 면 — 감는 방향이 좌우에 따라 뒤집혀야 앞면이 밖을 본다
                        if (sgn > 0) sink.Face(prevBase, b, tp, prevTop, palette.Cliff * 0.96f);
                        else sink.Face(b, prevBase, prevTop, tp, palette.Cliff * 0.96f);
                        // 윗면 — 걷는 쪽에서 벽 두께가 보인다
                        var inA = prevTop - side * (1.3f * sgn);
                        var inB = tp - side * (1.3f * sgn);
                        if (sgn > 0) sink.Face(prevTop, tp, inB, inA, palette.Lip * 0.9f);
                        else sink.Face(tp, prevTop, inA, inB, palette.Lip * 0.9f);
                        sink.Blocker(p.Center + (at + prevBase - b) * 0.5f + at * 0.5f, 0.85f);
                    }
                    prevBase = b;
                    prevTop = tp;
                }
            }

            // 위로 이어지는 길 — **면 하나.** 얇은 상자를 여러 개 놓았더니 위에서 볼 때
            // 사다리 같은 격자무늬가 됐다. 올라선 뒤에도 어디로 들어왔는지만 보이면 된다.
            var pathTop = dir * (p.Radius * 0.06f) + Vector3.up * (p.Height + 0.05f);
            var pathBot = dir * (inner * 0.98f) + Vector3.up * (p.Height + 0.05f);
            float pathHalf = p.RampTopWidth * 0.45f;
            sink.Face(pathTop - side * pathHalf, pathTop + side * pathHalf,
                      pathBot + side * pathHalf, pathBot - side * pathHalf, palette.Ramp * 0.92f);
        }
    }
}
