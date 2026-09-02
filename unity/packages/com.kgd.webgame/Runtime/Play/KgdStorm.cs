using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// **고도 경계** — 원이 아니라 높이다. 시간이 지나면 낮은 층부터 무너진다(안개가 차오르고
    /// 그 안에서는 초당 피해). 결국 정상에서 만난다 — 산의 구조가 곧 규칙이다.
    ///
    /// 단계마다 「예고(Warn) → 차오름(Close)」을 되풀이한다. 예고 동안 치사 고도는 멈춰 있고,
    /// 차오르는 동안 이전 고도에서 목표 고도까지 선형으로 오른다. **마지막 단계의 고도는
    /// 정상 아래여야 한다** — 서 있을 자리가 없으면 규칙이 아니라 시한폭탄이다.
    ///
    /// 어떻게 보이는지(안개색·차오르는 면)와 누가 아픈지는 게임이 안다. 여기는 **언제
    /// 어디까지 치사인지**만 안다 — 그래야 게이트가 화면 없이 같은 값을 잰다.
    /// </summary>
    public sealed class KgdStorm
    {
        public struct Stage
        {
            /// <summary>이 단계가 끝났을 때의 치사 고도.</summary>
            public float Floor;
            /// <summary>차오르기 전 예고 시간(초).</summary>
            public float Warn;
            /// <summary>이전 고도에서 이 고도까지 차오르는 시간(초).</summary>
            public float Close;

            public Stage(float floor, float warn, float close)
            { Floor = floor; Warn = warn; Close = close; }
        }

        /// <summary>안개 속 초당 피해.</summary>
        public readonly float DamagePerSecond;

        /// <summary>지금의 치사 고도. 이 **아래**는 안개다. 첫 예고가 끝나기 전엔 아무 데도 안 죽는다.</summary>
        public float FloorNow { get; private set; } = None;

        /// <summary>지금 진행 중인 단계 번호(0부터). 다 끝나면 단계 수와 같다.</summary>
        public int StageIndex { get; private set; }

        /// <summary>차오르는 중인가 — 화면이 「올라가라」를 다급하게 만들 때 쓴다.</summary>
        public bool Closing { get; private set; }

        /// <summary>다음에 닫힐 고도. 다 닫혔으면 마지막 고도.</summary>
        public float NextFloor => _stages.Length == 0 ? None
            : _stages[Mathf.Min(StageIndex, _stages.Length - 1)].Floor;

        /// <summary>예고가 끝나기까지 남은 시간. 차오르는 중이면 0.</summary>
        public float TimeToClose { get; private set; }

        /// <summary>모든 단계가 닫혔다.</summary>
        public bool Done => StageIndex >= _stages.Length;

        private const float None = -1e9f;

        private readonly Stage[] _stages;
        private float _timer;
        private float _fromFloor = None;

        public KgdStorm(Stage[] stages, float damagePerSecond)
        {
            _stages = stages ?? new Stage[0];
            DamagePerSecond = damagePerSecond;
            _timer = _stages.Length > 0 ? _stages[0].Warn : 0f;
            TimeToClose = _timer;
        }

        /// <summary>전 단계가 닫히는 데 드는 시간 — 판 길이의 뼈대다. PaceGate 가 본다.</summary>
        public float TotalDuration
        {
            get
            {
                float sum = 0f;
                foreach (var s in _stages) sum += s.Warn + s.Close;
                return sum;
            }
        }

        /// <summary>이 자리가 안개 속인가.</summary>
        public bool Deadly(Vector3 pos) => pos.y < FloorNow;

        public void Tick(float dt)
        {
            if (Done) { Closing = false; TimeToClose = 0f; return; }

            _timer -= dt;
            var stage = _stages[StageIndex];

            if (!Closing)
            {
                TimeToClose = Mathf.Max(0f, _timer);
                if (_timer <= 0f)
                {
                    Closing = true;
                    _timer = stage.Close;
                    _fromFloor = FloorNow <= None * 0.5f ? 0f : FloorNow;
                }
                return;
            }

            TimeToClose = 0f;
            float t = stage.Close > 0f ? 1f - Mathf.Clamp01(_timer / stage.Close) : 1f;
            FloorNow = Mathf.Lerp(_fromFloor, stage.Floor, t);
            if (_timer <= 0f)
            {
                FloorNow = stage.Floor;
                Closing = false;
                StageIndex++;
                if (!Done) _timer = _stages[StageIndex].Warn;
                TimeToClose = _timer;
            }
        }
    }
}
