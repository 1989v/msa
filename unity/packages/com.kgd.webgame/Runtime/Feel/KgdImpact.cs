using UnityEngine;

namespace Kgd.Feel
{
    /// <summary>
    /// 타격감. **멈춤·흔들림 두 가지가 한 벌로 움직인다.**
    ///
    /// 셋 중 값이 가장 큰 것은 히트스톱이다 — 닿는 순간 게임 시간을 수십 ms 멈추면
    /// 같은 그림·같은 수치로도 「닿았다」가 생긴다. 파티클이나 숫자를 더하는 것보다 싸고
    /// 확실하다.
    ///
    /// **`Time.timeScale` 을 건드리지 않는다.** 전역으로 걸면 UI 애니메이션·타이머까지
    /// 같이 멈추고, 배치 모드 검사에서 재현이 안 된다. 대신 게임이 쓸 dt 를 돌려준다.
    /// </summary>
    public sealed class KgdImpact
    {
        /// <summary>가장 센 타격의 멈춤 시간. 이보다 길면 조작이 끊긴 것으로 읽힌다.</summary>
        public const float StopMax = 0.085f;

        /// <summary>흔들림 지속. 짧아야 「충격」이고 길면 「멀미」다.</summary>
        public const float ShakeTime = 0.18f;

        /// <summary>흔들림 최대 진폭(월드 단위).</summary>
        public const float ShakeMax = 0.42f;

        private float _stop;
        private float _shakeLeft, _shakeWeight;
        private int _tick;

        /// <summary>카메라가 자기 위치에 더할 값. 안 흔들리면 0 이다.</summary>
        public Vector3 Shake { get; private set; }

        /// <summary>지금 멈춰 있나. 애니메이션을 같이 세우고 싶을 때 본다.</summary>
        public bool Frozen => _stop > 0f;

        /// <summary>타격 하나. <paramref name="weight"/> 0~1 — 가벼운 타격과 큰 타격을 가른다.</summary>
        public void Add(float weight)
        {
            weight = Mathf.Clamp01(weight);
            // 이미 멈춰 있으면 **더하지 않고 큰 쪽을 남긴다.** 난타에서 더하면 화면이 굳는다.
            _stop = Mathf.Max(_stop, StopMax * weight);
            _shakeLeft = ShakeTime;
            _shakeWeight = Mathf.Max(_shakeWeight, weight);
        }

        /// <summary>
        /// 실제 경과 시간을 넣으면 **게임이 써야 할 시간**을 돌려준다.
        /// 멈춤 중에는 0 에 가깝게 나오고, 그동안에도 흔들림은 진행한다.
        /// </summary>
        public float Tick(float realDt)
        {
            if (_shakeLeft > 0f)
            {
                _shakeLeft -= realDt;
                float k = Mathf.Max(0f, _shakeLeft / ShakeTime);
                float amp = ShakeMax * _shakeWeight * k * k;   // 끝으로 갈수록 빠르게 잦아든다
                _tick++;
                // 난수 대신 결정적인 값을 쓴다 — 같은 입력이면 같은 화면이라야 검사가 성립한다
                Shake = new Vector3(Mathf.Sin(_tick * 2.31f), Mathf.Sin(_tick * 3.77f), 0f) * amp;
                if (_shakeLeft <= 0f) { Shake = Vector3.zero; _shakeWeight = 0f; }
            }

            if (_stop > 0f)
            {
                _stop -= realDt;
                return realDt * 0.06f;   // 완전히 0 이면 물리·애니가 멈춘 티가 난다
            }
            return realDt;
        }
    }
}
