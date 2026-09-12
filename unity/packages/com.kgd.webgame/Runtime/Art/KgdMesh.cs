using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Art
{
    /// <summary>
    /// 아틀라스 한 칸을 가리키는 표면. <see cref="KgdMesh.Use"/> 로 걸어 두면 그 뒤에 그리는
    /// 도형이 전부 그 무늬를 쓴다.
    ///
    /// <para><b>Scale 은 월드 1 유닛이 무늬 몇 번인가</b>이다 — 도형 크기가 아니라 월드 길이로
    /// 재므로 큰 벽과 작은 상자가 같은 결을 갖는다. 도형마다 0..1 로 펴면 큰 면에서 무늬가
    /// 늘어나 뭉개진다.</para>
    /// </summary>
    public struct KgdSurface
    {
        public Vector2 Tile;
        public float Scale;

        public KgdSurface(Vector2 tile, float scale) { Tile = tile; Scale = scale; }

        /// <summary>무늬 없음 — 아틀라스 0번 칸(민무늬)을 한 점만 읽는다.</summary>
        public static readonly KgdSurface None = new(Vector2.zero, 0f);
    }

    /// <summary>
    /// 도형을 쌓아 메시 하나를 만든다. 정점마다 색·법선·**UV·탄젠트**를 싣는다 —
    /// UV 가 없으면 셰이더의 텍스처 슬롯이 살아 있어도 모든 정점이 같은 텍셀 하나를 읽어
    /// 표면이 통째로 단색 판이 된다(실제로 그 상태로 오래 돌았다).
    ///
    /// **게임이 상속해서 이름만 바꿔 쓸 수 있다** — 호출부가 수백 군데라 타입 이름을
    /// 바꾸면 그만큼 고쳐야 한다. 로직은 여기 한 벌만 둔다.
    /// </summary>
    public class KgdMesh
    {
        private readonly List<Vector3> _v = new();
        private readonly List<Vector3> _n = new();
        private readonly List<Color> _c = new();
        private readonly List<Vector2> _uv = new();
        private readonly List<Vector2> _tile = new();
        private readonly List<Vector4> _tan = new();
        private readonly List<int> _t = new();

        private KgdSurface _surf = KgdSurface.None;

        public int VertexCount => _v.Count;

        /// <summary>지금까지 넣은 정점 수. <see cref="Shade"/> 의 시작점으로 쓴다.</summary>
        public int Mark => _v.Count;

        /// <summary>면 밝기 — 위 / 아래 / 옆 네 방향. 태양이 위에서 비스듬히 오는 것을 흉내낸다.</summary>
        private static readonly float[] FaceShade = { 1.00f, 0.86f, 1.14f, 0.62f, 0.92f, 0.78f };

        /// <summary>이 뒤로 그리는 도형의 표면 무늬를 정한다.</summary>
        public KgdMesh Use(KgdSurface surface) { _surf = surface; return this; }

        /// <summary>
        /// 밑동을 어둡게 깎는다 — 형태가 부피로 읽히게 하는 가장 싼 수단이다.
        /// 방향광 하나로는 아래위가 같은 밝기라 도형이 판으로 보인다.
        /// </summary>
        /// <param name="from"><see cref="Mark"/> 로 받아 둔 시작 정점.</param>
        public KgdMesh Shade(int from, float baseY, float span, float strength)
        {
            if (span <= 0.0001f) return this;
            for (int i = Mathf.Max(0, from); i < _c.Count; i++)
            {
                float k = Mathf.Clamp01((_v[i].y - baseY) / span);
                float f = Mathf.Lerp(1f - strength, 1f, k);
                var c = _c[i];
                _c[i] = new Color(c.r * f, c.g * f, c.b * f, c.a);
            }
            return this;
        }

        public KgdMesh Box(Vector3 center, Vector3 size, Color color, float glow = 0f)
            => Box(center, size, Quaternion.identity, color, glow);

        public KgdMesh Box(Vector3 center, Vector3 size, Quaternion rot, Color color, float glow = 0f)
        {
            Vector3 h = size * 0.5f;
            // 앞 뒤 위 아래 오른 왼
            Vector3[] normals =
            {
                Vector3.forward, Vector3.back, Vector3.up, Vector3.down, Vector3.right, Vector3.left
            };
            for (int f = 0; f < 6; f++)
            {
                Vector3 n = normals[f];
                Vector3 u = f is 2 or 3 ? Vector3.right : (f is 4 or 5 ? Vector3.forward : Vector3.right);
                Vector3 w = Vector3.Cross(n, u);
                Vector3 nu = Vector3.Scale(u, h);
                Vector3 nw = Vector3.Scale(w, h);
                Vector3 nn = Vector3.Scale(n, h);

                int b = _v.Count;
                Color shaded = color * FaceShade[f];
                shaded.a = glow;

                Vector3 wu = rot * u, ww = rot * w, wn = rot * n;
                AddPlanar(center + rot * (nn - nu - nw), wn, shaded, wu, ww);
                AddPlanar(center + rot * (nn + nu - nw), wn, shaded, wu, ww);
                AddPlanar(center + rot * (nn + nu + nw), wn, shaded, wu, ww);
                AddPlanar(center + rot * (nn - nu + nw), wn, shaded, wu, ww);

                _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }
            return this;
        }

        /// <summary>위아래 크기가 다른 사각기둥 — 다리·팔·나무 몸통처럼 굵기가 변하는 것에 쓴다.</summary>
        public KgdMesh Taper(Vector3 bottom, Vector3 top, float bottomWidth, float topWidth,
                                 Color color, float glow = 0f)
        {
            Vector3 axis = (top - bottom).normalized;
            Vector3 side = Vector3.Cross(axis, Mathf.Abs(axis.y) > 0.95f ? Vector3.forward : Vector3.up).normalized;
            Vector3 fwd = Vector3.Cross(side, axis);

            float hb = bottomWidth * 0.5f, ht = topWidth * 0.5f;
            Vector3[] bottomRing =
            {
                bottom - side * hb - fwd * hb, bottom + side * hb - fwd * hb,
                bottom + side * hb + fwd * hb, bottom - side * hb + fwd * hb
            };
            Vector3[] topRing =
            {
                top - side * ht - fwd * ht, top + side * ht - fwd * ht,
                top + side * ht + fwd * ht, top - side * ht + fwd * ht
            };

            for (int i = 0; i < 4; i++)
            {
                int j = (i + 1) % 4;
                Vector3 n = Vector3.Cross(topRing[i] - bottomRing[i], bottomRing[j] - bottomRing[i]).normalized;
                Vector3 tanDir = (bottomRing[j] - bottomRing[i]).normalized;
                Color shaded = color * (0.72f + 0.14f * i);
                shaded.a = glow;
                int b = _v.Count;
                AddPlanar(bottomRing[i], n, shaded, tanDir, axis);
                AddPlanar(bottomRing[j], n, shaded, tanDir, axis);
                AddPlanar(topRing[j], n, shaded, tanDir, axis);
                AddPlanar(topRing[i], n, shaded, tanDir, axis);
                _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }

            // 위 뚜껑만 — 아래는 지면·다른 부위에 가려 보이지 않는다
            int cap = _v.Count;
            Color capColor = color * 1.14f;
            capColor.a = glow;
            for (int i = 0; i < 4; i++) AddPlanar(topRing[i], axis, capColor, side, fwd);
            _t.Add(cap); _t.Add(cap + 2); _t.Add(cap + 1);
            _t.Add(cap); _t.Add(cap + 3); _t.Add(cap + 2);
            return this;
        }

        /// <summary>
        /// 네 꼭짓점이 제각각인 면 하나(a→b→c→d, 시계 반대). 비탈처럼 **기울고 폭이 변하는**
        /// 면에 쓴다 — 상자를 여러 개 쌓아 흉내 내면 층마다 턱과 밝기 차가 생겨 격자무늬가 된다.
        /// </summary>
        public KgdMesh Face(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color color, float glow = 0f)
        {
            // **퇴화 사각형을 견딘다.** 부채꼴을 (중심, p0, p1, 중심) 으로 그리면 d−a 가 0 이라
            // 법선이 NaN 이 되고, 그 면은 화면에서 **하얗게 탄다** — 성문 앞마당이 지름 15 유닛짜리
            // 흰 원으로 보이던 것이 이것이었다.
            Vector3 e1 = b - a, e2 = d - a;
            if (e2.sqrMagnitude < 1e-10f) e2 = c - b;
            if (e1.sqrMagnitude < 1e-10f) e1 = c - d;
            Vector3 n = Vector3.Cross(e1, e2).normalized;
            if (n.sqrMagnitude < 0.5f) n = Vector3.up;
            Vector3 u = e1.sqrMagnitude > 1e-8f ? e1.normalized : Vector3.right;
            // **바닥면은 월드 축으로 편다.** 면이 제 모서리 방향을 축으로 쓰면 부채꼴·리본에서
            // 면마다 무늬가 돌아, 성문 앞마당에 수레바퀴 살 같은 줄이 생긴다(실제로 그랬다).
            if (Mathf.Abs(n.y) > 0.8f) u = Vector3.right;
            Vector3 w = Vector3.Cross(n, u);
            var shaded = color;
            shaded.a = glow;
            int i = _v.Count;
            AddPlanar(a, n, shaded, u, w);
            AddPlanar(b, n, shaded, u, w);
            AddPlanar(c, n, shaded, u, w);
            AddPlanar(d, n, shaded, u, w);
            _t.Add(i); _t.Add(i + 1); _t.Add(i + 2);
            _t.Add(i); _t.Add(i + 2); _t.Add(i + 3);
            return this;
        }

        /// <summary>지면에 눕는 사각형 — 표식·장판·그림자 대용.</summary>
        public KgdMesh Quad(Vector3 center, float width, float depth, Color color, float glow = 0f)
        {
            float hw = width * 0.5f, hd = depth * 0.5f;
            int b = _v.Count;
            Color c = color; c.a = glow;
            AddPlanar(center + new Vector3(-hw, 0f, -hd), Vector3.up, c, Vector3.right, Vector3.forward);
            AddPlanar(center + new Vector3(hw, 0f, -hd), Vector3.up, c, Vector3.right, Vector3.forward);
            AddPlanar(center + new Vector3(hw, 0f, hd), Vector3.up, c, Vector3.right, Vector3.forward);
            AddPlanar(center + new Vector3(-hw, 0f, hd), Vector3.up, c, Vector3.right, Vector3.forward);
            _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
            _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            return this;
        }

        /// <summary>지면에 눕는 고리 — 사거리·범위 표시. 무늬를 입히지 않는다.</summary>
        public KgdMesh Ring(Vector3 center, float radius, float thickness, Color color, int segments = 40,
                               float glow = 1f)
        {
            Color c = color; c.a = glow;
            float inner = radius - thickness * 0.5f, outer = radius + thickness * 0.5f;
            var keep = _surf;
            _surf = KgdSurface.None;
            for (int i = 0; i < segments; i++)
            {
                float a0 = i / (float)segments * Mathf.PI * 2f;
                float a1 = (i + 1) / (float)segments * Mathf.PI * 2f;
                int b = _v.Count;
                AddPlanar(center + new Vector3(Mathf.Cos(a0) * inner, 0f, Mathf.Sin(a0) * inner), Vector3.up, c, Vector3.right, Vector3.forward);
                AddPlanar(center + new Vector3(Mathf.Cos(a1) * inner, 0f, Mathf.Sin(a1) * inner), Vector3.up, c, Vector3.right, Vector3.forward);
                AddPlanar(center + new Vector3(Mathf.Cos(a1) * outer, 0f, Mathf.Sin(a1) * outer), Vector3.up, c, Vector3.right, Vector3.forward);
                AddPlanar(center + new Vector3(Mathf.Cos(a0) * outer, 0f, Mathf.Sin(a0) * outer), Vector3.up, c, Vector3.right, Vector3.forward);
                _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }
            _surf = keep;
            return this;
        }

        /// <summary>
        /// 둥근 기둥·고깔 — **옆면 법선을 이어 붙여 매끄럽게** 만든다.
        ///
        /// 상자를 아무리 쌓아도 둥근 것은 안 나온다. 나무 몸통·수관·망루 지붕처럼
        /// 「깎인 것이 아니라 둥근 것」이 필요한 자리가 이 함수다. 면마다 법선을 따로 주면
        /// 열 면짜리 고깔도 각져 보이므로, 법선은 축에서 바깥으로 향하는 방향을 쓴다.
        /// </summary>
        public KgdMesh Round(Vector3 bottom, Vector3 top, float rBottom, float rTop,
                             int sides, Color color, float glow = 0f)
        {
            sides = Mathf.Clamp(sides, 3, 24);
            Vector3 axis = (top - bottom).normalized;
            Vector3 side = Vector3.Cross(axis, Mathf.Abs(axis.y) > 0.95f ? Vector3.forward : Vector3.up).normalized;
            Vector3 fwd = Vector3.Cross(side, axis);
            Color c = color; c.a = glow;

            float height = (top - bottom).magnitude;
            float circ = Mathf.PI * (rBottom + rTop);       // 평균 둘레 — 옆면 무늬가 늘어나지 않게
            float vBase = Vector3.Dot(bottom, axis);        // 이어 붙는 기둥끼리 무늬가 끊기지 않게

            int baseIndex = _v.Count;
            for (int i = 0; i <= sides; i++)
            {
                float a = i / (float)sides * Mathf.PI * 2f;
                Vector3 dir = side * Mathf.Cos(a) + fwd * Mathf.Sin(a);
                Vector3 tanDir = side * -Mathf.Sin(a) + fwd * Mathf.Cos(a);
                // 옆면이 기울어도 법선이 표면을 따라가게 — 위아래 반지름 차를 축 성분으로 섞는다
                float slope = (rBottom - rTop) / Mathf.Max(0.0001f, height);
                Vector3 n = (dir + axis * slope).normalized;
                float u = i / (float)sides * circ;
                AddAt(bottom + dir * rBottom, n, c, new Vector2(u, vBase), tanDir);
                AddAt(top + dir * rTop, n, c, new Vector2(u, vBase + height), tanDir);
            }
            for (int i = 0; i < sides; i++)
            {
                int b = baseIndex + i * 2;
                _t.Add(b); _t.Add(b + 1); _t.Add(b + 3);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }
            // 끝면 — 반지름이 0 이 아니면 덮는다
            if (rTop > 0.001f) Cap(top, axis, side, fwd, rTop, sides, color * 1.12f, glow, false);
            if (rBottom > 0.001f) Cap(bottom, -axis, side, fwd, rBottom, sides, color * 0.82f, glow, true);
            return this;
        }

        private void Cap(Vector3 at, Vector3 n, Vector3 side, Vector3 fwd, float r,
                         int sides, Color color, float glow, bool flip)
        {
            Color c = color; c.a = glow;
            int mid = _v.Count;
            AddPlanar(at, n, c, side, fwd);
            for (int i = 0; i <= sides; i++)
            {
                float a = i / (float)sides * Mathf.PI * 2f;
                AddPlanar(at + (side * Mathf.Cos(a) + fwd * Mathf.Sin(a)) * r, n, c, side, fwd);
            }
            for (int i = 0; i < sides; i++)
            {
                if (flip) { _t.Add(mid); _t.Add(mid + 1 + i); _t.Add(mid + 2 + i); }
                else { _t.Add(mid); _t.Add(mid + 2 + i); _t.Add(mid + 1 + i); }
            }
        }

        /// <summary>
        /// 둥근 덩이 — 바위·수관처럼 사방이 둥근 것. <paramref name="rings"/> 만큼 가로로 잘라
        /// 쌓고 법선을 중심에서 바깥으로 준다. <paramref name="lumpy"/> 가 0 이 아니면
        /// 자리마다 반지름을 흔들어 **돌덩이**가 된다 — 흔들지 않으면 공이다.
        /// </summary>
        public KgdMesh Blob(Vector3 center, Vector3 size, int sides, int rings,
                            Color color, float lumpy = 0f, int seed = 0, float glow = 0f)
        {
            sides = Mathf.Clamp(sides, 4, 20);
            rings = Mathf.Clamp(rings, 2, 12);
            Color c = color; c.a = glow;
            float circ = Mathf.PI * (size.x + size.z) * 0.5f;
            float arc = Mathf.PI * size.y * 0.5f;
            int baseIndex = _v.Count;
            for (int j = 0; j <= rings; j++)
            {
                float v = j / (float)rings;
                float phi = v * Mathf.PI;
                float y = Mathf.Cos(phi), rr = Mathf.Sin(phi);
                for (int i = 0; i <= sides; i++)
                {
                    float u = i / (float)sides;
                    float a = u * Mathf.PI * 2f;
                    var dir = new Vector3(Mathf.Cos(a) * rr, y, Mathf.Sin(a) * rr);
                    var tanDir = new Vector3(-Mathf.Sin(a), 0f, Mathf.Cos(a));
                    float wob = lumpy == 0f ? 1f
                        : 1f + lumpy * (Hash(seed + i * 7 + j * 31) - 0.5f);
                    var p = center + Vector3.Scale(dir * wob, size * 0.5f);
                    AddAt(p, dir.normalized, c, new Vector2(u * circ, (1f - v) * arc), tanDir);
                }
            }
            int row = sides + 1;
            for (int j = 0; j < rings; j++)
            for (int i = 0; i < sides; i++)
            {
                int b = baseIndex + j * row + i;
                _t.Add(b); _t.Add(b + row); _t.Add(b + row + 1);
                _t.Add(b); _t.Add(b + row + 1); _t.Add(b + 1);
            }
            return this;
        }

        private static float Hash(int n)
        {
            n = (n << 13) ^ n;
            return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483647f;
        }

        /// <summary>월드 좌표를 면의 두 축에 투영해 UV 를 만든다 — 이어진 면끼리 무늬가 안 끊긴다.</summary>
        private void AddPlanar(Vector3 p, Vector3 n, Color c, Vector3 u, Vector3 w)
            => AddAt(p, n, c, new Vector2(Vector3.Dot(p, u), Vector3.Dot(p, w)), u);

        private void AddAt(Vector3 p, Vector3 n, Color c, Vector2 uv, Vector3 tangent)
        {
            _v.Add(p); _n.Add(n); _c.Add(c);
            _uv.Add(uv * _surf.Scale);
            _tile.Add(_surf.Tile);
            _tan.Add(new Vector4(tangent.x, tangent.y, tangent.z, 1f));
        }

        public Mesh Build(string name, bool recalcBounds = true)
        {
            var m = new Mesh { name = name };
            if (_v.Count > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(_v);
            m.SetNormals(_n);
            m.SetColors(_c);
            m.SetUVs(0, _uv);
            m.SetUVs(1, _tile);
            m.SetTangents(_tan);
            m.SetTriangles(_t, 0);
            if (recalcBounds) m.RecalculateBounds();
            m.UploadMeshData(false);
            return m;
        }
    }
}
