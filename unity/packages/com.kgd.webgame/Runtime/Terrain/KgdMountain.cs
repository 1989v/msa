using System.Collections.Generic;
using Kgd.Art;
using Kgd.Motion;
using UnityEngine;

namespace Kgd.Terrain
{
    /// <summary>
    /// **산 하나** — 고지대(<see cref="KgdPlateau"/>)를 층층이 쌓아 만든 봉우리.
    /// 아홉 종의 Peak 에서 지형만 떼어 온 것이다(마지막 한 사람 PRD §10-1).
    ///
    /// **층마다 램프를 돌려 놓는다.** 걸어서만 오르면 정상까지 나선을 그리게 되고,
    /// 그래서 등반이 지름길이 된다 — 두 길의 값이 갈리지 않으면 등반을 넣을 이유가 없다.
    ///
    /// 게임이 얹는 것(소품·목표·보상)은 <see cref="AddProp"/> 로 **같은 충돌 격자**에
    /// 넣는다 — 격자를 두 개로 가르면 높이 판정이 한쪽을 못 보게 된다.
    /// </summary>
    public sealed class KgdMountain : IKgdGround, IKgdWall
    {
        /// <summary>산의 뼈대. 색과 시드만 바꾸면 같은 산을 두 번 오르게 된다 — 이 값들이 갈려야 다른 산이다.</summary>
        public struct Spec
        {
            public int Seed;
            public int Terraces;
            public float Rise, BaseRadius, TopRadius;
            /// <summary>반경이 줄어드는 곡선. 1 보다 작으면 아래가 급하게 좁아진다(넓은 기슭 + 뾰족한 정상).</summary>
            public float RadiusCurve;
            /// <summary>층마다 비탈이 돌아가는 각도. 클수록 걸어서 오르는 길이 길어진다.</summary>
            public float SpiralStep;
            /// <summary>지도 지름. 넓은 산에는 넓은 지도가 필요하다 — 기슭이 밖으로 삐져나간다.</summary>
            public float Diameter;
        }

        /// <summary>고도가 색으로 읽히는 팔레트. 기슭(Foot)→흙(Slope)→너덜(Scree)→눈(Snow).</summary>
        public struct Palette
        {
            public Color Foot, Slope, Scree, Snow;
            public Color Cliff, Lip, Ramp;
            /// <summary>씬 태양의 오일러 각. **씬과 같아야 한다** — 어긋나면 절벽이 그림자와 반대로 밝아진다.</summary>
            public Vector3 SunEuler;
        }

        public readonly struct Step
        {
            public readonly KgdPlateau Plate;
            public readonly float BaseY;
            public Step(KgdPlateau plate, float baseY) { Plate = plate; BaseY = baseY; }
            public float Top => BaseY + Plate.Height;
        }

        public float Diameter => _spec.Diameter;
        public float Rise => _spec.Rise;
        public int Terraces => _spec.Terraces;
        public float StepHeight => _spec.Rise / _spec.Terraces;

        public readonly List<Step> Steps = new();

        /// <summary>고지대가 놓은 원판. 지형 자체는 높이로 막으므로 참고용이다 — 게이트가 개수를 본다.</summary>
        public readonly List<(Vector3 pos, float radius)> Blockers = new();

        /// <summary>기슭 시작 자리 — 1층 비탈 입구 앞. 산을 올려다보는 자리다.</summary>
        public Vector3 StartPos { get; private set; }

        /// <summary>정상 한가운데.</summary>
        public Vector3 TopPos => new(0f, Rise, 0f);

        private readonly Spec _spec;
        private readonly Palette _pal;
        private readonly Transform _root;
        private readonly KgdObstacles _obstacles = new(8f);

        /// <summary>
        /// 팔각이라 대각선 경계가 Radius 의 이 배까지 뻗는다. 1층 반경을 지도 반폭에
        /// 가깝게 잡으면 대각선 경계 + 비탈 길이가 지도를 통째로 덮어 기슭이 사라진다.
        /// </summary>
        private const float Chamfer = 1.16f;

        public KgdMountain(Spec spec, Palette pal, Transform root)
        {
            _spec = spec;
            _pal = pal;
            _root = root;
            var rng = new System.Random(spec.Seed);
            BuildGround(rng);
            BuildTerraces();
            BuildSnow(rng);
        }

        // ── 질의 ────────────────────────────────────────────────────────────

        /// <summary>이 자리의 바닥 높이 — 지형과 얹힌 것 중 높은 쪽.</summary>
        public float HeightAt(Vector3 p)
        {
            float ground = TerrainHeightAt(p);
            float top = _obstacles.TopAt(p);
            return top > ground ? top : ground;
        }

        /// <summary>지형만. 소품을 놓을 때 쓴다 — 소품 위에 소품을 쌓지 않기 위해.</summary>
        public float TerrainHeightAt(Vector3 p)
        {
            for (int i = Steps.Count - 1; i >= 0; i--)
            {
                float h = Steps[i].Plate.HeightAt(p);
                if (h > 0f) return Steps[i].BaseY + h;
            }
            return 0f;
        }

        /// <summary>이 자리를 덮는 기둥의 윗면. 없으면 0.</summary>
        public float PropTopAt(Vector3 p) => _obstacles.TopAt(p);

        /// <summary>어느 층이든 비탈 위인가 — 걸어 오르는 유일한 길이라 소품으로 막으면 안 된다.</summary>
        public bool OnAnyRamp(Vector3 p)
        {
            foreach (var s in Steps)
                if (s.Plate.OnRamp(p)) return true;
            return false;
        }

        /// <summary>
        /// 붙을 벽이 앞에 있나. **비탈은 제외한다** — 걸어 오르는 길에 매달릴 이유가 없고,
        /// 허용하면 램프 옆면을 타고 판정 밖으로 나간다.
        /// </summary>
        public bool WallAt(Vector3 p, float reach, out float topY, out Vector3 inward)
        {
            topY = 0f;
            inward = Vector3.zero;
            for (int i = Steps.Count - 1; i >= 0; i--)
            {
                var s = Steps[i];
                float d = s.Plate.EdgeDistance(p);
                if (d < -0.4f || d > reach) continue;
                if (s.Top <= p.y + 0.5f) continue;        // 이미 그 층보다 높다
                if (s.BaseY > p.y + 0.6f) continue;       // 발밑이 아니라 허공에 뜬 층
                if (s.Plate.OnRamp(p)) continue;
                var c = s.Plate.Center;
                inward = new Vector3(c.x - p.x, 0f, c.z - p.z).normalized;
                topY = s.Top;
                return true;
            }
            // 지형에 붙을 곳이 없으면 게임이 얹은 기둥을 본다
            return _obstacles.WallAt(p, reach, out topY, out inward);
        }

        /// <summary>지면색 — 고도로 간다. 기슭→흙→너덜→눈.</summary>
        public Color GroundColorAt(Vector3 world) => GroundColorFor(HeightAt(world));

        public Color GroundColorFor(float y)
        {
            float t = Mathf.Clamp01(y / Mathf.Max(1f, Rise));
            if (t < 0.34f) return Color.Lerp(_pal.Foot, _pal.Slope, t / 0.34f);
            if (t < 0.72f) return Color.Lerp(_pal.Slope, _pal.Scree, (t - 0.34f) / 0.38f);
            return Color.Lerp(_pal.Scree, _pal.Snow, (t - 0.72f) / 0.28f);
        }

        // ── 게임이 얹는 것 ──────────────────────────────────────────────────

        /// <summary>기둥 하나를 충돌에 넣는다. 돌려받은 번호로 <see cref="RemoveProp"/> 한다.</summary>
        public int AddProp(Vector3 at, float radius, float height) => _obstacles.Add(at, radius, height);

        /// <summary>부서진 것을 충돌에서 뺀다 — 무너지는 동안 막고 있으면 벽이 남은 것과 같다.</summary>
        public void RemoveProp(int id) => _obstacles.Remove(id);

        // ── 생성 ────────────────────────────────────────────────────────────

        private void BuildGround(System.Random rng)
        {
            var mb = new KgdMesh();
            const int Cells = 20;
            float cell = Diameter / Cells;
            for (int x = 0; x < Cells; x++)
            for (int z = 0; z < Cells; z++)
            {
                var c = new Vector3((x + 0.5f - Cells * 0.5f) * cell, 0f, (z + 0.5f - Cells * 0.5f) * cell);
                mb.Quad(c, cell, cell, _pal.Foot * Mathf.Lerp(0.92f, 1.08f, (float)rng.NextDouble()));
            }
            KgdMat.Object("ground", mb.Build("ground"), _root, shadows: false, terrain: true);
        }

        /// <summary>층 반경. 곡선이 1 보다 작으면 **아래가 급하게 좁아져** 기슭 비탈이 길고 완만해진다.</summary>
        private float RadiusOf(int i) =>
            Mathf.Lerp(_spec.BaseRadius, _spec.TopRadius,
                       Mathf.Pow(i / (float)(Terraces - 1), _spec.RadiusCurve));

        private void BuildTerraces()
        {
            float baseY = 0f;
            for (int i = 0; i < Terraces; i++)
            {
                float radius = RadiusOf(i);

                // **비탈 길이는 아래층이 얼마나 넓은지가 정한다.** 반경 감소폭보다 길면
                // 비탈 입구가 아래층 밖 허공에서 시작해 걸어서는 그 층에 못 오른다.
                // 1층 아래에는 층이 없으므로 기슭 진입로는 걷기 좋은 길이로 직접 준다.
                float rampLength = i == 0
                    ? StepHeight * 3f
                    : (RadiusOf(i - 1) - radius) * Chamfer * 0.82f;

                var plate = new KgdPlateau
                {
                    Center = new Vector3(0f, baseY, 0f),
                    Radius = radius,
                    Chamfer = Chamfer,
                    Height = StepHeight,
                    // 층마다 돌린다 — 걸어 오르면 나선이 되고, 그래서 등반이 지름길이 된다
                    RampYaw = KgdPlateau.SnapRampYaw(45f + i * _spec.SpiralStep),
                    RampLength = rampLength,
                    // 윗면 격자는 반경에 비례해 키운다. 기본값 2.2 를 반경 190 에 쓰면
                    // 계단 한 장이 56,020 삼각형이 된다.
                    TopCell = Mathf.Max(2.2f, radius / 12f),
                    RampTopWidth = Mathf.Min(7f, rampLength * 0.3f),
                    RampBottomWidth = Mathf.Min(12f, rampLength * 0.5f),
                };
                Steps.Add(new Step(plate, baseY));
                BuildPlateau(plate, i);
                baseY += StepHeight;
            }

            // 기슭 — 1층 비탈 입구 바로 앞. 산을 올려다보는 자리에서 시작한다.
            var mouth = Steps[0].Plate.RampMouth;
            var flat = new Vector3(mouth.x, 0f, mouth.z);
            var start = flat + flat.normalized * 9f;
            start.y = HeightAt(start);
            StartPos = start;
        }

        private void BuildPlateau(KgdPlateau p, int index)
        {
            var mb = new KgdMesh();
            // **절벽도 고도로 갈린다.** 한 색이면 위에서 내려다볼 때 층이 안 읽힌다 —
            // 아래는 흙빛이 섞이고 위는 푸른 돌이 된다.
            float high = Mathf.Clamp01(p.Center.y / Rise);
            KgdPlateauBuilder.Build(p, new MountainSink(mb, this, p), new KgdPlateauPalette
            {
                // 층마다 결이 조금씩 다르다. 완전히 같으면 아무리 쌓아도 한 덩어리로 보인다
                Cliff = Color.Lerp(Color.Lerp(_pal.Cliff, _pal.Ramp, 0.32f), _pal.Cliff * 1.22f, high)
                        * (0.94f + 0.05f * ((index * 37) % 3)),
                Lip = Color.Lerp(_pal.Lip, _pal.Snow, high * 0.75f),
                Ramp = Color.Lerp(_pal.Ramp, _pal.Scree, high),
                // 땅과 만나는 자리를 어둡게 — 벽이 「박혀」 보인다. 산은 늘 켠다
                FootShade = 0.74f,
                ToLight = -(Quaternion.Euler(_pal.SunEuler) * Vector3.forward),
            });
            var go = KgdMat.Object($"terrace{index}", mb.Build($"terrace{index}"), _root, terrain: true);
            go.transform.position = p.Center;
        }

        /// <summary>
        /// 설선 위 눈더미. **위가 하얘지는 것을 색만으로 하면 평평해 보인다** —
        /// 덩어리가 있어야 「쌓인 것」으로 읽힌다.
        /// </summary>
        private void BuildSnow(System.Random rng)
        {
            var mb = new KgdMesh();
            int drifts = 0;
            for (int i = 0; i < Terraces; i++)
            {
                var step = Steps[i];
                if (step.Top < Rise * 0.62f) continue;   // 설선 아래
                float r = step.Plate.Radius;
                int n = 6 + (int)(r / 14f);
                for (int k = 0; k < n; k++)
                {
                    float a = (float)(rng.NextDouble() * Mathf.PI * 2.0);
                    float d = r * (0.35f + (float)rng.NextDouble() * 0.55f);
                    var at = new Vector3(Mathf.Cos(a) * d, step.Top + 0.1f, Mathf.Sin(a) * d);
                    float w = 3.5f + (float)rng.NextDouble() * 5f;
                    mb.Box(at + Vector3.up * 0.35f, new Vector3(w, 0.7f + (float)rng.NextDouble(), w * 0.7f),
                           Quaternion.Euler(0f, (float)rng.NextDouble() * 90f, 0f), _pal.Snow);
                    drifts++;
                }
            }
            if (drifts == 0) return;
            var go = KgdMat.Object("snow", mb.Build("snow"), _root, terrain: true);
            go.transform.position = Vector3.zero;
        }

        /// <summary>
        /// 램프 옆벽. 높이는 **그 자리의 램프 표면 높이**로 준다 — 램프는 비탈이라
        /// 아래쪽 볼은 낮고 위쪽 볼은 높다. 한 값으로 세우면 아래쪽에 보이지 않는 벽이 선다.
        /// </summary>
        private void AddRampCheek(Vector3 world, float radius, KgdPlateau plate)
        {
            float rr = plate.RampYaw * Mathf.Deg2Rad;
            float sin = Mathf.Sin(rr), cos = Mathf.Cos(rr);
            float along = (world.x - plate.Center.x) * sin + (world.z - plate.Center.z) * cos;
            var onAxis = new Vector3(plate.Center.x + sin * along, 0f, plate.Center.z + cos * along);
            float top = plate.HeightAt(onAxis);
            if (top <= 0.2f) return;   // 램프가 이미 지면에 닿은 구간 — 세울 벽이 없다
            _obstacles.Add(new Vector3(world.x, plate.Center.y, world.z), radius, top);
        }

        /// <summary>고지대를 이 산의 메시·충돌에 꽂는다. 모양 규칙은 빌더가 갖고 여기는 배선만 한다.</summary>
        private sealed class MountainSink : IKgdTerrainSink
        {
            private readonly KgdMesh _mb;
            private readonly KgdMountain _mountain;
            private readonly KgdPlateau _plate;
            public MountainSink(KgdMesh mb, KgdMountain mountain, KgdPlateau plate)
            { _mb = mb; _mountain = mountain; _plate = plate; }

            public void Quad(Vector3 center, float width, float depth, Color color) =>
                _mb.Quad(center, width, depth, color);

            public void Face(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color color) =>
                _mb.Face(a, b, c, d, color);

            public void Blocker(Vector3 worldPosition, float radius)
            {
                _mountain.Blockers.Add((worldPosition, radius));
                // **램프 볼만 골라 충돌에 넣는다.** 빌더는 볼을 0.85, 팔각 테두리를 1.25 로
                // 놓는다. 테두리는 높이 판정이 이미 막으므로 넣으면 절벽에 다가서지도 못한다.
                // 볼은 그려진 옆벽인데 높이 함수가 못 잡아, 안 넣으면 램프 옆으로 걸어 들어간다.
                if (radius < 1.0f) _mountain.AddRampCheek(worldPosition, radius, _plate);
            }

            public Color GroundColorAt(Vector3 worldPosition) => _mountain.GroundColorAt(worldPosition);
        }
    }
}
