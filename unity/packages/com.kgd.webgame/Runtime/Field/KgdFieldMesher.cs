using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Field
{
    /// <summary>
    /// 청크 하나를 **등치면**으로 뜬다 (서피스 넷).
    ///
    /// 칸마다 여덟 모서리의 밀도 부호가 갈리면 그 칸 안에 꼭짓점을 하나 놓는다 —
    /// **자리는 표면이 지나는 열두 모서리의 교차점을 평균 낸 것**이고, 그래서 면이 칸 경계가
    /// 아니라 칸 안 어디에나 선다. 이 한 줄이 「네모가 아니다」의 전부다(칸 가운데에 놓으면
    /// 그게 곧 정육면체다).
    ///
    /// **한 칸 넘겨 훑는다.** 청크 경계에서 이웃 청크와 같은 자리에 같은 꼭짓점이 나와야
    /// 이음매가 안 갈라진다 — 자기 칸만 보면 경계마다 틈이 생긴다.
    ///
    /// **밝기는 정점에 굽는다.** 하늘빛·등불빛을 실시간 광원으로 내면 폰에서 픽셀당 조명
    /// 패스가 겹쳐 발열로 온다(가드레일 G7). 색에 담아 두면 그리는 비용이 0 이다.
    /// </summary>
    public static class KgdFieldMesher
    {
        /// <summary>표면 위로 몇 번 끌어당기나. 두 번이면 거의 붙고, 더 해도 값이 안 움직인다.</summary>
        private const int Relax = 2;

        private static readonly int[,] Corner =
            { {0,0,0},{1,0,0},{0,1,0},{1,1,0},{0,0,1},{1,0,1},{0,1,1},{1,1,1} };

        private static readonly int[,] Edge =
            { {0,1},{2,3},{4,5},{6,7},{0,2},{1,3},{4,6},{5,7},{0,4},{1,5},{2,6},{3,7} };

        private static readonly float[] SkyCurve = new float[16];
        private static readonly float[] BlkCurve = new float[16];

        static KgdFieldMesher()
        {
            for (int i = 0; i < 16; i++)
            {
                float t = i / 15f;
                // 낮은 단이 촘촘해야 굴이 「조금 어둡다」가 아니라 **안 보인다** 로 읽힌다
                SkyCurve[i] = 0.05f + 0.95f * Mathf.Pow(t, 1.45f);
                BlkCurve[i] = Mathf.Pow(t, 1.45f);
            }
        }

        private static readonly List<Vector3> _v = new();
        private static readonly List<Vector3> _n = new();
        private static readonly List<Color> _c = new();
        private static readonly List<Vector2> _uv = new();
        private static readonly List<int> _t = new();
        private static readonly List<int> _cell = new();       // 꼭짓점이 어느 칸에서 났나
        private static int[] _index;
        private static int _pw, _ph, _pd;

        /// <param name="liquid">참이면 수면을 뜬다 — 땅은 빈 칸으로 본다. 거짓이면 땅을 뜨고 액체가 빈 칸이다.</param>
        /// <param name="yFrom">이 높이부터 (포함) <paramref name="yTo"/> 앞까지의 칸만 면을 낸다. 층을 나눠 뜨면
        /// 땅속 굴을 지상에서는 안 그릴 수 있다 — 정점의 6할이 안 보이는 굴 벽이었다(실측).</param>
        public static Mesh Build(KgdFieldWorld w, int cx, int cz, bool liquid = false, int yFrom = 0, int yTo = int.MaxValue)
        {
            int h = w.Height;
            yTo = Mathf.Min(yTo, h - 1);
            // 한 칸 앞뒤로 넘겨 본다 — 경계 이음매와 법선이 이웃을 봐야 맞는다
            _pw = KgdFieldWorld.SX + 3;
            _pd = KgdFieldWorld.SZ + 3;
            _ph = h + 1;

            int cells = _pw * _ph * _pd;
            if (_index == null || _index.Length < cells) _index = new int[cells];
            for (int i = 0; i < cells; i++) _index[i] = -1;

            _v.Clear(); _n.Clear(); _c.Clear(); _uv.Clear(); _t.Clear(); _cell.Clear();

            int x0 = cx * KgdFieldWorld.SX, z0 = cz * KgdFieldWorld.SZ;
            var c8 = new float[8];

            for (int k = 0; k < _pd; k++)
            {
                for (int j = 0; j < _ph; j++)
                {
                    for (int i = 0; i < _pw; i++)
                    {
                        int gx = x0 + i - 1, gy = j - 1, gz = z0 + k - 1;
                        if (gy < 0 || gy >= h - 1) continue;
                        // 경계 줄은 양쪽이 다 갖는다 — 아래 층의 위쪽 면이 이 줄의 꼭짓점을 쓴다
                        if (gy < yFrom - 1 || gy > yTo) continue;

                        int inside = 0;
                        for (int n = 0; n < 8; n++)
                        {
                            c8[n] = w.Phase(gx + Corner[n, 0], gy + Corner[n, 1], gz + Corner[n, 2], liquid)
                                  - KgdFieldWorld.Iso;
                            if (c8[n] > 0f) inside++;
                        }
                        if (inside == 0 || inside == 8) continue;

                        var sum = Vector3.zero;
                        int hits = 0;
                        for (int e = 0; e < 12; e++)
                        {
                            int a = Edge[e, 0], b = Edge[e, 1];
                            if ((c8[a] > 0f) == (c8[b] > 0f)) continue;
                            float s = c8[a] / (c8[a] - c8[b]);
                            sum += Vector3.Lerp(
                                new Vector3(Corner[a, 0], Corner[a, 1], Corner[a, 2]),
                                new Vector3(Corner[b, 0], Corner[b, 1], Corner[b, 2]), s);
                            hits++;
                        }
                        if (hits == 0) continue;

                        _index[(k * _ph + j) * _pw + i] = _v.Count;
                        _v.Add(new Vector3(gx - x0, gy, gz - z0) + sum / hits);
                        _cell.Add((k * _ph + j) * _pw + i);
                    }
                }
            }

            if (_v.Count == 0) return null;

            for (int k = 1; k < _pd; k++)
            {
                for (int j = 1; j < _ph; j++)
                {
                    for (int i = 1; i < _pw; i++)
                    {
                        int gx = x0 + i - 1, gy = j - 1, gz = z0 + k - 1;
                        if (gy < 0 || gy >= h - 1) continue;
                        if (gy < yFrom || gy >= yTo) continue;
                        float here = w.Phase(gx, gy, gz, liquid) - KgdFieldWorld.Iso;
                        Quad(w, here, w.Phase(gx + 1, gy, gz, liquid) - KgdFieldWorld.Iso, i, j, k, 1, 0, 0);
                        Quad(w, here, w.Phase(gx, gy + 1, gz, liquid) - KgdFieldWorld.Iso, i, j, k, 0, 1, 0);
                        Quad(w, here, w.Phase(gx, gy, gz + 1, liquid) - KgdFieldWorld.Iso, i, j, k, 0, 0, 1);
                    }
                }
            }

            if (_t.Count == 0) return null;

            Project(w, x0, z0, liquid);
            Dress(w, x0, z0, liquid);

            var mesh = new Mesh { name = $"field_{cx}_{cz}", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(_v);
            mesh.SetNormals(_n);
            mesh.SetColors(_c);
            mesh.SetUVs(0, _uv);
            mesh.SetTriangles(_t, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// 이 모서리를 둘러싼 네 칸의 꼭짓점을 이어 면 하나.
        ///
        /// **도는 방향이 축마다 오른손이어야 한다.** Y 모서리에서 (X,Z) 순으로 돌면 왼손이라
        /// 면이 뒤집히는데, 지형 표면은 거의 전부 Y 모서리라 **표면의 대부분이 뒷면 컬링으로
        /// 사라진다** — 실제로 그렇게 짜서 등고선 실오라기만 보인 적이 있다.
        /// </summary>
        private static void Quad(KgdFieldWorld w, float a, float b, int i, int j, int k,
                                 int dx, int dy, int dz)
        {
            if ((a > 0f) == (b > 0f)) return;

            int ax, ay, az, bx, by, bz;
            if (dx != 0)      { ax = 0; ay = 1; az = 0; bx = 0; by = 0; bz = 1; }   // (Y,Z)
            else if (dy != 0) { ax = 0; ay = 0; az = 1; bx = 1; by = 0; bz = 0; }   // (Z,X)
            else              { ax = 1; ay = 0; az = 0; bx = 0; by = 1; bz = 0; }   // (X,Y)

            int i0 = At(i, j, k);
            int i1 = At(i - ax, j - ay, k - az);
            int i2 = At(i - ax - bx, j - ay - by, k - az - bz);
            int i3 = At(i - bx, j - by, k - bz);
            if (i0 < 0 || i1 < 0 || i2 < 0 || i3 < 0) return;

            if (a > 0f) { _t.Add(i0); _t.Add(i1); _t.Add(i2); _t.Add(i0); _t.Add(i2); _t.Add(i3); }
            else        { _t.Add(i0); _t.Add(i2); _t.Add(i1); _t.Add(i0); _t.Add(i3); _t.Add(i2); }
        }

        private static int At(int i, int j, int k)
            => i < 0 || j < 0 || k < 0 ? -1 : _index[(k * _ph + j) * _pw + i];

            /// <summary>
        /// 꼭짓점을 **표면 위로 끌어당긴다.**
        ///
        /// 모서리 교차점의 평균은 표면 근처일 뿐 표면 위가 아니라, 그대로 두면 면이 미세하게
        /// 울렁이고 삼각형 크기가 들쭉날쭉해 넓은 면이 다각형 얼룩처럼 보인다.
        ///
        /// **이웃 꼭짓점을 보고 펴면 안 된다.** 처음엔 라플라시안으로 폈는데, 청크마다 자기
        /// 안의 이웃만 보므로 경계에서 같은 꼭짓점이 서로 다르게 밀려 **이음매가 1.8칸까지
        /// 벌어졌다**(FieldGate 가 잡았다). 밀도장만 보고 미는 것은 어느 청크에서 계산하든
        /// 같은 값이 나오므로 이음매가 정확히 맞는다.
        ///
        /// 자기 칸 밖으로는 안 나간다 — 나가면 이웃 칸의 꼭짓점과 뒤바뀌어 면이 꼬인다.
        /// </summary>
        private static void Project(KgdFieldWorld w, int x0, int z0, bool liquid)
        {
            for (int i = 0; i < _v.Count; i++)
            {
                var local = _v[i];
                var cell = new Vector3(Mathf.Floor(local.x), Mathf.Floor(local.y), Mathf.Floor(local.z));

                for (int step = 0; step < Relax; step++)
                {
                    var world = new Vector3(local.x + x0, local.y, local.z + z0);
                    float d = w.Sample(world, liquid);
                    if (Mathf.Abs(d) < 0.5f) break;

                    // 밀도는 칸당 최대 127 만큼 변하므로 그대로 나누면 한 번에 튄다 —
                    // 기울기 크기로 나눠 「표면까지 몇 칸인가」로 바꾼다
                    var g = new Vector3(
                        w.Sample(world + Vector3.right * 0.5f, liquid) - w.Sample(world - Vector3.right * 0.5f, liquid),
                        w.Sample(world + Vector3.up * 0.5f, liquid) - w.Sample(world - Vector3.up * 0.5f, liquid),
                        w.Sample(world + Vector3.forward * 0.5f, liquid) - w.Sample(world - Vector3.forward * 0.5f, liquid));
                    float len = g.magnitude;
                    if (len < 1e-4f) break;

                    local -= g / len * Mathf.Clamp(d / len, -0.5f, 0.5f);
                    local = new Vector3(
                        Mathf.Clamp(local.x, cell.x, cell.x + 1f),
                        Mathf.Clamp(local.y, cell.y, cell.y + 1f),
                        Mathf.Clamp(local.z, cell.z, cell.z + 1f));
                }
                _v[i] = local;
            }
        }

        /// <summary>법선·색·무늬 좌표. 밝기는 그 자리의 하늘빛·등불빛에서 나온다.</summary>
        private static void Dress(KgdFieldWorld w, int x0, int z0, bool liquid)
        {
            _n.Clear(); _c.Clear(); _uv.Clear();

            for (int i = 0; i < _v.Count; i++)
            {
                var local = _v[i];
                var world = new Vector3(local.x + x0, local.y, local.z + z0);

                var face = w.Normal(world, liquid);
                _n.Add(face);

                // 재료는 표면 **안쪽** 칸에서 읽는다 — 바깥 칸은 비어 있어 재료가 없다
                var inside = world - face * 0.6f;
                byte mat = w.Mat(Mathf.FloorToInt(inside.x), Mathf.FloorToInt(inside.y), Mathf.FloorToInt(inside.z));
                var kind = w.Kinds[mat];

                // 위를 보는 면은 그 재료의 윗면 색, 선 면은 옆면 색
                float flat = Mathf.Clamp01(face.y);
                var baseCol = Color.Lerp(kind.Side, kind.Top, Mathf.SmoothStep(0f, 1f, (flat - 0.45f) / 0.4f));

                // 빛은 표면 **바깥** 칸에서 읽는다 — 안쪽은 막혀 있어 늘 캄캄하다
                var outside = world + face * 0.6f;
                int lx = Mathf.FloorToInt(outside.x), ly = Mathf.FloorToInt(outside.y), lz = Mathf.FloorToInt(outside.z);
                float skyF = SkyCurve[Mathf.Clamp(w.SkyLight(lx, ly, lz), 0, 15)];
                float litF = BlkCurve[Mathf.Clamp(w.BlockLight(lx, ly, lz), 0, 15)];

                // 위를 보는 면이 밝고 처마 밑이 어둡다 — 광원이 없어도 형태가 읽혀야 한다
                float shade = Mathf.Lerp(0.62f, 1f, flat);
                float bright = Mathf.Max(skyF, litF) * shade;

                var col = baseCol * bright;
                // 알파는 「이 밝기 중 등불 몫」이다. 밤에 해가 꺼져도 이 값이 남아
                // 불빛이 닿은 면만 살아 있는다.
                col.a = litF * 0.55f;
                _c.Add(col);

                // 무늬는 **세계 좌표로** 입힌다 — 칸마다 되풀이하면 그 격자가 다시 보인다
                _uv.Add(new Vector2(world.x + world.z * 0.5f, world.y + world.z * 0.25f) * 0.125f);
            }
        }
    }
}
