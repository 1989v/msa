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
            // **살짝만 굽는다.** 셰이더가 실시간으로 다시 어둡히므로 여기서 0.66 까지 내리면
            // 빛 반대편 면이 둘을 곱해 검게 됐다(실제 화면: 벽 가까이서 반쪽이 검정).
            // 면끼리 갈려 보일 만큼만 남긴다.
            float k = 0.86f + 0.20f * Mathf.Clamp01(Vector3.Dot(n.normalized, toLight) * 0.5f + 0.5f);
            return c * k;
        }

        /// <summary>
        /// 면 하나를 **바깥이 어느 쪽인지 명시해서** 놓는다.
        ///
        /// 꼭짓점 순서를 손으로 맞추다 절벽 바깥면의 법선이 안쪽을, 비탈면 법선이 아래를
        /// 향해 통째로 뒷면이 됐다 — 화면에서는 「검은 판」으로 보였다. 방향을 주면 여기서
        /// 뒤집으므로 그 부류의 실수가 아예 생기지 않는다.
        /// </summary>
        /// <summary>
        /// 세로면(절벽·옆벽) 전용 — 아래 꼭짓점 둘(a·b), 위 꼭짓점 둘(c·d) 순서를 요구한다.
        /// 팔레트의 <see cref="KgdPlateauPalette.FootShade"/> 가 1 미만이면 밑동 밴드를 갈라
        /// 어둡게 깐다. 땅과 만나는 자리가 어두워야 벽이 「박혀」 보인다(접촉 음영).
        /// </summary>
        private static void WallQuad(IKgdTerrainSink sink, Vector3 a, Vector3 b, Vector3 c, Vector3 d,
                                     Color color, Vector3 outward, KgdPlateauPalette palette)
        {
            float shade = palette.FootShade <= 0f ? 1f : palette.FootShade;
            float height = Mathf.Max(c.y - a.y, d.y - b.y);
            if (shade >= 0.999f || height < 1.2f)
            {
                Quad(sink, a, b, c, d, color, outward, palette.ToLight);
                return;
            }
            // 밴드는 낮게 — 사람 무릎 언저리. 절벽 높이에 비례시키면 큰 절벽에서 띠가 벽만 해진다
            float band = Mathf.Min(1.1f, height * 0.28f);
            var ma = a + Vector3.up * band;
            var mb = b + Vector3.up * band;
            Quad(sink, a, b, mb, ma, color * shade, outward, palette.ToLight);
            Quad(sink, ma, mb, c, d, color, outward, palette.ToLight);
        }

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


        /// <summary>
        /// 램프가 난 면에서 **램프가 덮지 못한 양옆**을 벽으로 채운다.
        /// 남는 조각이 <see cref="MinFlank"/> 보다 짧으면 그리지 않는다 — 입구 옆에
        /// 손톱만 한 벽이 서면 「끊긴 테두리」라는 입구 신호가 오히려 흐려진다.
        /// </summary>
        private const float MinFlank = 1.5f;

        /// <summary>
        /// 비탈 옆벽이 비탈 바깥으로 나온 두께.
        ///
        /// **입구를 뚫는 폭과 옆벽 자리가 같은 값에서 나와야 한다.** 절벽은 아래쪽 폭으로
        /// 뚫고 옆벽은 위쪽 폭 + 이 값으로 서던 때는, 그 차이가 절벽 높이만큼 세로 틈이 되어
        /// 「언덕 면이 절벽에서 조금 떨어져 보인다」가 됐다 (아홉 종, 2026-09-02).
        /// </summary>
        private const float FlankOut = 0.9f;

        /// <summary>
        /// 절벽에 뚫는 입구의 반폭 — **걸어 오르는 폭 그대로.**
        ///
        /// 옆벽 두께까지 더해 뚫던 때는 비탈 바닥이 없는 0.9 짜리 틈이 양옆에 남았다.
        /// 옆벽은 그 바깥에 서므로 정면에서는 날처럼 얇아 안 가려 주고, 그 틈으로 안이 보여
        /// 「언덕이 절벽에서 조금 떨어져 보인다」가 됐다 (아홉 종, 2026-09-02).
        ///
        /// 딱 걸어 오르는 폭만 뚫으면 남는 틈이 없다. 옆벽은 절벽 안에 묻히는데,
        /// 아래로 갈수록 절벽이 낮아져 드러나면서 깔때기가 된다.
        /// </summary>
        private static float MouthHalf(KgdPlateau p) => p.RampTopWidth * 0.5f;

        private static void RampFlanks(KgdPlateau p, IKgdTerrainSink sink, KgdPlateauPalette palette,
                                       Vector3 v0, Vector3 v1,
                                       Vector3 lo0, Vector3 lo1, Vector3 li0, Vector3 li1)
        {
            float rr = p.RampYaw * Mathf.Deg2Rad;
            float sin = Mathf.Sin(rr), cos = Mathf.Cos(rr);
            // OnRamp 와 **같은 식**으로 잰다. 다른 식을 쓰면 그려진 벽과 걷는 판정이 어긋난다.
            float Lat(Vector3 v) => v.x * cos - v.z * sin;

            float half = MouthHalf(p);
            float a = Mathf.InverseLerp(Lat(v0), Lat(v1), -half);
            float b = Mathf.InverseLerp(Lat(v0), Lat(v1), half);
            if (a > b) (a, b) = (b, a);

            float span = Vector3.Distance(v0, v1);
            if (a * span >= MinFlank) Segment(0f, a);
            if ((1f - b) * span >= MinFlank) Segment(b, 1f);

            void Segment(float t0, float t1)
            {
                var c0 = Vector3.Lerp(v0, v1, t0);
                var c1 = Vector3.Lerp(v0, v1, t1);
                var outward = new Vector3((c0.x + c1.x) * 0.5f, 0f, (c0.z + c1.z) * 0.5f).normalized;

                Quad(sink, Vector3.Lerp(lo0, lo1, t0), Vector3.Lerp(lo0, lo1, t1),
                     Vector3.Lerp(li0, li1, t1), Vector3.Lerp(li0, li1, t0),
                     palette.Lip, Vector3.up, palette.ToLight);
                WallQuad(sink, c0, c1, c1 + Vector3.up * p.Height, c0 + Vector3.up * p.Height,
                     palette.Cliff, outward, palette);

                int n = Mathf.Max(2, Mathf.CeilToInt(Vector3.Distance(c0, c1) / 2.0f));
                for (int k = 0; k <= n; k++)
                    sink.Blocker(p.Center + Vector3.Lerp(c0, c1, k / (float)n), 1.25f);
            }
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
                if (isRamp)
                {
                    // **면을 통째로 건너뛰면 안 된다.** 램프 폭이 면 길이를 못 채우는 크기에서는
                    // 그 차이가 그대로 절벽의 구멍이 된다 — 반경 190 짜리 지형 계단에서
                    // 면 119 · 램프 12 라 107 유닛이 뚫려 안쪽이 다 보였다(아홉 종, 2026-09-01).
                    // 램프가 면을 거의 덮는 크기(반경 10~15 짜리 언덕)에서는 남는 조각이
                    // MinFlank 보다 짧아 그려지지 않으므로 예전 모양 그대로다.
                    RampFlanks(p, sink, palette, v0, v1, lipOuter[e], lipOuter[(e + 1) % 8],
                               lipInner[e], lipInner[(e + 1) % 8]);
                    continue;
                }

                Quad(sink, lipOuter[e], lipOuter[(e + 1) % 8], lipInner[(e + 1) % 8], lipInner[e],
                     palette.Lip, Vector3.up, palette.ToLight);

                // 바깥 면 — 밑에서 위로. 변마다 색을 아주 조금씩 달리해 면이 갈려 보이게 한다
                var outward = new Vector3(mid.x, 0f, mid.z).normalized;
                WallQuad(sink, v0, v1, v1 + Vector3.up * p.Height, v0 + Vector3.up * p.Height,
                     palette.Cliff * (0.94f + 0.04f * (e % 3)), outward, palette);

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
            float cell = Mathf.Max(0.5f, p.TopCell);
            for (float x = -p.Radius; x <= p.Radius; x += cell)
            for (float z = -p.Radius; z <= p.Radius; z += cell)
            {
                var world = p.Center + new Vector3(x, 0f, z);
                if (p.EdgeDistance(world) > 0f) continue;
                // **위가 더 밝다.** 주변 지면과 같은 밝기면 절벽 옆면 말고는 높이를 알 길이
                // 없어, 위에서 내려다보는 각도에서 평지처럼 보인다. 원작도 고지대를 다른
                // 색으로 칠해 한눈에 갈리게 한다.
                sink.Quad(new Vector3(x, p.Height + 0.02f, z), cell, cell,
                          sink.GroundColorAt(world) * 1.42f);
            }

            float rr = p.RampYaw * Mathf.Deg2Rad;
            var dir = new Vector3(Mathf.Sin(rr), 0f, Mathf.Cos(rr));
            var ramp = Quaternion.Euler(0f, p.RampYaw, 0f);
            var side = ramp * Vector3.right;
            // 테두리가 실제로 어디인지 재서 시작한다 — 중심 거리로 잡으면 지면에서 뜬다
            float inner = p.BoundaryAlong(dir);

            // **기울어진 만큼 안으로 밀어 넣는다.**
            //
            // 절벽 변은 직선이고 비탈 윗변은 dir 에 수직이다. 램프 방향이 그 변의 법선과
            // 어긋나면(최대 22.5°) 윗변의 한쪽 끝은 절벽선 **바깥으로 떠 있고** 반대쪽은
            // 파묻힌다 — 뜬 쪽이 「언덕 면이 떨어져 보인다」의 정체다.
            //
            // 반폭 s 인 점이 절벽선에서 벗어나는 거리는 s·sinθ 이고, dir 로 δ 만큼 들어가면
            // δ·cosθ 만큼 줄어든다. 그래서 δ = 반폭·tanθ 이면 어느 점도 밖으로 안 나온다.
            float tuck = 0f;
            {
                float bestDot = -1f;
                for (int e = 0; e < 8; e++)
                {
                    var m = (corners[e] + corners[(e + 1) % 8]) * 0.5f;
                    var n = new Vector3(m.x, 0f, m.z).normalized;
                    float d = Vector3.Dot(n, dir);
                    if (d > bestDot) bestDot = d;
                }
                float cos = Mathf.Clamp(bestDot, 0.3f, 1f);
                float tan = Mathf.Sqrt(Mathf.Max(0f, 1f - cos * cos)) / cos;
                tuck = MouthHalf(p) * tan + 0.06f;   // 0.06 은 실선이 안 보이게 하는 여유
            }

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

            // **입구를 메우는 다리.** 비탈 윗변은 dir 에 수직인데 절벽 변은 직선이라,
            // 기울어진 만큼 윗변 한쪽이 절벽선 바깥으로 뜬다. 비탈 자체를 밀어 넣으면
            // 걷는 면(HeightAt)과 어긋나므로, 고원 높이의 조각을 안쪽으로 덧대 그 쐐기를 덮는다.
            {
                float mh = MouthHalf(p);
                var bIn = dir * (inner - tuck) + Vector3.up * p.Height;
                var bOut = dir * inner + Vector3.up * p.Height;
                Quad(sink, bIn - side * mh, bIn + side * mh,
                     bOut + side * mh, bOut - side * mh, palette.Lip, Vector3.up, palette.ToLight);
            }

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
                    // 옆벽도 다리만큼 안에서 시작한다 — 안 그러면 다리 옆으로 안이 보인다
                    float d = inner - tuck + (p.RampLength + tuck) * t;
                    float half = Mathf.Lerp(p.RampTopWidth, p.RampBottomWidth, t) * 0.5f + FlankOut;
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
                        WallQuad(sink, prevBase, b, tp, prevTop, palette.Cliff, side * sgn, palette);
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
