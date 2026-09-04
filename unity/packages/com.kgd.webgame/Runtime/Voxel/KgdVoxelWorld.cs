using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace Kgd.Voxel
{
    /// <summary>
    /// 끝없이 이어지는 블록 세계. 청크를 필요할 때 만들고, 멀어지면 버린다.
    ///
    /// **왜 <see cref="Kgd.Motion.IKgdGround"/> 로 안 되나** — 그쪽은 xz 한 자리에 높이가
    /// 하나다. 동굴·처마·떠 있는 섬은 같은 xz 에 「막힌 곳」이 여러 층이라 표현할 수 없다.
    /// 그래서 지형을 높이 함수가 아니라 **격자**로 들고, 충돌·시선·빛을 전부 격자 위에서 푼다.
    ///
    /// **지형은 이 클래스가 만들지 않는다.** 게임이 <see cref="Generate"/> 로 청크 하나를
    /// 채우고, 여기는 언제 만들고 언제 버릴지와 빛·메시만 맡는다 — 세계의 생김새는 게임마다
    /// 다르지만 「멀어지면 버린다」는 매번 같다.
    ///
    /// **사람이 바꾼 것은 청크가 아니라 따로 남는다.** 청크를 버렸다 다시 만들어도 생성기가
    /// 같은 값을 내므로, 저장해야 하는 것은 **씨앗 하나와 바뀐 블록 목록**뿐이다.
    /// 청크를 통째로 저장하면 걸어 다닌 만큼 저장이 커진다.
    /// </summary>
    public sealed class KgdVoxelWorld
    {
        public const int SX = 16, SZ = 16;

        /// <summary>세계의 높이. 0 이 바닥, Height-1 이 천장이다.</summary>
        public readonly int Height;

        /// <summary>블록 종류표. 인덱스가 곧 블록 id 이고 0 은 공기다.</summary>
        public readonly KgdVoxelKind[] Kinds;

        /// <summary>청크 하나를 채운다 — (청크 x, 청크 z, 길이 SX*SZ*Height 인 블록 배열).</summary>
        public Action<int, int, byte[]> Generate;

        /// <summary>청크 메시를 매다는 자리.</summary>
        public Transform Root;

        /// <summary>
        /// 청크에 쓸 머티리얼. 안 주면 공용 불투명 머티리얼을 쓴다.
        ///
        /// **표면 무늬를 여기로 넣는다.** 메시가 칸 단위 UV 를 내므로, 되풀이되는 무늬 한 장을
        /// 걸면 넓은 면이 단색 판으로 안 읽히고 블록 경계가 드러난다 — 단색 격자는
        /// 「덜 만든 것」으로 보이는 가장 큰 원인이다.
        /// </summary>
        public Material Surface;

        /// <summary>
        /// 물에 쓸 머티리얼. 안 주면 <see cref="Surface"/> 를 쓴다.
        ///
        /// **지형과 갈라 둔다.** 물은 밑에서 올려다볼 때 수면이 보여야 해서 양면이어야 하는데,
        /// 지형까지 양면으로 그리면 절대 안 보이는 뒷면을 매 프레임 칠하게 되어 픽셀 비용이 배가 된다.
        /// </summary>
        public Material LiquidSurface;

        /// <summary>지금 들고 있는 청크 수. 메모리 감시용.</summary>
        public int LoadedChunks => _chunks.Count;

        /// <summary>사람이 바꾼 블록 수. 저장 크기가 여기 붙는다.</summary>
        public int EditCount => _edits.Count;

        /// <summary>이번 프레임에 새로 그린 청크 수. 프레임이 튀는 원인을 볼 때 쓴다.</summary>
        public int MeshedThisTick { get; private set; }

        private sealed class Chunk
        {
            public int Cx, Cz;
            public byte[] Block;
            public byte[] Sky;      // 0~15
            public byte[] Blk;      // 0~15
            public byte[] SkyTop;   // 열마다 「이 높이 위로는 전부 하늘」인 y (SX*SZ)
            public bool Lit;
            public bool MeshDirty;
            public GameObject SolidGo, LiquidGo;
            public Mesh SolidMesh, LiquidMesh;
        }

        private readonly Dictionary<long, Chunk> _chunks = new();
        private readonly Dictionary<long, byte> _edits = new();
        private readonly List<long> _drop = new();
        private readonly Queue<long> _unlightQueue = new();

        public KgdVoxelWorld(int height, KgdVoxelKind[] kinds)
        {
            Height = height;
            Kinds = kinds;
        }

        // ── 좌표 ────────────────────────────────────────────────────────────────

        public static int ChunkOf(int v) => v >> 4;                 // 음수도 맞다 (-1 >> 4 == -1)
        private static int LocalOf(int v) => v & 15;
        private static long Key(int cx, int cz) => ((long)cx << 32) ^ (uint)cz;
        private int Index(int lx, int y, int lz) => (y * SZ + lz) * SX + lx;

        private static long EditKey(int x, int y, int z)
            => ((long)(x & 0x3FFFFFF) << 38) | ((long)(z & 0x3FFFFFF) << 12) | (uint)(y & 0xFFF);

        // ── 읽기 ────────────────────────────────────────────────────────────────

        /// <summary>블록 id. 세계 밖은 공기(0)다 — 바닥은 게임이 바닥돌로 깐다.</summary>
        public byte Get(int x, int y, int z)
        {
            if (y < 0 || y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            return c == null ? (byte)0 : c.Block[Index(LocalOf(x), y, LocalOf(z))];
        }

        public bool IsSolid(int x, int y, int z) => Kinds[Get(x, y, z)].Solid;
        public bool IsOpaque(int x, int y, int z) => Kinds[Get(x, y, z)].Opaque;
        public bool IsLiquid(int x, int y, int z) => Kinds[Get(x, y, z)].Liquid;

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

        /// <summary>횃불 같은 블록이 내는 빛 0~15.</summary>
        public int BlockLight(int x, int y, int z)
        {
            if (y < 0 || y >= Height) return 0;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return 0;
            return c.Blk[Index(LocalOf(x), y, LocalOf(z))];
        }

        /// <summary>이 자리가 이미 만들어져 있는가. 아직이면 걸어 들어가면 안 된다.</summary>
        public bool Ready(int x, int z) => Find(ChunkOf(x), ChunkOf(z)) != null;

        /// <summary>
        /// 한 열(같은 x·z 의 위아래 전부)의 배열을 그대로 넘긴다. 메시를 뜰 때 칸마다 사전을
        /// 뒤지면 청크 하나에 십만 번이 되므로, **열마다 한 번만** 찾고 나머지는 첨자로 읽는다.
        /// 위아래로 한 칸 갈 때 첨자는 <c>SX*SZ</c> 씩 는다.
        /// </summary>
        internal void ColumnRef(int x, int z, out byte[] block, out byte[] sky, out byte[] blk,
                                out int offset, out int skyTop)
        {
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null)
            {
                block = null; sky = null; blk = null; offset = 0; skyTop = 0;
                return;
            }
            int lx = LocalOf(x), lz = LocalOf(z);
            block = c.Block;
            sky = c.Sky;
            blk = c.Blk;
            offset = lz * SX + lx;
            skyTop = c.SkyTop[offset];
        }

        // ── 쓰기 ────────────────────────────────────────────────────────────────

        /// <summary>
        /// 블록을 놓거나 캔다. 바뀐 것은 편집 목록에 남아 저장·복원된다.
        /// 빛은 그 자리 둘레만 다시 흘려보내고, **빛이 실제로 닿은 청크만** 다시 그린다 —
        /// 3×3 을 통째로 다시 켜면 블록 하나 놓을 때마다 프레임이 끊긴다.
        /// </summary>
        public bool Set(int x, int y, int z, byte id)
        {
            if (y < 0 || y >= Height) return false;
            var c = Find(ChunkOf(x), ChunkOf(z));
            if (c == null) return false;

            int i = Index(LocalOf(x), y, LocalOf(z));
            byte old = c.Block[i];
            if (old == id) return false;

            c.Block[i] = id;
            _edits[EditKey(x, y, z)] = id;

            RelightAround(x, y, z, Kinds[old], Kinds[id], c);
            TouchAround(x, y, z);
            return true;
        }

        /// <summary>메시만 다시 뜬다 — 빛이 안 바뀌는 변경(같은 성질의 블록 교체)에 쓴다.</summary>
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
            if (lx == 0) MarkDirty(cx - 1, cz);
            if (lx == SX - 1) MarkDirty(cx + 1, cz);
            if (lz == 0) MarkDirty(cx, cz - 1);
            if (lz == SZ - 1) MarkDirty(cx, cz + 1);
        }

        // ── 스트리밍 ─────────────────────────────────────────────────────────────

        /// <summary>
        /// 걸어간 만큼 세계를 잇는다.
        ///
        /// **만들기와 그리기에 각각 예산을 건다.** 둘 다 비싸다 — 블록을 채우는 것은
        /// 열마다 잡음을 도는 일이고 메시는 면을 합치는 일이다. 그리기에만 예산을 걸면
        /// 보이는 반경이 넓어진 첫 프레임에 청크 수백 개를 **만들어** 몇 초가 멎는다.
        /// </summary>
        public void Tick(Vector3 center, int radius, int meshBudget = 2, int genBudget = 4)
        {
            MeshedThisTick = 0;
            int made = 0;
            int ccx = ChunkOf(Mathf.FloorToInt(center.x));
            int ccz = ChunkOf(Mathf.FloorToInt(center.z));

            // 가까운 것부터 — 눈앞이 먼저 채워져야 걸어 들어갈 곳이 생긴다.
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

                // 한 칸 안쪽까지 이웃이 다 있어야 빛과 면 가림이 맞는다.
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

        /// <summary>
        /// 부팅 때 한 번 — 예산을 안 걸고 눈앞을 통째로 채운다.
        /// **반경을 크게 주지 마라.** 여기서 만든 청크 수가 그대로 첫 화면까지의 시간이고,
        /// 그 예산은 5초다. 나머지는 <see cref="Tick"/> 이 걸어가는 동안 잇는다.
        /// </summary>
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

            c = new Chunk
            {
                Cx = cx,
                Cz = cz,
                Block = new byte[SX * SZ * Height],
                Sky = new byte[SX * SZ * Height],
                Blk = new byte[SX * SZ * Height],
                SkyTop = new byte[SX * SZ],
                MeshDirty = true,
            };
            _chunks[k] = c;

            Generate?.Invoke(cx, cz, c.Block);
            ApplyEdits(c);
            // **빛을 흘리기 전에 열 높이를 적어 둔다.** 이 값이 비어 있으면 SkyLight 가 그 청크를
            // 「전부 하늘」로 읽어, 아직 안 켠 이웃 옆의 동굴이 대낮처럼 밝아진다.
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
                        if (!Kinds[c.Block[Index(lx, y, lz)]].Opaque) continue;
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
            // 편집이 많아도 청크 하나가 담는 칸만 훑는다 — 목록 전체를 도는 것보다 싸다.
            for (int lx = 0; lx < SX; lx++)
            {
                for (int lz = 0; lz < SZ; lz++)
                {
                    for (int y = 0; y < Height; y++)
                    {
                        if (!_edits.TryGetValue(EditKey(x0 + lx, y, z0 + lz), out byte id)) continue;
                        c.Block[Index(lx, y, lz)] = id;
                    }
                }
            }
        }

        private void Refresh(int cx, int cz)
        {
            var c = Find(cx, cz);
            if (c == null) return;
            if (c.Lit && !c.MeshDirty) return;

            // 이웃이 없으면 가장자리 면 가림과 빛이 틀린다 — 먼저 채운다.
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
                if (c.SolidGo != null) UnityEngine.Object.Destroy(c.SolidGo);
                if (c.LiquidGo != null) UnityEngine.Object.Destroy(c.LiquidGo);
                if (c.SolidMesh != null) UnityEngine.Object.Destroy(c.SolidMesh);
                if (c.LiquidMesh != null) UnityEngine.Object.Destroy(c.LiquidMesh);
                _chunks.Remove(k);
            }
        }

        // ── 빛 ──────────────────────────────────────────────────────────────────

        /// <summary>
        /// 청크 하나를 처음 켠다.
        ///
        /// **하늘이 뚫린 칸은 저장하지 않는다.** 열마다 「이 위로는 전부 하늘」인 높이
        /// (<c>SkyTop</c>)만 적어 두고, 그보다 위를 물으면 15 를 돌려준다. 그러면 흘려보낼
        /// 대상이 **그늘진 칸**만 남아서, 하늘이 넓어도 비용이 지형 모양만 따라간다.
        /// </summary>
        private void Light(Chunk c)
        {
            Array.Clear(c.Sky, 0, c.Sky.Length);
            Array.Clear(c.Blk, 0, c.Blk.Length);

            int x0 = c.Cx * SX, z0 = c.Cz * SZ;
            c.Lit = true;

            // 그늘진 칸 중 **밝은 이웃을 가진 것**만 씨앗이 된다. 이웃이 하늘일 수도 있고
            // (열린 하늘은 저장 없이 15 다) 이미 켜 둔 옆 청크일 수도 있다 — 뒤엣것을 빼면
            // 옆 청크에서 뚫고 들어온 동굴이 경계에서 뚝 끊겨 새까매진다.
            for (int lz = 0; lz < SZ; lz++)
            {
                for (int lx = 0; lx < SX; lx++)
                {
                    int top = c.SkyTop[lz * SX + lx];
                    for (int y = top - 1; y >= 0; y--)
                    {
                        if (Kinds[c.Block[Index(lx, y, lz)]].Opaque) continue;
                        int x = x0 + lx, z = z0 + lz;
                        int best = 0;
                        for (int d = 0; d < 6; d++)
                        {
                            var n = new Vector3Int(x, y, z) + Six[d];
                            if (n.y < 0 || n.y >= Height || IsOpaque(n.x, n.y, n.z)) continue;
                            int nl = SkyLight(n.x, n.y, n.z);
                            int decay = d == 2 && nl == 15 ? 0 : 1;   // 바로 위에서 내려오면 안 준다
                            if (nl - decay > best) best = nl - decay;
                        }
                        if (best <= 0) continue;
                        SetSky(x, y, z, best);
                        Push(x, y, z);
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
                        byte glow = Kinds[c.Block[Index(lx, y, lz)]].Glow;
                        if (glow == 0) continue;
                        SetBlk(x0 + lx, y, z0 + lz, glow);
                        Push(x0 + lx, y, z0 + lz);
                    }
                }
            }
            Flow(sky: false);

            c.MeshDirty = true;
        }

        // 흘려보낼 자리를 큐에 담는다. 좌표 셋을 int 하나로 눌러 담아 큐가 값 타입으로 남게 한다.
        private readonly List<Vector3Int> _seeds = new();

        private void Push(int x, int y, int z) => _seeds.Add(new Vector3Int(x, y, z));

        private static readonly Vector3Int[] Six =
        {
            new(1, 0, 0), new(-1, 0, 0), new(0, 1, 0), new(0, -1, 0), new(0, 0, 1), new(0, 0, -1),
        };

        /// <summary>
        /// 담아 둔 씨앗에서 빛을 퍼뜨린다. 한 칸 갈 때마다 1 씩 줄고, 물속은 3 씩 준다 —
        /// 물이 공기와 같이 밝으면 깊이가 안 보인다.
        /// </summary>
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
                    // 하늘빛은 **아래로만** 안 줄어든다 — 그래야 우물 바닥까지 낮이 닿는다.
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
        /// 블록 하나가 바뀐 자리의 빛만 고친다.
        ///
        /// 어두워지는 쪽이 먼저다 — 지우지 않고 새로 흘리면 **없어진 횃불의 빛이 남는다.**
        /// 지우면서 만난 「나보다 밝은 이웃」은 다시 흘릴 씨앗으로 모아 둔다.
        /// </summary>
        private void RelightAround(int x, int y, int z, KgdVoxelKind was, KgdVoxelKind now, Chunk c)
        {
            bool opacityChanged = was.Opaque != now.Opaque;
            bool glowChanged = was.Glow != now.Glow;

            if (opacityChanged)
            {
                int lx = LocalOf(x), lz = LocalOf(z);
                int top = 0;
                for (int yy = Height - 1; yy >= 0; yy--)
                {
                    if (!Kinds[c.Block[Index(lx, yy, lz)]].Opaque) continue;
                    top = yy + 1;
                    break;
                }
                c.SkyTop[lz * SX + lx] = (byte)Mathf.Min(top, Height);
            }

            if (opacityChanged || glowChanged)
            {
                Drain(x, y, z, sky: false);
                if (now.Glow > 0) { SetBlk(x, y, z, now.Glow); Push(x, y, z); }
                Flow(sky: false);

                Drain(x, y, z, sky: true);
                SeedSkyNear(x, y, z);
                Flow(sky: true);
            }
        }

        /// <summary>이 자리에서 번져 나간 빛을 지운다. 지우다 만난 더 밝은 칸은 다시 흘릴 씨앗이다.</summary>
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
                    else
                    {
                        _seeds.Add(n);   // 나보다 밝다 — 여기서 다시 흘러 들어온다
                    }
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
                        _seeds.Add(new Vector3Int(x + dx, yy, z + dz));   // 하늘에 닿은 칸이 씨앗
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
            KgdVoxelMesher.Build(this, c.Cx, c.Cz, out var solid, out var liquid);

            Attach(ref c.SolidGo, ref c.SolidMesh, solid, c, "chunk", terrain: false, drop: 0f);
            // 물만 한 칸의 1/10 을 내려 놓는다. 수면이 블록 위 모서리와 정확히 겹치면 턱이 없어
            // 「물이 찬 구덩이」가 아니라 「파란 블록」으로 읽힌다. 메시를 손대는 대신 통째로
            // 내리면 그리디 합치기가 그대로 남는다.
            Attach(ref c.LiquidGo, ref c.LiquidMesh, liquid, c, "water", terrain: true, drop: 0.1f);

            c.MeshDirty = false;
            MeshedThisTick++;
        }

        private void Attach(ref GameObject go, ref Mesh mesh, Mesh built, Chunk c, string name,
                            bool terrain, float drop)
        {
            if (mesh != null) UnityEngine.Object.Destroy(mesh);
            mesh = built;

            if (built == null)
            {
                if (go != null) go.SetActive(false);
                return;
            }

            if (go == null)
            {
                // **그림자를 끈다.** 밝기는 이미 정점에 구워 넣었고(하늘빛·블록빛·모서리 그늘),
                // 그림자 맵을 청크 수만큼 다시 그리면 폰에서 그것만으로 예산을 넘긴다 (가드레일 G7).
                go = Kgd.Art.KgdMat.Object($"{name}_{c.Cx}_{c.Cz}", built, Root,
                                           shadows: false, terrain: terrain);
                go.transform.localPosition = new Vector3(c.Cx * SX, -drop, c.Cz * SZ);
                var skin = terrain ? LiquidSurface != null ? LiquidSurface : Surface : Surface;
                if (skin != null) go.GetComponent<MeshRenderer>().sharedMaterial = skin;
            }
            else
            {
                go.SetActive(true);
                go.GetComponent<MeshFilter>().sharedMesh = built;
            }
        }

        // ── 저장 ────────────────────────────────────────────────────────────────

        /// <summary>바뀐 블록만 문자열로. 씨앗은 게임이 따로 저장한다.</summary>
        public string SaveEdits()
        {
            var sb = new StringBuilder(_edits.Count * 12);
            foreach (var kv in _edits)
            {
                Unpack2(kv.Key, out int x, out int y, out int z);
                sb.Append(x).Append(',').Append(y).Append(',').Append(z).Append(',').Append(kv.Value).Append(';');
            }
            return sb.ToString();
        }

        /// <summary>
        /// 저장한 편집을 되돌린다. **청크를 만들기 전에 부른다** — 뒤에 부르면 이미 만든
        /// 청크가 생성기 값 그대로 남아, 지은 것이 사라진 판에서 시작한다.
        /// </summary>
        public void LoadEdits(string data)
        {
            _edits.Clear();
            if (string.IsNullOrEmpty(data)) return;

            foreach (string row in data.Split(';'))
            {
                if (row.Length < 7) continue;
                var f = row.Split(',');
                if (f.Length != 4) continue;
                if (!int.TryParse(f[0], out int x) || !int.TryParse(f[1], out int y) ||
                    !int.TryParse(f[2], out int z) || !byte.TryParse(f[3], out byte id)) continue;
                _edits[EditKey(x, y, z)] = id;
            }
        }

        private static void Unpack2(long v, out int x, out int y, out int z)
        {
            x = (int)(v >> 38) & 0x3FFFFFF; if (x > 0x1FFFFFF) x -= 0x4000000;
            z = (int)(v >> 12) & 0x3FFFFFF; if (z > 0x1FFFFFF) z -= 0x4000000;
            y = (int)(v & 0xFFF);
        }
    }
}
