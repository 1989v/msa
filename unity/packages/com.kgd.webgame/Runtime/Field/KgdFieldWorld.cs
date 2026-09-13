using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Kgd.Field
{
    /// <summary>
    /// 끝없이 이어지는 **밀도 세계**. 칸마다 「얼마나 찼나」와 「무엇으로 찼나」를 들고,
    /// 표면은 칸 경계가 아니라 **밀도가 문턱을 지나는 자리**에 선다.
    ///
    /// **왜 <see cref="Kgd.Voxel.KgdVoxelWorld"/> 로 안 되나** — 그쪽은 칸이 차 있거나 비어
    /// 있거나 둘 중 하나라, 어떤 잡음을 넣어도 면이 칸 경계에만 설 수 있다. 그게 곧 정육면체다.
    /// 여기는 칸마다 0~255 의 값을 들고 있어서 면이 칸 **안쪽 어디에나** 설 수 있다.
    ///
    /// **나머지는 그대로 물려받았다.** 청크를 언제 만들고 버릴지, 빛을 어떻게 흘릴지,
    /// 바꾼 것만 저장하는 방식은 복셀 쪽에서 검증된 것과 같다 — 바뀐 것은 기하뿐이다.
    ///
    /// **사람이 바꾼 것은 청크가 아니라 따로 남는다.** 청크를 버렸다 다시 만들어도 생성기가
    /// 같은 값을 내므로, 저장해야 하는 것은 **씨앗 하나와 바뀐 칸 목록**뿐이다.
    /// </summary>
    public sealed class KgdFieldWorld
    {
        public const int SX = 16, SZ = 16;

        /// <summary>표면이 되는 밀도. 이보다 크면 속, 작으면 바깥이다.</summary>
        public const byte Iso = 128;

        public readonly int Height;

        /// <summary>재료표. 인덱스가 곧 재료 id 이고 0 은 없는 것이다.</summary>
        public readonly KgdFieldKind[] Kinds;

        /// <summary>
        /// 청크 하나를 채운다 — (청크 x, 청크 z, 밀도 배열, 재료 배열). 둘 다 길이가 SX*SZ*Height 다.
        /// </summary>
        public Action<int, int, byte[], byte[]> Generate;

        public Transform Root;
        public Material Surface;
        public Material LiquidSurface;

        /// <summary>
        /// 이 높이 아래는 **깊은 층**으로 따로 뜬다. 지상에 있을 때는 그 층을 안 그린다 — 정점의 6할이
        /// 지상에서 보이지도 않는 굴 벽이었다(실측 26.7K 중 16.2K). 게임이 사람의 높이로 <see cref="ShowDeep"/> 을 켠다.
        /// </summary>
        public int DeepBelow = 32;

        private bool _showDeep = true;
        public bool ShowDeep
        {
            get => _showDeep;
            set
            {
                if (_showDeep == value) return;
                _showDeep = value;
                foreach (var kv in _chunks) if (kv.Value.DeepGo != null && kv.Value.DeepMesh != null) kv.Value.DeepGo.SetActive(value);
            }
        }

        public int LoadedChunks => _chunks.Count;
        public int EditCount => _edits.Count;
        public int MeshedThisTick { get; private set; }

        /// <summary>이번에 뜬 메시의 정점 수 합. 폰 예산을 볼 때 쓴다(가드레일 G7).</summary>
        public int VertexCount { get; private set; }

        private sealed class Chunk
        {
            public int Cx, Cz;
            public byte[] Dens;     // 0~255, 128 이 표면
            public byte[] Mat;      // 재료 id
            public byte[] Sky;      // 0~15
            public byte[] Blk;      // 0~15
            public byte[] SkyTop;   // 열마다 「이 높이 위로는 전부 하늘」인 y
            public bool Lit;
            public bool MeshDirty;
            public bool HasLiquid;  // 액체 칸이 하나라도 있나 — 있어야 액체 메시를 뜬다
            public GameObject Go, DeepGo, LiquidGo;
            public Mesh Mesh, DeepMesh, LiquidMesh;
        }

        private readonly Dictionary<long, Chunk> _chunks = new();

        /// <summary>바꾼 칸 — 값은 (밀도 &lt;&lt; 8) | 재료. 두 값이 한 칸을 이루므로 같이 남긴다.</summary>
        private readonly Dictionary<long, ushort> _edits = new();

        private readonly List<long> _drop = new();
        private readonly Queue<long> _unlightQueue = new();

        public KgdFieldWorld(int height, KgdFieldKind[] kinds)
        {
            Height = height;
            Kinds = kinds;
        }

        // ── 좌표 ────────────────────────────────────────────────────────────────

        public static int ChunkOf(int v) => v >> 4;
        private static int LocalOf(int v) => v & 15;
        private static long Key(int cx, int cz) => ((long)cx << 32) ^ (uint)cz;
        private int Index(int lx, int y, int lz) => (y * SZ + lz) * SX + lx;

        private static long EditKey(int x, int y, int z)
            => ((long)(x & 0x3FFFFFF) << 38) | ((long)(z & 0x3FFFFFF) << 12) | (uint)(y & 0xFFF);

        // ── 읽기 ────────────────────────────────────────────────────────────────

        /// <summary>칸이 얼마나 찼나. 세계 밖은 비어 있다 — 바닥은 게임이 심핵으로 깐다.</summary>
        public byte Dens(int x, int y, int z)
        {
            if (y < 0) return 255;
            if (y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            return c == null ? (byte)0 : c.Dens[Index(LocalOf(x), y, LocalOf(z))];
        }

        /// <summary>무엇으로 찼나.</summary>
        public byte Mat(int x, int y, int z)
        {
            if (y < 0 || y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            return c == null ? (byte)0 : c.Mat[Index(LocalOf(x), y, LocalOf(z))];
        }

        public bool Solid(int x, int y, int z) => Dens(x, y, z) > Iso;

        /// <summary>
        /// **상(相)을 가려 읽는다.** 땅을 뜨고 부딪힐 때는 밀도 그대로다 — 수액 칸도 **그 자리 땅의
        /// 밀도**를 갖고 있어(생성기가 그렇게 넣는다) 물속 바닥이 등치면으로 선다. 수면을 뜰 때는
        /// 재료가 액체인 칸만 가득 찬 것으로, 나머지는 빈 것으로 본다 — 그래서 수면이 칸 한가운데
        /// 높이에 평평하게 선다.
        /// </summary>
        public byte Phase(int x, int y, int z, bool liquid)
        {
            if (!liquid) return Dens(x, y, z);
            if (y < 0 || y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return 0;
            return Kinds[c.Mat[Index(LocalOf(x), y, LocalOf(z))]].Liquid ? (byte)255 : (byte)0;
        }

        public bool IsOpaque(int x, int y, int z)
        {
            if (y < 0 || y >= Height) return false;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return false;
            int i = Index(LocalOf(x), y, LocalOf(z));
            return c.Dens[i] > Iso && Kinds[c.Mat[i]].Opaque;
        }

        /// <summary>액체 칸인가. 밀도는 안 본다 — 수액 칸의 밀도는 땅의 것이라 표면 아래일 수 있다.</summary>
        public bool IsLiquid(int x, int y, int z) => Kinds[Mat(x, y, z)].Liquid;

        /// <summary>하늘빛 0~15. 아직 안 만든 곳은 하늘로 친다 — 안 그러면 세계 가장자리가 새까맣다.</summary>
        public int SkyLight(int x, int y, int z)
        {
            if (y >= Height) return 15;
            if (y < 0) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return 15;
            int lx = LocalOf(x), lz = LocalOf(z);
            if (y >= c.SkyTop[lz * SX + lx]) return 15;
            return c.Sky[Index(lx, y, lz)];
        }

        public int BlockLight(int x, int y, int z)
        {
            if (y < 0 || y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return 0;
            return c.Blk[Index(LocalOf(x), y, LocalOf(z))];
        }

        public bool Ready(int x, int z) => Find(ChunkOf(x), ChunkOf(z)) != null;

        /// <summary>
        /// 칸 사이를 보간해 읽는다. **충돌과 조준이 이것을 본다** — 칸 단위로만 읽으면
        /// 표면이 다시 칸 경계에 있는 것처럼 굴어, 매끈하게 그려 놓고 네모에 부딪히게 된다.
        /// </summary>
        public float Sample(Vector3 p, bool liquid = false)
        {
            int i = Mathf.FloorToInt(p.x), j = Mathf.FloorToInt(p.y), k = Mathf.FloorToInt(p.z);
            float tx = p.x - i, ty = p.y - j, tz = p.z - k;

            float c00 = Mathf.Lerp(Phase(i, j, k, liquid), Phase(i + 1, j, k, liquid), tx);
            float c10 = Mathf.Lerp(Phase(i, j + 1, k, liquid), Phase(i + 1, j + 1, k, liquid), tx);
            float c01 = Mathf.Lerp(Phase(i, j, k + 1, liquid), Phase(i + 1, j, k + 1, liquid), tx);
            float c11 = Mathf.Lerp(Phase(i, j + 1, k + 1, liquid), Phase(i + 1, j + 1, k + 1, liquid), tx);
            return Mathf.Lerp(Mathf.Lerp(c00, c10, ty), Mathf.Lerp(c01, c11, ty), tz) - Iso;
        }

        /// <summary>표면이 어느 쪽을 보나. 밀도의 기울기가 곧 법선이다.</summary>
        public Vector3 Normal(Vector3 p, bool liquid = false)
        {
            const float h = 0.6f;
            var g = new Vector3(
                Sample(p + Vector3.right * h, liquid) - Sample(p - Vector3.right * h, liquid),
                Sample(p + Vector3.up * h, liquid) - Sample(p - Vector3.up * h, liquid),
                Sample(p + Vector3.forward * h, liquid) - Sample(p - Vector3.forward * h, liquid));
            return g.sqrMagnitude < 1e-6f ? Vector3.up : -g.normalized;
        }

        /// <summary>
        /// 표면까지의 거리(칸) 어림 — 밀도를 기울기로 나눈다. 양수면 속, 음수면 바깥.
        /// 장이 거리장은 아니지만 표면 가까이에선 충분히 맞고, 몸을 밀어내는 데는 그거면 된다.
        /// </summary>
        public float Depth(Vector3 p, out Vector3 outward, bool liquid = false)
        {
            const float h = 0.6f;
            var g = new Vector3(
                Sample(p + Vector3.right * h, liquid) - Sample(p - Vector3.right * h, liquid),
                Sample(p + Vector3.up * h, liquid) - Sample(p - Vector3.up * h, liquid),
                Sample(p + Vector3.forward * h, liquid) - Sample(p - Vector3.forward * h, liquid)) / (2f * h);
            float slope = g.magnitude;
            if (slope < 1e-4f) { outward = Vector3.up; return Sample(p, liquid) > 0f ? 1f : -1f; }
            outward = -g / slope;
            return Sample(p, liquid) / slope;
        }

        internal void ChunkRef(int cx, int cz, out byte[] dens, out byte[] mat,
                               out byte[] sky, out byte[] blk, out byte[] skyTop)
        {
            var c = Find(cx, cz);
            if (c == null) { dens = null; mat = null; sky = null; blk = null; skyTop = null; return; }
            dens = c.Dens; mat = c.Mat; sky = c.Sky; blk = c.Blk; skyTop = c.SkyTop;
        }

        // ── 쓰기 ────────────────────────────────────────────────────────────────

        /// <summary>
        /// 한 칸을 바꾼다. 바뀐 것은 편집 목록에 남아 저장·복원된다.
        /// **문턱을 넘나들 때만** 빛을 다시 흘린다 — 표면이 조금 눌린 것으로 굴을 다시 켜면
        /// 파는 동안 프레임이 통째로 끊긴다.
        /// </summary>
        public bool Set(int x, int y, int z, byte dens, byte mat)
        {
            if (y < 0 || y >= Height) return false;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return false;

            int i = Index(LocalOf(x), y, LocalOf(z));
            byte wasD = c.Dens[i], wasM = c.Mat[i];
            if (wasD == dens && wasM == mat) return false;

            c.Dens[i] = dens;
            c.Mat[i] = mat;
            if (Kinds[mat].Liquid) c.HasLiquid = true;
            _edits[EditKey(x, y, z)] = (ushort)((dens << 8) | mat);

            bool wasOpaque = wasD > Iso && Kinds[wasM].Opaque;
            bool nowOpaque = dens > Iso && Kinds[mat].Opaque;
            byte wasGlow = wasD > Iso ? Kinds[wasM].Glow : (byte)0;
            byte nowGlow = dens > Iso ? Kinds[mat].Glow : (byte)0;
            if (wasOpaque != nowOpaque || wasGlow != nowGlow) Relight(x, y, z, nowGlow, c);

            TouchAround(x, y, z);
            return true;
        }

        /// <summary>
        /// 남이 바꾼 칸을 받아 넣는다. **아직 안 만든 청크의 것도 대장에 남긴다** —
        /// 버리면 멀리서 판 굴이 걸어갔을 때 없다.
        /// </summary>
        public void Accept(int x, int y, int z, byte dens, byte mat)
        {
            if (y < 0 || y >= Height) return;
            _edits[EditKey(x, y, z)] = (ushort)((dens << 8) | mat);
            Set(x, y, z, dens, mat);
        }

        /// <summary>
        /// **구 모양으로 깎거나 붙인다.** 이 세계에서 「캔다」는 칸이 사라지는 것이 아니라
        /// 밀도가 눌리는 것이라, 파낸 자리가 둥글다.
        /// </summary>
        /// <param name="amount">한 번에 미는 양(0~255 기준). 음수면 깎고 양수면 붙인다.</param>
        /// <param name="mat">붙일 때 쓰는 재료. 깎을 때는 안 본다.</param>
        /// <param name="flipped">표면을 넘어간 칸마다 (재료, 차게 됐나). 캔 양·쓴 양이 여기서 나온다.</param>
        /// <returns>실제로 바뀐 칸 수.</returns>
        public int Carve(Vector3 at, float radius, float amount, byte mat, Action<byte, bool> flipped = null)
        {
            int r = Mathf.CeilToInt(radius) + 1;
            int cx = Mathf.RoundToInt(at.x), cy = Mathf.RoundToInt(at.y), cz = Mathf.RoundToInt(at.z);
            int touched = 0;

            for (int z = cz - r; z <= cz + r; z++)
            {
                for (int y = cy - r; y <= cy + r; y++)
                {
                    for (int x = cx - r; x <= cx + r; x++)
                    {
                        float d = new Vector3(x - at.x, y - at.y, z - at.z).magnitude;
                        if (d > radius) continue;

                        // 가장자리로 갈수록 덜 민다 — 안 그러면 파낸 자리가 각진 공이 된다
                        float fall = 1f - d / radius;
                        float push = amount * fall * fall;
                        byte now = Dens(x, y, z);
                        int next = Mathf.Clamp(Mathf.RoundToInt(now + push), 0, 255);
                        if (next == now) continue;

                        byte material = Mat(x, y, z);
                        // 액체는 깎이지 않는다 — 수액을 파면 물이 빠지는 것이 아니라 그냥 사라진다.
                        // 단단함이 음수인 것(심핵)도 — 그게 세계의 바닥이다
                        if (push < 0f && now > Iso && (Kinds[material].Liquid || Kinds[material].Hardness < 0f)) continue;
                        // 붙일 때는 재료를 같이 정한다. 깎을 때는 남은 것의 재료를 그대로 둔다.
                        if (push > 0f && (material == 0 || Kinds[material].Liquid || next > Iso && now <= Iso)) material = mat;

                        bool wasIn = now > Iso, nowIn = next > Iso;
                        if (Set(x, y, z, (byte)next, material))
                        {
                            touched++;
                            if (wasIn != nowIn) flipped?.Invoke(nowIn ? material : Mat(x, y, z), nowIn);
                        }
                    }
                }
            }
            return touched;
        }

        public void MarkDirty(int cx, int cz)
        {
            var c = Find(cx, cz);
            if (c != null) c.MeshDirty = true;
        }

        private void TouchAround(int x, int y, int z)
        {
            int cx = ChunkOf(x), cz = ChunkOf(z);
            MarkDirty(cx, cz);
            int lx = LocalOf(x), lz = LocalOf(z);
            // **한 칸이 아니라 두 칸을 본다.** 등치면은 이웃 칸까지 넘겨 보고 꼭짓점을 놓으므로,
            // 경계에서 한 칸만 알리면 옆 청크의 면이 안 따라와 이음매가 갈라진다.
            if (lx <= 1) MarkDirty(cx - 1, cz);
            if (lx >= SX - 2) MarkDirty(cx + 1, cz);
            if (lz <= 1) MarkDirty(cx, cz - 1);
            if (lz >= SZ - 2) MarkDirty(cx, cz + 1);
        }

        // ── 스트리밍 ─────────────────────────────────────────────────────────────

        /// <summary>
        /// 걸어간 만큼 세계를 잇는다. 만들기와 그리기에 각각 예산을 건다 —
        /// 그리기에만 걸면 보이는 반경이 넓어진 첫 프레임에 청크 수백 개를 만들어 몇 초가 멎는다.
        /// </summary>
        public void Tick(Vector3 center, int radius, int meshBudget = 2, int genBudget = 4)
        {
            MeshedThisTick = 0;
            int made = 0;
            int ccx = ChunkOf(Mathf.FloorToInt(center.x));
            int ccz = ChunkOf(Mathf.FloorToInt(center.z));

            for (int r = 0; r <= radius; r++)
            {
                for (int dz = -r; dz <= r; dz++)
                {
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dz)) != r) continue;
                        if (Find(ccx + dx, ccz + dz) == null)
                        {
                            if (made >= genBudget) continue;
                            made++;
                        }
                        Ensure(ccx + dx, ccz + dz);
                    }
                }

                if (r == 0) continue;
                for (int dz = -(r - 1); dz <= r - 1; dz++)
                {
                    for (int dx = -(r - 1); dx <= r - 1; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dz)) != r - 1) continue;
                        if (MeshedThisTick >= meshBudget) break;
                        Refresh(ccx + dx, ccz + dz);
                    }
                }
            }

            Unload(ccx, ccz, radius + 2);
        }

        public void Prime(Vector3 center, int radius)
        {
            int ccx = ChunkOf(Mathf.FloorToInt(center.x));
            int ccz = ChunkOf(Mathf.FloorToInt(center.z));
            for (int dz = -radius - 1; dz <= radius + 1; dz++)
                for (int dx = -radius - 1; dx <= radius + 1; dx++)
                    Ensure(ccx + dx, ccz + dz);
            for (int dz = -radius; dz <= radius; dz++)
                for (int dx = -radius; dx <= radius; dx++)
                    Refresh(ccx + dx, ccz + dz);
        }

        private Chunk Find(int cx, int cz) => _chunks.TryGetValue(Key(cx, cz), out var c) ? c : null;

        private Chunk Ensure(int cx, int cz)
        {
            long k = Key(cx, cz);
            if (_chunks.TryGetValue(k, out var c)) return c;

            int n = SX * SZ * Height;
            c = new Chunk
            {
                Cx = cx, Cz = cz,
                Dens = new byte[n], Mat = new byte[n],
                Sky = new byte[n], Blk = new byte[n],
                SkyTop = new byte[SX * SZ],
                MeshDirty = true,
            };
            _chunks[k] = c;

            Generate?.Invoke(cx, cz, c.Dens, c.Mat);
            for (int i = 0; i < n && !c.HasLiquid; i++)
                if (Kinds[c.Mat[i]].Liquid) c.HasLiquid = true;
            ApplyEdits(c);
            ScanSkyTop(c);
            return c;
        }

        private void ScanSkyTop(Chunk c)
        {
            for (int lz = 0; lz < SZ; lz++)
            {
                for (int lx = 0; lx < SX; lx++)
                {
                    int top = 0;
                    for (int y = Height - 1; y >= 0; y--)
                    {
                        int i = Index(lx, y, lz);
                        if (!(c.Dens[i] > Iso && Kinds[c.Mat[i]].Opaque)) continue;
                        top = y + 1;
                        break;
                    }
                    c.SkyTop[lz * SX + lx] = (byte)Mathf.Min(top, Height);
                }
            }
        }

        private void ApplyEdits(Chunk c)
        {
            if (_edits.Count == 0) return;
            int x0 = c.Cx * SX, z0 = c.Cz * SZ;
            for (int lx = 0; lx < SX; lx++)
            {
                for (int lz = 0; lz < SZ; lz++)
                {
                    for (int y = 0; y < Height; y++)
                    {
                        if (!_edits.TryGetValue(EditKey(x0 + lx, y, z0 + lz), out ushort v)) continue;
                        int i = Index(lx, y, lz);
                        c.Dens[i] = (byte)(v >> 8);
                        c.Mat[i] = (byte)(v & 0xFF);
                    }
                }
            }
        }

        private void Refresh(int cx, int cz)
        {
            var c = Find(cx, cz);
            if (c == null) return;
            if (c.Lit && !c.MeshDirty) return;

            for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                    Ensure(cx + dx, cz + dz);

            if (!c.Lit) Light(c);
            if (c.MeshDirty) Mesh(c);
        }

        private void Unload(int ccx, int ccz, int keep)
        {
            _drop.Clear();
            foreach (var kv in _chunks)
            {
                var c = kv.Value;
                if (Mathf.Max(Mathf.Abs(c.Cx - ccx), Mathf.Abs(c.Cz - ccz)) <= keep) continue;
                _drop.Add(kv.Key);
            }
            foreach (long k in _drop)
            {
                var c = _chunks[k];
                if (c.Go != null) UnityEngine.Object.Destroy(c.Go);
                if (c.Mesh != null) UnityEngine.Object.Destroy(c.Mesh);
                if (c.DeepGo != null) UnityEngine.Object.Destroy(c.DeepGo);
                if (c.DeepMesh != null) UnityEngine.Object.Destroy(c.DeepMesh);
                if (c.LiquidGo != null) UnityEngine.Object.Destroy(c.LiquidGo);
                if (c.LiquidMesh != null) UnityEngine.Object.Destroy(c.LiquidMesh);
                _chunks.Remove(k);
            }
        }

        // ── 빛 ──────────────────────────────────────────────────────────────────

        private readonly List<Vector3Int> _seeds = new();

        private static readonly Vector3Int[] Six =
        {
            new(1, 0, 0), new(-1, 0, 0), new(0, 1, 0), new(0, -1, 0), new(0, 0, 1), new(0, 0, -1),
        };

        /// <summary>
        /// 청크 하나를 처음 켠다. **하늘이 뚫린 칸은 저장하지 않는다** — 열마다 「이 위로는 전부
        /// 하늘」인 높이만 적어 두고 그보다 위를 물으면 15 를 돌려주므로, 흘려보낼 대상이
        /// 그늘진 칸만 남는다.
        /// </summary>
        private void Light(Chunk c)
        {
            Array.Clear(c.Sky, 0, c.Sky.Length);
            Array.Clear(c.Blk, 0, c.Blk.Length);

            int x0 = c.Cx * SX, z0 = c.Cz * SZ;
            c.Lit = true;

            for (int lz = 0; lz < SZ; lz++)
            {
                for (int lx = 0; lx < SX; lx++)
                {
                    int top = c.SkyTop[lz * SX + lx];
                    for (int y = top - 1; y >= 0; y--)
                    {
                        int i = Index(lx, y, lz);
                        if (c.Dens[i] > Iso && Kinds[c.Mat[i]].Opaque) continue;
                        int x = x0 + lx, z = z0 + lz;
                        int best = 0;
                        for (int d = 0; d < 6; d++)
                        {
                            var n = new Vector3Int(x, y, z) + Six[d];
                            if (n.y < 0 || n.y >= Height || IsOpaque(n.x, n.y, n.z)) continue;
                            int nl = SkyLight(n.x, n.y, n.z);
                            int decay = d == 2 && nl == 15 ? 0 : 1;
                            if (nl - decay > best) best = nl - decay;
                        }
                        if (best <= 0) continue;
                        SetSky(x, y, z, best);
                        _seeds.Add(new Vector3Int(x, y, z));
                    }
                }
            }
            Flow(sky: true);

            for (int lz = 0; lz < SZ; lz++)
            {
                for (int lx = 0; lx < SX; lx++)
                {
                    for (int y = 0; y < Height; y++)
                    {
                        int i = Index(lx, y, lz);
                        if (c.Dens[i] <= Iso) continue;
                        byte glow = Kinds[c.Mat[i]].Glow;
                        if (glow == 0) continue;
                        SetBlk(x0 + lx, y, z0 + lz, glow);
                        _seeds.Add(new Vector3Int(x0 + lx, y, z0 + lz));
                    }
                }
            }
            Flow(sky: false);

            c.MeshDirty = true;
        }

        private void Flow(bool sky)
        {
            for (int head = 0; head < _seeds.Count; head++)
            {
                var p = _seeds[head];
                int level = sky ? SkyLight(p.x, p.y, p.z) : BlockLight(p.x, p.y, p.z);
                if (level <= 1) continue;

                for (int d = 0; d < 6; d++)
                {
                    var n = p + Six[d];
                    if (n.y < 0 || n.y >= Height) continue;
                    if (IsOpaque(n.x, n.y, n.z)) continue;
                    if (!Ready(n.x, n.z)) continue;

                    int decay = IsLiquid(n.x, n.y, n.z) ? 3 : 1;
                    int next = sky && d == 3 && level == 15 ? 15 : level - decay;
                    if (next <= 0) continue;

                    int now = sky ? SkyLight(n.x, n.y, n.z) : BlockLight(n.x, n.y, n.z);
                    if (now >= next) continue;

                    if (sky) SetSky(n.x, n.y, n.z, next); else SetBlk(n.x, n.y, n.z, next);
                    _seeds.Add(n);
                    Touch(n.x, n.z);
                }
            }
            _seeds.Clear();
        }

        private void SetSky(int x, int y, int z, int v)
        {
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return;
            c.Sky[Index(LocalOf(x), y, LocalOf(z))] = (byte)Mathf.Clamp(v, 0, 15);
        }

        private void SetBlk(int x, int y, int z, int v)
        {
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return;
            c.Blk[Index(LocalOf(x), y, LocalOf(z))] = (byte)Mathf.Clamp(v, 0, 15);
        }

        private void Touch(int x, int z)
        {
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c != null) c.MeshDirty = true;
        }

        /// <summary>
        /// 한 칸이 문턱을 넘나든 자리의 빛만 고친다. 어두워지는 쪽이 먼저다 —
        /// 지우지 않고 새로 흘리면 **없어진 등불의 빛이 남는다.**
        /// </summary>
        private void Relight(int x, int y, int z, byte glow, Chunk c)
        {
            int lx = LocalOf(x), lz = LocalOf(z);
            int top = 0;
            for (int yy = Height - 1; yy >= 0; yy--)
            {
                int i = Index(lx, yy, lz);
                if (!(c.Dens[i] > Iso && Kinds[c.Mat[i]].Opaque)) continue;
                top = yy + 1;
                break;
            }
            c.SkyTop[lz * SX + lx] = (byte)Mathf.Min(top, Height);

            Drain(x, y, z, sky: false);
            if (glow > 0) { SetBlk(x, y, z, glow); _seeds.Add(new Vector3Int(x, y, z)); }
            Flow(sky: false);

            Drain(x, y, z, sky: true);
            SeedSkyNear(x, y, z);
            Flow(sky: true);
        }

        private void Drain(int x, int y, int z, bool sky)
        {
            _unlightQueue.Clear();
            int level = sky ? SkyLight(x, y, z) : BlockLight(x, y, z);
            if (level <= 0) return;

            if (sky) SetSky(x, y, z, 0); else SetBlk(x, y, z, 0);
            _unlightQueue.Enqueue(Pack(x, y, z, level));

            while (_unlightQueue.Count > 0)
            {
                Unpack(_unlightQueue.Dequeue(), out int px, out int py, out int pz, out int plevel);
                for (int d = 0; d < 6; d++)
                {
                    var n = new Vector3Int(px, py, pz) + Six[d];
                    if (n.y < 0 || n.y >= Height || !Ready(n.x, n.z)) continue;
                    int nl = sky ? SkyLight(n.x, n.y, n.z) : BlockLight(n.x, n.y, n.z);
                    if (nl == 0) continue;

                    if (nl < plevel || (sky && d == 3 && plevel == 15))
                    {
                        if (sky) SetSky(n.x, n.y, n.z, 0); else SetBlk(n.x, n.y, n.z, 0);
                        _unlightQueue.Enqueue(Pack(n.x, n.y, n.z, nl));
                        Touch(n.x, n.z);
                    }
                    else _seeds.Add(n);
                }
            }
        }

        private void SeedSkyNear(int x, int y, int z)
        {
            for (int dz = -1; dz <= 1; dz++)
            {
                for (int dx = -1; dx <= 1; dx++)
                {
                    var c = Find(ChunkOf(x + dx), ChunkOf(z + dz));
                    if (c == null) continue;
                    int lx = LocalOf(x + dx), lz = LocalOf(z + dz);
                    int top = c.SkyTop[lz * SX + lx];
                    for (int yy = Mathf.Max(0, y - 16); yy <= Mathf.Min(Height - 1, y + 16); yy++)
                    {
                        if (yy < top) continue;
                        _seeds.Add(new Vector3Int(x + dx, yy, z + dz));
                    }
                }
            }
        }

        private static long Pack(int x, int y, int z, int level)
            => ((long)(x & 0xFFFFF) << 44) | ((long)(z & 0xFFFFF) << 24) | ((long)(y & 0xFFF) << 12) | (uint)level;

        private static void Unpack(long v, out int x, out int y, out int z, out int level)
        {
            x = (int)(v >> 44) & 0xFFFFF; if (x > 0x7FFFF) x -= 0x100000;
            z = (int)(v >> 24) & 0xFFFFF; if (z > 0x7FFFF) z -= 0x100000;
            y = (int)(v >> 12) & 0xFFF;
            level = (int)(v & 0xFFF);
        }

        // ── 메시 ────────────────────────────────────────────────────────────────

        private void Mesh(Chunk c)
        {
            c.Mesh = Swap(c, c.Mesh, KgdFieldMesher.Build(this, c.Cx, c.Cz, liquid: false, yFrom: DeepBelow), ref c.Go, Surface, "field");
            c.DeepMesh = Swap(c, c.DeepMesh, KgdFieldMesher.Build(this, c.Cx, c.Cz, liquid: false, yTo: DeepBelow), ref c.DeepGo, Surface, "deep");
            if (c.DeepGo != null && !_showDeep) c.DeepGo.SetActive(false);
            // 수면은 따로 뜬다 — 땅과 한 면으로 뜨면 재료 하나로 색이 갈리는 것이 전부라 물이 땅처럼 보인다
            c.LiquidMesh = c.HasLiquid
                ? Swap(c, c.LiquidMesh, KgdFieldMesher.Build(this, c.Cx, c.Cz, liquid: true), ref c.LiquidGo, LiquidSurface, "sap")
                : Swap(c, c.LiquidMesh, null, ref c.LiquidGo, LiquidSurface, "sap");

            c.MeshDirty = false;
            MeshedThisTick++;
            VertexCount = 0;
            foreach (var kv in _chunks)
            {
                if (kv.Value.Mesh != null) VertexCount += kv.Value.Mesh.vertexCount;
                if (_showDeep && kv.Value.DeepMesh != null) VertexCount += kv.Value.DeepMesh.vertexCount;
                if (kv.Value.LiquidMesh != null) VertexCount += kv.Value.LiquidMesh.vertexCount;
            }
        }

        private Mesh Swap(Chunk c, Mesh old, Mesh built, ref GameObject go, Material material, string tag)
        {
            if (old != null) UnityEngine.Object.Destroy(old);

            if (built == null)
            {
                if (go != null) go.SetActive(false);
            }
            else if (go == null)
            {
                // 그림자를 끈다 — 밝기는 이미 정점에 구워 넣었고, 그림자 맵을 청크 수만큼
                // 다시 그리면 폰에서 그것만으로 예산을 넘긴다 (가드레일 G7).
                go = Kgd.Art.KgdMat.Object($"{tag}_{c.Cx}_{c.Cz}", built, Root, shadows: false);
                go.transform.localPosition = new Vector3(c.Cx * SX, 0f, c.Cz * SZ);
                if (material != null) go.GetComponent<MeshRenderer>().sharedMaterial = material;
            }
            else
            {
                go.SetActive(true);
                go.GetComponent<MeshFilter>().sharedMesh = built;
            }
            return built;
        }

        // ── 저장 ────────────────────────────────────────────────────────────────

        /// <summary>바꾼 칸만 문자열로. 씨앗은 게임이 따로 저장한다.</summary>
        public string SaveEdits()
        {
            var sb = new StringBuilder(_edits.Count * 14);
            foreach (var kv in _edits)
            {
                Unpack2(kv.Key, out int x, out int y, out int z);
                sb.Append(x).Append(',').Append(y).Append(',').Append(z).Append(',')
                  .Append(kv.Value >> 8).Append(',').Append(kv.Value & 0xFF).Append(';');
            }
            return sb.ToString();
        }

        /// <summary>
        /// 저장한 편집을 되돌린다. **청크를 만들기 전에 부른다** — 뒤에 부르면 이미 만든
        /// 청크가 생성기 값 그대로 남아, 판 굴이 메워진 판에서 시작한다.
        /// </summary>
        public void LoadEdits(string data)
        {
            _edits.Clear();
            MergeEdits(data);
        }

        /// <summary>
        /// 편집 목록을 **지우지 않고** 얹는다. 조각으로 나눠 받은 것을 차례로 넣을 때 쓴다.
        /// 목록에 적기만 하고 이미 만든 청크에 곧바로 반영하지는 않는다 — 순서가 규칙이다.
        /// </summary>
        public int MergeEdits(string data)
        {
            if (string.IsNullOrEmpty(data)) return 0;

            int took = 0;
            foreach (string row in data.Split(';'))
            {
                if (row.Length < 9) continue;
                var f = row.Split(',');
                if (f.Length != 5) continue;
                if (!int.TryParse(f[0], out int x) || !int.TryParse(f[1], out int y) ||
                    !int.TryParse(f[2], out int z) || !byte.TryParse(f[3], out byte dens) ||
                    !byte.TryParse(f[4], out byte mat)) continue;
                _edits[EditKey(x, y, z)] = (ushort)((dens << 8) | mat);
                took++;
            }
            return took;
        }

        /// <summary>
        /// 편집 대장을 조각으로 나눠 돌려준다 — 릴레이 메시지에 4KB 상한이 있어 한 번에 못 보낸다.
        /// **나누기 전에 한 번에 다 뜬다**: 보내는 동안 누가 파면 훑는 순서가 바뀐다.
        /// </summary>
        public string[] EditPages(int maxChars)
        {
            var pages = new List<string>();
            if (_edits.Count == 0) return pages.ToArray();

            int room = Mathf.Max(64, maxChars);
            var sb = new StringBuilder(room);
            foreach (var kv in _edits)
            {
                Unpack2(kv.Key, out int x, out int y, out int z);
                string row = $"{x},{y},{z},{kv.Value >> 8},{kv.Value & 0xFF};";
                if (sb.Length > 0 && sb.Length + row.Length > room)
                {
                    pages.Add(sb.ToString());
                    sb.Length = 0;
                }
                sb.Append(row);
            }
            if (sb.Length > 0) pages.Add(sb.ToString());
            return pages.ToArray();
        }

        private static void Unpack2(long v, out int x, out int y, out int z)
        {
            x = (int)(v >> 38) & 0x3FFFFFF; if (x > 0x1FFFFFF) x -= 0x4000000;
            z = (int)(v >> 12) & 0x3FFFFFF; if (z > 0x1FFFFFF) z -= 0x4000000;
            y = (int)(v & 0xFFF);
        }
    }
}
