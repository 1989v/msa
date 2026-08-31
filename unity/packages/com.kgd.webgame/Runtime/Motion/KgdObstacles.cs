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
        private readonly List<(Vector3 at, float radius, float top)> _items = new();
        private readonly Dictionary<int, List<int>> _grid = new();
        private readonly float _cell;

        public KgdObstacles(float cell = 8f) => _cell = Mathf.Max(1f, cell);

        public int Count => _items.Count;

        /// <summary>기둥 하나. <paramref name="height"/> 는 바닥에서 잰 높이다.</summary>
        public void Add(Vector3 at, float radius, float height)
        {
            _items.Add((at, radius, at.y + height));
            int k = Key(Mathf.FloorToInt(at.x / _cell), Mathf.FloorToInt(at.z / _cell));
            if (!_grid.TryGetValue(k, out var bucket)) _grid[k] = bucket = new List<int>();
            bucket.Add(_items.Count - 1);
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
                    var (at, r, t) = _items[i];
                    float ddx = at.x - p.x, ddz = at.z - p.z;
                    if (ddx * ddx + ddz * ddz < r * r && t > top) top = t;
                }
            }
            return top;
        }

        private static int Key(int x, int z) => (x + 4096) * 8192 + (z + 4096);
    }
}
