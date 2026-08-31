using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 「여기 바닥이 얼마나 높은가」만 답하는 곳. 게임마다 지형을 만드는 방식이 달라서
    /// (절차 생성 · 하이트맵 · 타일) 패키지는 **어떻게 만드는지는 모르고 결과만 묻는다.**
    ///
    /// 이 하나로 걷기·오르기·떨어지기 판정이 전부 성립한다 — 별도의 충돌 메시가 필요 없다.
    /// </summary>
    public interface IKgdGround
    {
        /// <summary>이 자리(x,z)의 바닥 높이. y 는 보지 않는다.</summary>
        float HeightAt(Vector3 world);
    }
}
