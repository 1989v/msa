using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 부술 수 있는 것들의 **상태**. 상자·드럼통·나무통이 같은 규칙을 쓴다.
    ///
    /// **한 방에 사라지면 친 것이 아니라 지운 것으로 읽힌다.** 몇 대 맞는 동안 눈에 띄게
    /// 상해 가야 「부수고 있다」가 되고, 그래야 센 무기를 든 보람이 지형에서도 난다.
    ///
    /// 여기는 **얼마나 남았나와 몇 단계인가**만 든다. 그 단계가 어떻게 보이는지는
    /// 게임이 정한다 — 상자는 널이 튀고 드럼통은 찌그러지는데, 그 차이를 패키지가 알면
    /// 소품 종류마다 여기를 고쳐야 한다.
    /// </summary>
    public sealed class KgdBreakables
    {
        /// <summary>성한 것부터 부서지기 직전까지 몇 단계로 보이나.</summary>
        public const int Stages = 3;

        /// <summary>맞은 뒤 흔들리는 시간. 짧아야 「충격」이고 길면 「고장」이다.</summary>
        public const float WobbleTime = 0.22f;

        /// <summary>무너지는 데 걸리는 시간. 이 동안은 아직 화면에 있다.</summary>
        public const float FallTime = 0.30f;

        private readonly List<float> _max = new();
        private readonly List<float> _hp = new();
        private readonly List<float> _wobble = new();
        private readonly List<float> _falling = new();

        public int Count => _hp.Count;

        /// <summary>하나 등록한다. 돌려주는 번호로 나중에 때린다.</summary>
        public int Add(float hp)
        {
            _max.Add(Mathf.Max(1f, hp));
            _hp.Add(Mathf.Max(1f, hp));
            _wobble.Add(0f);
            _falling.Add(-1f);
            return _hp.Count - 1;
        }

        /// <summary>아직 판정에 남아 있나. 무너지는 중이면 이미 아니다.</summary>
        public bool Standing(int i) => Valid(i) && _hp[i] > 0f;

        /// <summary>화면에 아직 그려야 하나. 무너지는 동안은 보인다.</summary>
        public bool Visible(int i) => Valid(i) && (_hp[i] > 0f || _falling[i] > 0f);

        /// <summary>남은 비율 1 → 0.</summary>
        public float Ratio(int i) => Valid(i) ? Mathf.Clamp01(_hp[i] / _max[i]) : 0f;

        /// <summary>0 = 성함, <see cref="Stages"/>-1 = 부서지기 직전.</summary>
        public int Stage(int i) =>
            Valid(i) ? Mathf.Clamp(Mathf.FloorToInt((1f - Ratio(i)) * Stages), 0, Stages - 1) : Stages - 1;

        /// <summary>맞은 직후 1 에서 0 으로 잦아든다. 게임이 흔들림에 쓴다.</summary>
        public float Wobble(int i) => Valid(i) ? Mathf.Clamp01(_wobble[i] / WobbleTime) : 0f;

        /// <summary>무너지는 진행 0 → 1. 아직 안 무너졌으면 0.</summary>
        public float Falling(int i) =>
            Valid(i) && _falling[i] > 0f ? 1f - Mathf.Clamp01(_falling[i] / FallTime) : 0f;

        /// <summary>
        /// 한 대 친다. 부서졌으면 true.
        /// <paramref name="stageChanged"/> 가 true 면 겉모습이 달라진 것이라 소리를 낼 만하다.
        /// </summary>
        public bool Hit(int i, float damage, out bool stageChanged)
        {
            stageChanged = false;
            if (!Standing(i)) return false;
            int was = Stage(i);
            _hp[i] = Mathf.Max(0f, _hp[i] - Mathf.Max(0f, damage));
            _wobble[i] = WobbleTime;
            if (_hp[i] <= 0f) { _falling[i] = FallTime; stageChanged = true; return true; }
            stageChanged = Stage(i) != was;
            return false;
        }

        public void Tick(float dt)
        {
            for (int i = 0; i < _hp.Count; i++)
            {
                if (_wobble[i] > 0f) _wobble[i] = Mathf.Max(0f, _wobble[i] - dt);
                if (_falling[i] > 0f) _falling[i] = Mathf.Max(0f, _falling[i] - dt);
            }
        }

        private bool Valid(int i) => i >= 0 && i < _hp.Count;
    }
}
