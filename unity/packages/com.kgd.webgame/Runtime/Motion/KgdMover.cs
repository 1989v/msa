using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 왕복하는 발판의 자리. **시간 → 위치의 순수 함수**라 같은 시각이면 같은 자리다 —
    /// 게임과 게이트가 같은 답을 보고, 저장에서 돌아와도 그 시각의 자리가 나온다.
    ///
    /// 위에 선 몸은 게임이 <see cref="DeltaAt"/> 만큼 실어 나른다 — 지형 질의는
    /// 「지금 어디에 있나」만 답하므로, 안 실으면 발판이 발밑에서 빠져나간다.
    /// </summary>
    public sealed class KgdMover
    {
        public Vector3 A, B;
        public float Period = 5f;

        /// <summary>0~1. 같은 구간의 발판들이 같은 박자로 움직이지 않게 흩는다.</summary>
        public float Phase;

        /// <summary>이 시각의 자리. 코사인 왕복 — 끝에서 느려져야 「돌아선다」로 읽힌다.</summary>
        public Vector3 At(float time)
        {
            float w = (time / Mathf.Max(0.1f, Period) + Phase) * Mathf.PI * 2f;
            return Vector3.Lerp(A, B, 0.5f - 0.5f * Mathf.Cos(w));
        }

        /// <summary>한 프레임 동안 움직인 양. 위에 선 몸을 이만큼 옮긴다.</summary>
        public Vector3 DeltaAt(float time, float dt) => At(time) - At(time - dt);
    }
}
