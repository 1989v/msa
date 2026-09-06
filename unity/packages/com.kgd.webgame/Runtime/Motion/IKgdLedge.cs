using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// **잡을 모서리를 답하는 지형.** 지형이 이것을 구현하면 <see cref="Kgd.Play.KgdTraverse"/> 의
    /// 모서리 잡기가 벽(<see cref="IKgdWall"/>)뿐 아니라 **아무 발판의 윗면**에도 걸린다.
    ///
    /// 왜 인터페이스가 따로인가 — `IKgdWall.WallAt` 은 「매달려 오를 수 있는 벽」을 답하는 통로라
    /// 등반용 블록만 돌려준다. 그것으로 모서리 잡기를 하면 **일반 발판 가장자리에는 손이 닿지
    /// 않는다**(실제로 그랬다). 두 물음은 답이 다르므로 통로도 둘이다.
    ///
    /// 구현하지 않은 지형(하이트맵 등)은 예전과 같이 벽 질의로만 잡는다.
    /// </summary>
    public interface IKgdLedge
    {
        /// <summary>
        /// 발 높이 <paramref name="feet"/> 에서 수평 <paramref name="reach"/> 안에 **손이 닿는 모서리**가 있나.
        /// 있으면 그 윗면 높이와 **안쪽(올라설 쪽) 방향**을 준다. 몸이 이미 그 윗면 위에 서 있으면 아니다.
        /// </summary>
        bool LedgeAt(Vector3 feet, float reach, out float topY, out Vector3 inward);
    }
}
