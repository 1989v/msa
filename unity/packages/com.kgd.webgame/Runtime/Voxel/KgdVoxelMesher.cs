using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Voxel
{
    /// <summary>
    /// 청크 하나를 메시로 뜬다.
    ///
    /// **면을 낱장으로 그리지 않는다.** 16×16×96 이면 블록이 24,576 개이고, 보이는 면만
    /// 세어도 낱장으로는 수만 장이다. 밝기까지 같은 면은 **직사각형 하나로 합쳐서**
    /// 삼각형 수를 한 자릿수 배로 줄인다 — 흙벌판 한 청크가 2,000 장에서 40 장이 된다.
    ///
    /// **밝기는 정점에 굽는다.** 하늘빛·횃불빛·모서리 그늘을 실시간 광원으로 내면 폰에서
    /// 픽셀당 조명 패스가 겹쳐 발열로 온다(가드레일 G7). 대신 색에 담아 두면 그리는 비용이 0 이고,
    /// 밤은 태양 하나를 어둡게 하는 것으로 낸다 — 횃불이 닿은 면은 알파에 남겨 둬서
    /// <c>Emission</c> 으로 밤에도 살아 있는다.
    ///
    /// **한 칸을 볼 때마다 배열을 만들지 않는다.** 축을 배열 인덱스로 다루면 코드는 짧아지지만
    /// 청크 하나에 십수만 번 할당이 일어나 GC 가 프레임을 끊는다 — 축 셋 중 어느 것이
    /// 무엇인지는 계산으로 푼다.
    /// </summary>
    public static class KgdVoxelMesher
    {
        // 면 방향: 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
        private static readonly int[] AxisOf = { 0, 0, 1, 1, 2, 2 };
        private static readonly int[] SignOf = { 1, -1, 1, -1, 1, -1 };

        // u × v = 면의 법선이 되게 고른 짝. 여기가 어긋나면 면이 뒤집혀 안쪽만 보인다.
        private static readonly int[] UAxis = { 1, 2, 2, 0, 0, 1 };
        private static readonly int[] VAxis = { 2, 1, 0, 2, 1, 0 };

        private static readonly Vector3[] Normal =
        {
            Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back,
        };

        /// <summary>면 방향별 밝기. 광원이 없어도 3톤 이상이 나오게 한다.</summary>
        private static readonly float[] FaceShade = { 0.86f, 0.80f, 1.00f, 0.62f, 0.92f, 0.74f };

        /// <summary>모서리 그늘 4단. 0 이 가장 깊게 낀 구석이다.</summary>
        private static readonly float[] AoShade = { 0.52f, 0.70f, 0.86f, 1.00f };

        private static readonly float[] SkyCurve = new float[16];
        private static readonly float[] BlkCurve = new float[16];

        static KgdVoxelMesher()
        {
            for (int i = 0; i < 16; i++)
            {
                float t = i / 15f;
                // 낮은 단이 촘촘해야 동굴이 「조금 어둡다」가 아니라 **안 보인다** 로 읽힌다.
                SkyCurve[i] = 0.05f + 0.95f * Mathf.Pow(t, 1.45f);
                BlkCurve[i] = Mathf.Pow(t, 1.45f);
            }
        }

        // 이웃 한 칸까지 담은 사본. 사전을 칸마다 뒤지지 않으려고 한 번에 떠 온다.
        private static byte[] _blk, _sky, _lit;
        private static int _pw, _ph, _snapH;

        private static ulong[] _mask;
        private static readonly List<Vector3> _v = new();
        private static readonly List<Vector3> _n = new();
        private static readonly List<Color> _c = new();
        private static readonly List<int> _t = new();

        public static void Build(KgdVoxelWorld world, int cx, int cz, out Mesh solid, out Mesh liquid)
        {
            Snapshot(world, cx, cz);
            solid = Pass(world, liquidPass: false, $"chunk_{cx}_{cz}");
            liquid = Pass(world, liquidPass: true, $"water_{cx}_{cz}");
        }

        // ── 사본 ────────────────────────────────────────────────────────────────

        private static int PI(int x, int y, int z) => (y * _pw + z) * _pw + x;

        private static void Snapshot(KgdVoxelWorld world, int cx, int cz)
        {
            int h = world.Height;
            if (_blk == null || _snapH != h)
            {
                _snapH = h;
                _pw = KgdVoxelWorld.SX + 2;
                _ph = h + 2;
                int n = _pw * _pw * _ph;
                _blk = new byte[n];
                _sky = new byte[n];
                _lit = new byte[n];
            }

            int stride = KgdVoxelWorld.SX * KgdVoxelWorld.SZ;
            int x0 = cx * KgdVoxelWorld.SX, z0 = cz * KgdVoxelWorld.SZ;

            for (int pz = 0; pz < _pw; pz++)
            {
                for (int px = 0; px < _pw; px++)
                {
                    world.ColumnRef(x0 + px - 1, z0 + pz - 1,
                                    out var b, out var s, out var l, out int off, out int skyTop);

                    for (int py = 0; py < _ph; py++)
                    {
                        int wy = py - 1;
                        int i = PI(px, py, pz);
                        if (b == null || wy < 0 || wy >= h)
                        {
                            // 세계 밖 — 위는 하늘, 아래는 어둠. 아래를 하늘로 두면 바닥 밑이
                            // 훤해져 지면이 떠 있는 것처럼 보인다.
                            _blk[i] = 0;
                            _sky[i] = (byte)(wy >= h ? 15 : 0);
                            _lit[i] = 0;
                            continue;
                        }
                        int k = off + wy * stride;
                        _blk[i] = b[k];
                        _sky[i] = wy >= skyTop ? (byte)15 : s[k];
                        _lit[i] = l[k];
                    }
                }
            }
        }

        private static byte At(int x, int y, int z) => _blk[PI(x + 1, y + 1, z + 1)];

        /// <summary>축 셋 중 하나를 골라 값을 낸다. a·u·v 는 서로 다른 축이라 하나만 맞는다.</summary>
        private static int Pick(int axis, int a, int u, int v, int wa, int iu, int jv)
            => axis == a ? wa : axis == u ? iu : jv;

        // ── 면 뜨기 ──────────────────────────────────────────────────────────────

        private static Mesh Pass(KgdVoxelWorld world, bool liquidPass, string name)
        {
            _v.Clear(); _n.Clear(); _c.Clear(); _t.Clear();

            var kinds = world.Kinds;
            int h = world.Height;

            int need = KgdVoxelWorld.SX * h;
            if (_mask == null || _mask.Length < need) _mask = new ulong[need];

            for (int d = 0; d < 6; d++)
            {
                int a = AxisOf[d], u = UAxis[d], v = VAxis[d], s = SignOf[d];
                int da = Dim(a, h), du = Dim(u, h), dv = Dim(v, h);

                for (int w = 0; w < da; w++)
                {
                    System.Array.Clear(_mask, 0, du * dv);
                    bool any = false;

                    for (int j = 0; j < dv; j++)
                    {
                        for (int i = 0; i < du; i++)
                        {
                            int x = Pick(0, a, u, v, w, i, j);
                            int y = Pick(1, a, u, v, w, i, j);
                            int z = Pick(2, a, u, v, w, i, j);

                            byte id = At(x, y, z);
                            var kind = kinds[id];
                            bool mine = liquidPass ? kind.Liquid : kind.Solid && !kind.Liquid;
                            if (!mine) continue;

                            int nx = Pick(0, a, u, v, w + s, i, j);
                            int ny = Pick(1, a, u, v, w + s, i, j);
                            int nz = Pick(2, a, u, v, w + s, i, j);

                            byte other = At(nx, ny, nz);
                            // 같은 블록끼리 맞닿은 면은 안 그린다 — 안 그러면 잎 덩이·유리 벽
                            // 안쪽에 안 보이는 면이 그대로 쌓인다.
                            if (other == id) continue;
                            var okind = kinds[other];
                            if (okind.Opaque) continue;
                            if (liquidPass && okind.Liquid) continue;

                            ulong key = (ulong)id;
                            key |= (ulong)Corner(kinds, nx, ny, nz, u, v, -1, -1) << 8;
                            key |= (ulong)Corner(kinds, nx, ny, nz, u, v, +1, -1) << 18;
                            key |= (ulong)Corner(kinds, nx, ny, nz, u, v, +1, +1) << 28;
                            key |= (ulong)Corner(kinds, nx, ny, nz, u, v, -1, +1) << 38;

                            _mask[j * du + i] = key;
                            any = true;
                        }
                    }

                    if (any) Greedy(world, d, a, u, v, s, w, du, dv);
                }
            }

            if (_t.Count == 0) return null;

            var mesh = new Mesh { name = name, indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(_v);
            mesh.SetNormals(_n);
            mesh.SetColors(_c);
            mesh.SetTriangles(_t, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private static int Dim(int axis, int h) => axis == 1 ? h : KgdVoxelWorld.SX;

        /// <summary>
        /// 한 모서리의 밝기와 그늘. 면 **앞쪽**의 세 칸(옆·옆·대각)이 얼마나 막혀 있나로
        /// 그늘을 정하고, 막히지 않은 칸들의 빛을 평균 낸다 — 이것이 블록 세계에서
        /// 「구석이 어둡다」를 만드는 유일한 장치다.
        /// </summary>
        private static int Corner(KgdVoxelKind[] kinds, int fx, int fy, int fz,
                                  int u, int v, int cu, int cv)
        {
            int s1x = fx, s1y = fy, s1z = fz; Off(u, cu, ref s1x, ref s1y, ref s1z);
            int s2x = fx, s2y = fy, s2z = fz; Off(v, cv, ref s2x, ref s2y, ref s2z);
            int crx = s1x, cry = s1y, crz = s1z; Off(v, cv, ref crx, ref cry, ref crz);

            bool o1 = kinds[At(s1x, s1y, s1z)].Opaque;
            bool o2 = kinds[At(s2x, s2y, s2z)].Opaque;
            bool oc = kinds[At(crx, cry, crz)].Opaque;

            int ao = o1 && o2 ? 0 : 3 - (o1 ? 1 : 0) - (o2 ? 1 : 0) - (oc ? 1 : 0);

            int sky = 0, lit = 0, n = 0;
            Sample(fx, fy, fz, ref sky, ref lit, ref n);
            if (!o1) Sample(s1x, s1y, s1z, ref sky, ref lit, ref n);
            if (!o2) Sample(s2x, s2y, s2z, ref sky, ref lit, ref n);
            if (!oc && !(o1 && o2)) Sample(crx, cry, crz, ref sky, ref lit, ref n);

            int skyAvg = Mathf.Clamp(Mathf.RoundToInt((float)sky / n), 0, 15);
            int litAvg = Mathf.Clamp(Mathf.RoundToInt((float)lit / n), 0, 15);
            return skyAvg | (litAvg << 4) | (ao << 8);
        }

        private static void Off(int axis, int delta, ref int x, ref int y, ref int z)
        {
            if (axis == 0) x += delta;
            else if (axis == 1) y += delta;
            else z += delta;
        }

        private static void Sample(int x, int y, int z, ref int sky, ref int lit, ref int n)
        {
            int i = PI(x + 1, y + 1, z + 1);
            sky += _sky[i];
            lit += _lit[i];
            n++;
        }

        /// <summary>같은 열쇠를 가진 칸을 직사각형으로 넓혀 한 장으로 낸다.</summary>
        private static void Greedy(KgdVoxelWorld world, int d, int a, int u, int v, int s, int w,
                                   int du, int dv)
        {
            for (int j = 0; j < dv; j++)
            {
                for (int i = 0; i < du;)
                {
                    ulong key = _mask[j * du + i];
                    if (key == 0) { i++; continue; }

                    int wide = 1;
                    while (i + wide < du && _mask[j * du + i + wide] == key) wide++;

                    int tall = 1;
                    bool grow = true;
                    while (j + tall < dv && grow)
                    {
                        for (int k = 0; k < wide; k++)
                        {
                            if (_mask[(j + tall) * du + i + k] == key) continue;
                            grow = false;
                            break;
                        }
                        if (grow) tall++;
                    }

                    Quad(world, d, a, u, v, s, w, i, j, wide, tall, key);

                    for (int jj = 0; jj < tall; jj++)
                        for (int ii = 0; ii < wide; ii++)
                            _mask[(j + jj) * du + i + ii] = 0;

                    i += wide;
                }
            }
        }

        private static void Quad(KgdVoxelWorld world, int d, int a, int u, int v, int s, int w,
                                 int i, int j, int wide, int tall, ulong key)
        {
            var kind = world.Kinds[(byte)(key & 0xFF)];
            Color face = kind.FaceColor(d);

            float wa = w + (s > 0 ? 1 : 0);
            var p0 = new Vector3(
                a == 0 ? wa : u == 0 ? i : j,
                a == 1 ? wa : u == 1 ? i : j,
                a == 2 ? wa : u == 2 ? i : j);

            var uVec = Axis(u) * wide;
            var vVec = Axis(v) * tall;

            int b = _v.Count;
            var normal = Normal[d];
            float shade = FaceShade[d];

            float b0 = Emit(face, shade, key, 0, p0);
            float b1 = Emit(face, shade, key, 1, p0 + uVec);
            float b2 = Emit(face, shade, key, 2, p0 + uVec + vVec);
            float b3 = Emit(face, shade, key, 3, p0 + vVec);
            _n.Add(normal); _n.Add(normal); _n.Add(normal); _n.Add(normal);

            // 네 모서리의 그늘이 어긋나면 **대각선을 바꿔 자른다.** 안 그러면 구석에
            // 밝기가 꺾인 삼각형 자국이 남는다(블록 세계에서 가장 눈에 띄는 결함이다).
            if (b0 + b2 < b1 + b3)
            {
                _t.Add(b + 1); _t.Add(b + 3); _t.Add(b + 2);
                _t.Add(b + 1); _t.Add(b + 0); _t.Add(b + 3);
            }
            else
            {
                _t.Add(b + 0); _t.Add(b + 1); _t.Add(b + 2);
                _t.Add(b + 0); _t.Add(b + 2); _t.Add(b + 3);
            }
        }

        private static Vector3 Axis(int i) => i == 0 ? Vector3.right : i == 1 ? Vector3.up : Vector3.forward;

        private static float Emit(Color face, float shade, ulong key, int corner, Vector3 at)
        {
            int packed = (int)((key >> (8 + corner * 10)) & 0x3FF);
            float skyF = SkyCurve[packed & 0xF];
            float litF = BlkCurve[(packed >> 4) & 0xF];
            float aoF = AoShade[(packed >> 8) & 0x3];

            float bright = Mathf.Max(skyF, litF) * aoF * shade;
            var col = face * bright;
            // 알파는 「이 밝기 중 횃불 몫」이다. 밤에 태양이 꺼져도 이 값이 남아
            // 불빛이 닿은 면만 살아 있는다.
            col.a = litF * aoF * 0.55f;

            _v.Add(at);
            _c.Add(col);
            return bright;
        }
    }
}
