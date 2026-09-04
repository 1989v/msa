using UnityEngine;

namespace Kgd.Voxel
{
    /// <summary>
    /// 눈에서 뻗은 선이 처음 만나는 블록. 캐기·놓기·조준이 전부 이 하나에 달려 있다.
    ///
    /// **격자를 한 칸씩 건너뛴다**(Amanatides–Woo). 일정 간격으로 찍어 보는 방법은 간격보다
    /// 얇은 칸을 지나쳐서, 모서리를 겨눴을 때 뒤쪽 블록이 잡히는 결함으로 나타난다.
    /// 여기서는 다음 경계까지 남은 거리를 축마다 들고 **가장 가까운 것부터** 넘는다.
    /// </summary>
    public static class KgdVoxelRay
    {
        public struct Hit
        {
            public bool Any;

            /// <summary>맞은 블록의 자리.</summary>
            public int X, Y, Z;

            /// <summary>그 앞의 빈 칸 — 블록을 놓을 자리다.</summary>
            public int Px, Py, Pz;

            /// <summary>맞은 면의 바깥 방향.</summary>
            public Vector3Int Normal;

            public byte Id;
            public float Distance;
        }

        /// <summary>
        /// <paramref name="reach"/> 안에서 처음 막히는 블록을 찾는다.
        /// <paramref name="includeLiquid"/> 가 거짓이면 물은 지나친다 — 물은 캘 수 없고,
        /// 물속에서 겨눴을 때 눈앞의 물이 잡히면 아무것도 못 캔다.
        /// </summary>
        public static Hit Cast(KgdVoxelWorld w, Vector3 origin, Vector3 dir, float reach,
                               bool includeLiquid = false)
        {
            var hit = default(Hit);
            if (dir.sqrMagnitude < 1e-8f) return hit;
            dir.Normalize();

            int x = Mathf.FloorToInt(origin.x);
            int y = Mathf.FloorToInt(origin.y);
            int z = Mathf.FloorToInt(origin.z);

            int sx = dir.x > 0f ? 1 : -1;
            int sy = dir.y > 0f ? 1 : -1;
            int sz = dir.z > 0f ? 1 : -1;

            // 한 칸을 건너는 데 드는 거리. 축 성분이 0 이면 영원히 안 넘는다.
            float tdx = dir.x == 0f ? float.MaxValue : Mathf.Abs(1f / dir.x);
            float tdy = dir.y == 0f ? float.MaxValue : Mathf.Abs(1f / dir.y);
            float tdz = dir.z == 0f ? float.MaxValue : Mathf.Abs(1f / dir.z);

            float tx = dir.x == 0f ? float.MaxValue : ((dir.x > 0f ? x + 1 - origin.x : origin.x - x) / Mathf.Abs(dir.x));
            float ty = dir.y == 0f ? float.MaxValue : ((dir.y > 0f ? y + 1 - origin.y : origin.y - y) / Mathf.Abs(dir.y));
            float tz = dir.z == 0f ? float.MaxValue : ((dir.z > 0f ? z + 1 - origin.z : origin.z - z) / Mathf.Abs(dir.z));

            int px = x, py = y, pz = z;
            var normal = Vector3Int.zero;
            float travelled = 0f;

            // 한 칸씩만 넘으므로 걸음 수 상한은 사거리에 비례한다. 상한을 안 두면
            // 방향이 0 에 가까울 때 도는 수가 폭발한다.
            int guard = Mathf.CeilToInt(reach * 3f) + 3;

            for (int step = 0; step < guard; step++)
            {
                if (y >= 0 && y < w.Height)
                {
                    byte id = w.Get(x, y, z);
                    var k = w.Kinds[id];
                    bool stop = k.Solid && (includeLiquid || !k.Liquid);
                    if (stop)
                    {
                        hit.Any = true;
                        hit.X = x; hit.Y = y; hit.Z = z;
                        hit.Px = px; hit.Py = py; hit.Pz = pz;
                        hit.Normal = normal;
                        hit.Id = id;
                        hit.Distance = travelled;
                        return hit;
                    }
                }

                px = x; py = y; pz = z;

                if (tx <= ty && tx <= tz)
                {
                    travelled = tx; tx += tdx; x += sx; normal = new Vector3Int(-sx, 0, 0);
                }
                else if (ty <= tz)
                {
                    travelled = ty; ty += tdy; y += sy; normal = new Vector3Int(0, -sy, 0);
                }
                else
                {
                    travelled = tz; tz += tdz; z += sz; normal = new Vector3Int(0, 0, -sz);
                }

                if (travelled > reach) break;
            }

            return hit;
        }
    }
}
