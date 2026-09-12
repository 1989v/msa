using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Art
{
    /// <summary>
    /// 박스·프리즘을 쌓아 메시 하나를 만든다. 면마다 밝기를 달리 실어 조명이 없어도
    /// 3톤 이상이 나오게 한다 — 단색 도형은 개체로 안 읽힌다.
    ///
    /// **게임이 상속해서 이름만 바꿔 쓸 수 있다** — 호출부가 수백 군데라 타입 이름을
    /// 바꾸면 그만큼 고쳐야 한다. 로직은 여기 한 벌만 둔다.
    /// </summary>
    public class KgdMesh
    {
        private readonly List<Vector3> _v = new();
        private readonly List<Vector3> _n = new();
        private readonly List<Color> _c = new();
        private readonly List<int> _t = new();

        public int VertexCount => _v.Count;

        /// <summary>면 밝기 — 위 / 아래 / 옆 네 방향. 태양이 위에서 비스듬히 오는 것을 흉내낸다.</summary>
        private static readonly float[] FaceShade = { 1.00f, 0.86f, 1.14f, 0.62f, 0.92f, 0.78f };

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

                AddVert(center + rot * (nn - nu - nw), rot * n, shaded);
                AddVert(center + rot * (nn + nu - nw), rot * n, shaded);
                AddVert(center + rot * (nn + nu + nw), rot * n, shaded);
                AddVert(center + rot * (nn - nu + nw), rot * n, shaded);

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
                Color shaded = color * (0.72f + 0.14f * i);
                shaded.a = glow;
                int b = _v.Count;
                AddVert(bottomRing[i], n, shaded);
                AddVert(bottomRing[j], n, shaded);
                AddVert(topRing[j], n, shaded);
                AddVert(topRing[i], n, shaded);
                _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }

            // 위 뚜껑만 — 아래는 지면·다른 부위에 가려 보이지 않는다
            int cap = _v.Count;
            Color capColor = color * 1.14f;
            capColor.a = glow;
            for (int i = 0; i < 4; i++) AddVert(topRing[i], axis, capColor);
            _t.Add(cap); _t.Add(cap + 2); _t.Add(cap + 1);
            _t.Add(cap); _t.Add(cap + 3); _t.Add(cap + 2);
            return this;
        }

        /// <summary>지면에 눕는 사각형 — 표식·장판·그림자 대용.</summary>
        /// <summary>
        /// 네 꼭짓점이 제각각인 면 하나(a→b→c→d, 시계 반대). 비탈처럼 **기울고 폭이 변하는**
        /// 면에 쓴다 — 상자를 여러 개 쌓아 흉내 내면 층마다 턱과 밝기 차가 생겨 격자무늬가 된다.
        /// </summary>
        public KgdMesh Face(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Color color, float glow = 0f)
        {
            Vector3 n = Vector3.Cross(b - a, d - a).normalized;
            var shaded = color;
            shaded.a = glow;
            int i = _v.Count;
            AddVert(a, n, shaded);
            AddVert(b, n, shaded);
            AddVert(c, n, shaded);
            AddVert(d, n, shaded);
            _t.Add(i); _t.Add(i + 1); _t.Add(i + 2);
            _t.Add(i); _t.Add(i + 2); _t.Add(i + 3);
            return this;
        }

        public KgdMesh Quad(Vector3 center, float width, float depth, Color color, float glow = 0f)
        {
            float hw = width * 0.5f, hd = depth * 0.5f;
            int b = _v.Count;
            Color c = color; c.a = glow;
            AddVert(center + new Vector3(-hw, 0f, -hd), Vector3.up, c);
            AddVert(center + new Vector3(hw, 0f, -hd), Vector3.up, c);
            AddVert(center + new Vector3(hw, 0f, hd), Vector3.up, c);
            AddVert(center + new Vector3(-hw, 0f, hd), Vector3.up, c);
            _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
            _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            return this;
        }

        /// <summary>지면에 눕는 고리 — 사거리·범위 표시.</summary>
        public KgdMesh Ring(Vector3 center, float radius, float thickness, Color color, int segments = 40,
                               float glow = 1f)
        {
            Color c = color; c.a = glow;
            float inner = radius - thickness * 0.5f, outer = radius + thickness * 0.5f;
            for (int i = 0; i < segments; i++)
            {
                float a0 = i / (float)segments * Mathf.PI * 2f;
                float a1 = (i + 1) / (float)segments * Mathf.PI * 2f;
                int b = _v.Count;
                AddVert(center + new Vector3(Mathf.Cos(a0) * inner, 0f, Mathf.Sin(a0) * inner), Vector3.up, c);
                AddVert(center + new Vector3(Mathf.Cos(a1) * inner, 0f, Mathf.Sin(a1) * inner), Vector3.up, c);
                AddVert(center + new Vector3(Mathf.Cos(a1) * outer, 0f, Mathf.Sin(a1) * outer), Vector3.up, c);
                AddVert(center + new Vector3(Mathf.Cos(a0) * outer, 0f, Mathf.Sin(a0) * outer), Vector3.up, c);
                _t.Add(b); _t.Add(b + 2); _t.Add(b + 1);
                _t.Add(b); _t.Add(b + 3); _t.Add(b + 2);
            }
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

            int baseIndex = _v.Count;
            for (int i = 0; i <= sides; i++)
            {
                float a = i / (float)sides * Mathf.PI * 2f;
                Vector3 dir = side * Mathf.Cos(a) + fwd * Mathf.Sin(a);
                // 옆면이 기울어도 법선이 표면을 따라가게 — 위아래 반지름 차를 축 성분으로 섞는다
                float slope = (rBottom - rTop) / Mathf.Max(0.0001f, (top - bottom).magnitude);
                Vector3 n = (dir + axis * slope).normalized;
                AddVert(bottom + dir * rBottom, n, c);
                AddVert(top + dir * rTop, n, c);
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
            AddVert(at, n, c);
            for (int i = 0; i <= sides; i++)
            {
                float a = i / (float)sides * Mathf.PI * 2f;
                AddVert(at + (side * Mathf.Cos(a) + fwd * Mathf.Sin(a)) * r, n, c);
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
                    float wob = lumpy == 0f ? 1f
                        : 1f + lumpy * (Hash(seed + i * 7 + j * 31) - 0.5f);
                    var p = center + Vector3.Scale(dir * wob, size * 0.5f);
                    AddVert(p, dir.normalized, c);
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

        private void AddVert(Vector3 p, Vector3 n, Color c)
        {
            _v.Add(p); _n.Add(n); _c.Add(c);
        }

        public Mesh Build(string name, bool recalcBounds = true)
        {
            var m = new Mesh { name = name };
            if (_v.Count > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(_v);
            m.SetNormals(_n);
            m.SetColors(_c);
            m.SetTriangles(_t, 0);
            if (recalcBounds) m.RecalculateBounds();
            m.UploadMeshData(false);
            return m;
        }
    }
}
