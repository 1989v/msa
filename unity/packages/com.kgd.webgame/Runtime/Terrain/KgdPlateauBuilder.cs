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
        /// <summary>
        /// 면 하나의 음영. **Face 는 색을 그대로 받으므로 여기서 구워 넣어야 한다** —
        /// 빼먹으면 절벽 바깥면이 통째로 새까맣게 나와 「구멍」처럼 보인다.
        /// 빛 방향은 팔레트가 준다: 게임마다 태양이 다르다.
        /// </summary>
        private static Color Shade(Color c, Vector3 n, Vector3 toLight)
        {
            float k = 0.66f + 0.44f * Mathf.Clamp01(Vector3.Dot(n.normalized, toLight) * 0.5f + 0.5f);
            return c * k;
        }

        /// <summary>
        /// 면 하나를 **바깥이 어느 쪽인지 명시해서** 놓는다.
        ///
        /// 꼭짓점 순서를 손으로 맞추다 절벽 바깥면의 법선이 안쪽을, 비탈면 법선이 아래를
        /// 향해 통째로 뒷면이 됐다 — 화면에서는 「검은 판」으로 보였다. 방향을 주면 여기서
        /// 뒤집으므로 그 부류의 실수가 아예 생기지 않는다.
        /// </summary>
        private static void Quad(IKgdTerrainSink sink, Vector3 a, Vector3 b, Vector3 c, Vector3 d,
                                 Color color, Vector3 outward, Vector3 toLight)
        {
            var n = Vector3.Cross(b - a, d - a);
            if (Vector3.Dot(n, outward) < 0f)
            {
                (b, d) = (d, b);
                n = -n;
            }
            sink.Face(a, b, c, d, Shade(color, n, toLight));
        }


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

                // **입구에서는 테두리를 끊는다.** 이어 놓았더니 모델에서 가장 밝은 띠가
                // 입구를 가로질러, 마루가 그 아래로 내려가는 바람에 「어디로 오르는지」가
                // 가려졌다 — 원작에서도 램프 자리는 절벽 선이 끊겨 있고, 그 끊긴 자리가
                // 곧 입구 표시다. 램프 볼(cheek)은 옆벽 윗면이 같은 색으로 받는다.
                if (isRamp) continue;

                Quad(sink, lipOuter[e], lipOuter[(e + 1) % 8], lipInner[(e + 1) % 8], lipInner[e],
                     palette.Lip, Vector3.up, palette.ToLight);

                // 바깥 면 — 밑에서 위로. 변마다 색을 아주 조금씩 달리해 면이 갈려 보이게 한다
                var outward = new Vector3(mid.x, 0f, mid.z).normalized;
                Quad(sink, v0, v1, v1 + Vector3.up * p.Height, v0 + Vector3.up * p.Height,
                     palette.Cliff * (0.94f + 0.04f * (e % 3)), outward, palette.ToLight);

                int n = Mathf.Max(2, Mathf.CeilToInt(Vector3.Distance(v0, v1) / 2.0f));
                for (int k = 1; k < n; k++)
                    sink.Blocker(p.Center + Vector3.Lerp(v0, v1, k / (float)n), 1.25f);
                sink.Blocker(p.Center + v0, 1.25f);
                // 램프 면은 건너뛰므로 그 앞 변의 v1 에는 아무도 원판을 놓지 않는다 —
                // 지금은 이웃 원판끼리 0.026 차이로 겨우 막고 있어, 폭이나 반경을 조금만
                // 손대면 조용히 열린다. 여기서 못을 박는다.
                bool nextIsRamp = Mathf.Abs(Mathf.DeltaAngle(
                    Mathf.Atan2((v1.x + corners[(e + 2) % 8].x) * 0.5f,
                                (v1.z + corners[(e + 2) % 8].z) * 0.5f) * Mathf.Rad2Deg,
                    p.RampYaw)) < 22.5f;
                if (nextIsRamp) sink.Blocker(p.Center + v1, 1.25f);
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
            // 테두리가 실제로 어디인지 재서 시작한다 — 중심 거리로 잡으면 지면에서 뜬다
            float inner = p.BoundaryAlong(dir);

            // ③ 비탈 — **면 하나로 편다.**
            //
            // 조각을 쌓아 만들면 층마다 턱이 지고 밝기가 갈려 격자무늬가 된다(실제로 그렇게 보였다).
            // 네 꼭짓점을 직접 주면 경사가 한 장으로 이어지고, HeightAt 의 선형 경사와도
            // 정확히 같아진다 — 근사가 아니라 같은 면 위를 걷는다.
            float topHalf = p.RampTopWidth * 0.5f;
            float botHalf = p.RampBottomWidth * 0.5f;
            var topIn  = dir * inner + Vector3.up * p.Height;
            var botOut = dir * (inner + p.RampLength);
            Quad(sink, topIn - side * topHalf, topIn + side * topHalf,
                 botOut + side * botHalf, botOut - side * botHalf, palette.Ramp * 1.25f, Vector3.up, palette.ToLight);

            // 비탈 양옆 얇은 턱 — 경사면과 옆벽 사이를 메워 틈이 보이지 않게 한다
            for (int sgn = -1; sgn <= 1; sgn += 2)
            {
                var t0 = topIn + side * (topHalf * sgn);
                var b0 = botOut + side * (botHalf * sgn);
                Quad(sink, t0, t0 + Vector3.up * 0.18f, b0 + Vector3.up * 0.18f, b0,
                     palette.Ramp * 0.9f, side * sgn, palette.ToLight);
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
                    // **비탈을 따라 낮아지되 고원을 넘지 않는다.** 램프는 절벽에 낸 홈이라
                    // 위쪽에서는 절벽 높이로 이어지고 아래로 갈수록 사라져야 한다.
                    // 끝까지 고원 높이로 세웠더니 들판 한복판에 거대한 판이 튀어나왔고,
                    // 반대로 +1.2 를 그냥 더했더니 위쪽에서 고원보다 높아져 칼날이 됐다.
                    var at = dir * d + side * (half * sgn);
                    float topY = Mathf.Min(p.Height, p.Height * (1f - t) + 1.0f);
                    var b = new Vector3(at.x, 0f, at.z);
                    var tp = new Vector3(at.x, topY, at.z);

                    if (i > 0)
                    {
                        // 바깥 면 — 감는 방향이 좌우에 따라 뒤집혀야 앞면이 밖을 본다
                        Quad(sink, prevBase, b, tp, prevTop, palette.Cliff, side * sgn, palette.ToLight);
                        // 윗면 — 걷는 쪽에서 벽 두께가 보인다
                        var inA = prevTop - side * (1.3f * sgn);
                        var inB = tp - side * (1.3f * sgn);
                        Quad(sink, prevTop, tp, inB, inA, palette.Lip, Vector3.up, palette.ToLight);
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
            Quad(sink, pathTop - side * pathHalf, pathTop + side * pathHalf,
                 pathBot + side * pathHalf, pathBot - side * pathHalf, palette.Ramp, Vector3.up, palette.ToLight);
        }
    }
}
