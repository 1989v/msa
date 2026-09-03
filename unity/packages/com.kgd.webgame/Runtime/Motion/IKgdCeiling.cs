using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 「머리 위에 뭐가 있나」. 층층이 떠 있는 **단단한** 발판 지형에서만 필요하다 — 하이트맵·기둥은
    /// 아래에서 위로 들어갈 수 없어 천장이 없다. 지형이 이것을 구현하면 <see cref="Kgd.Play.KgdTraverse"/> 가
    /// 위로 가다 밑면에 닿는 순간 머리를 부딪혀 멈춘다. 구현하지 않으면 예전과 같다.
    /// </summary>
    public interface IKgdCeiling
    {
        /// <param name="feet">발 자리(x, z 와 발높이 y).</param>
        /// <param name="height">몸 높이.</param>
        /// <param name="bottom">발 위에 있는 가장 낮은 밑면. 없으면 뜻 없는 값.</param>
        /// <returns>발 위 <paramref name="height"/> 안에 밑면이 있나.</returns>
        bool CeilingAt(Vector3 feet, float height, out float bottom);
    }
}
