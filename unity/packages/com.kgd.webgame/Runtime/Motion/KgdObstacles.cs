using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 장애물 — **막는 원판이 아니라 윗면을 가진 기둥**이다.
    ///
    /// 막기만 하는 원판으로 두면 뛰어넘는 순간 발밑이 사라져 그대로 관통한다.
    /// 윗면을 갖고 있으면 「막힌다」와 「올라선다」가 같은 규칙에서 나온다 — 바닥 높이다.
    ///
    /// 균일 격자라 개수가 늘어도 질의는 이웃 9칸만 본다.
    /// </summary>
    public sealed class KgdObstacles
    {
        private readonly List<(Vector3 at, float radius, float top, bool alive)> _items = new();
        private readonly Dictionary<int, List<int>> _grid = new();
        private readonly float _cell;

        public KgdObstacles(float cell = 8f) => _cell = Mathf.Max(1f, cell);

        public int Count => _items.Count;

        /// <summary>
        /// 기둥 하나. <paramref name="height"/> 는 바닥에서 잰 높이다.
        /// 돌려주는 번호로 나중에 <see cref="Remove"/> 할 수 있다 — 부술 수 있는 것에 쓴다.
        /// </summary>
        public int Add(Vector3 at, float radius, float height)
        {
            _items.Add((at, radius, at.y + height, true));
            int k = Key(Mathf.FloorToInt(at.x / _cell), Mathf.FloorToInt(at.z / _cell));
            if (!_grid.TryGetValue(k, out var bucket)) _grid[k] = bucket = new List<int>();
            bucket.Add(_items.Count - 1);
            return _items.Count - 1;
        }

        /// <summary>
        /// 이 기둥을 없앤 것으로 친다. **목록에서 빼지 않는다** — 뒤 번호가 밀려
        /// 밖에서 들고 있던 번호가 다른 것을 가리키게 된다.
        /// </summary>
        public void Remove(int id)
        {
            if (id < 0 || id >= _items.Count) return;
            var it = _items[id];
            _items[id] = (it.at, it.radius, it.top, false);
        }

        /// <summary>이 기둥이 아직 서 있나.</summary>
        public bool Alive(int id) => id >= 0 && id < _items.Count && _items[id].alive;

        /// <summary>
        /// 이 자리에서 <paramref name="reach"/> 안에 있는 살아 있는 기둥의 번호. 없으면 -1.
        /// 부수려는 쪽이 「무엇을 쳤나」를 알아내는 데 쓴다.
        /// </summary>
        public int NearestAlive(Vector3 p, float reach)
        {
            int hit = -1; float best = reach * reach;
            int cx = Mathf.FloorToInt(p.x / _cell), cz = Mathf.FloorToInt(p.z / _cell);
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (!_grid.TryGetValue(Key(cx + dx, cz + dz), out var bucket)) continue;
                foreach (int i in bucket)
                {
                    var it = _items[i];
                    if (!it.alive) continue;
                    float ddx = it.at.x - p.x, ddz = it.at.z - p.z;
                    float d = ddx * ddx + ddz * ddz;
                    if (d < best) { best = d; hit = i; }
                }
            }
            return hit;
        }

        /// <summary>이 자리를 덮는 기둥의 윗면. 없으면 0.</summary>
        public float TopAt(Vector3 p)
        {
            float top = 0f;
            int cx = Mathf.FloorToInt(p.x / _cell), cz = Mathf.FloorToInt(p.z / _cell);
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (!_grid.TryGetValue(Key(cx + dx, cz + dz), out var bucket)) continue;
                foreach (int i in bucket)
                {
                    var (at, r, t, alive) = _items[i];
                    if (!alive) continue;
                    float ddx = at.x - p.x, ddz = at.z - p.z;
                    if (ddx * ddx + ddz * ddz < r * r && t > top) top = t;
                }
            }
            return top;
        }

        /// <summary>
        /// 붙어서 오를 수 있는 기둥이 앞에 있나. **기둥도 벽이다** — 지형만 보고
        /// 판정하면 세워 둔 탑을 오르지 못해 「보이는데 못 가는 것」이 된다.
        /// </summary>
        public bool WallAt(Vector3 p, float reach, out float top, out Vector3 inward)
        {
            top = 0f;
            inward = Vector3.zero;
            float best = float.MaxValue;
            int cx = Mathf.FloorToInt(p.x / _cell), cz = Mathf.FloorToInt(p.z / _cell);
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (!_grid.TryGetValue(Key(cx + dx, cz + dz), out var bucket)) continue;
                foreach (int i in bucket)
                {
                    var (at, r, t, alive) = _items[i];
                    if (!alive) continue;
                    if (t <= p.y + 0.5f) continue;              // 이미 그 위다
                    float ddx = at.x - p.x, ddz = at.z - p.z;
                    float d = Mathf.Sqrt(ddx * ddx + ddz * ddz) - r;
                    if (d > reach || d >= best) continue;
                    best = d;
                    top = t;
                    inward = new Vector3(ddx, 0f, ddz).normalized;
                }
            }
            return best < float.MaxValue;
        }

        /// <summary>
        /// 밀도 세계의 몸을 기둥 밖으로 민다 — 옆으로만. 발 자리 <paramref name="foot"/> 와 몸의 반지름·키를
        /// 받아, 높이가 겹치는 살아 있는 기둥마다 겹친 만큼 밀어낸다. 밀었으면 참.
        /// </summary>
        public bool Push(ref Vector3 foot, float bodyRadius, float bodyHeight)
        {
            bool pushed = false;
            int cx = Mathf.FloorToInt(foot.x / _cell), cz = Mathf.FloorToInt(foot.z / _cell);
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (!_grid.TryGetValue(Key(cx + dx, cz + dz), out var bucket)) continue;
                foreach (int i in bucket)
                {
                    var (at, r, t, alive) = _items[i];
                    if (!alive) continue;
                    if (foot.y + bodyHeight <= at.y || foot.y >= t) continue;   // 높이가 안 겹친다
                    float ddx = foot.x - at.x, ddz = foot.z - at.z;
                    float d = Mathf.Sqrt(ddx * ddx + ddz * ddz);
                    float want = r + bodyRadius;
                    if (d >= want) continue;
                    var outDir = d < 1e-4f ? Vector3.right : new Vector3(ddx / d, 0f, ddz / d);
                    foot += outDir * (want - d);
                    pushed = true;
                }
            }
            return pushed;
        }

        /// <summary>
        /// 광선이 살아 있는 기둥에 닿는 첫 자리. 겨눔이 지형보다 먼저 이걸 본다 — 기둥이 지형 앞에 서 있으면
        /// 기둥이 맞아야 한다. 닿으면 참이고 <paramref name="t"/> 가 거리, <paramref name="id"/> 가 기둥이다.
        /// </summary>
        public bool Raycast(Vector3 from, Vector3 dir, float maxT, out float t, out int id, out Vector3 normal)
        {
            t = maxT; id = -1; normal = Vector3.up;
            // 광선이 지나는 격자 칸을 다 보는 대신 반경 안의 칸을 훑는다 — 사거리가 몇 칸이라 이웃 셋이면 충분하다
            int c0x = Mathf.FloorToInt((from.x - maxT) / _cell), c1x = Mathf.FloorToInt((from.x + maxT) / _cell);
            int c0z = Mathf.FloorToInt((from.z - maxT) / _cell), c1z = Mathf.FloorToInt((from.z + maxT) / _cell);
            for (int cx = c0x; cx <= c1x; cx++)
            for (int cz = c0z; cz <= c1z; cz++)
            {
                if (!_grid.TryGetValue(Key(cx, cz), out var bucket)) continue;
                foreach (int i in bucket)
                {
                    var (at, r, top, alive) = _items[i];
                    if (!alive) continue;
                    // 수직 기둥: xz 평면의 원과 광선의 교차
                    float ox = from.x - at.x, oz = from.z - at.z;
                    float a = dir.x * dir.x + dir.z * dir.z;
                    if (a < 1e-6f) continue;
                    float b = 2f * (ox * dir.x + oz * dir.z);
                    float c = ox * ox + oz * oz - r * r;
                    float disc = b * b - 4f * a * c;
                    if (disc < 0f) continue;
                    float hit = (-b - Mathf.Sqrt(disc)) / (2f * a);
                    if (hit < 0f || hit >= t) continue;
                    float y = from.y + dir.y * hit;
                    if (y < at.y || y > top) continue;
                    t = hit; id = i;
                    var p = from + dir * hit;
                    normal = new Vector3(p.x - at.x, 0f, p.z - at.z).normalized;
                }
            }
            return id >= 0;
        }

        /// <summary>기둥의 자리·반지름·윗면.</summary>
        public bool Get(int id, out Vector3 at, out float radius, out float top)
        {
            if (id < 0 || id >= _items.Count) { at = Vector3.zero; radius = 0f; top = 0f; return false; }
            var it = _items[id];
            at = it.at; radius = it.radius; top = it.top;
            return it.alive;
        }

        private static int Key(int x, int z) => (x + 4096) * 8192 + (z + 4096);
    }
}
