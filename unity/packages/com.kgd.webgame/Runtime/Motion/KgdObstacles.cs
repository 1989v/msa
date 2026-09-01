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

        private static int Key(int x, int z) => (x + 4096) * 8192 + (z + 4096);
    }
}
