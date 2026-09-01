using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 붙어서 오를 벽이 앞에 있나. **어떤 지형이 벽인지는 게임이 정한다** —
    /// 계단 절벽일 수도, 세워 둔 기둥일 수도, 나무일 수도 있다.
    /// </summary>
    public interface IKgdWall
    {
        /// <param name="topY">붙었을 때 올라설 높이.</param>
        /// <param name="inward">벽을 향하는 수평 방향(정규화).</param>
        bool WallAt(Vector3 at, float reach, out float topY, out Vector3 inward);
    }
}
