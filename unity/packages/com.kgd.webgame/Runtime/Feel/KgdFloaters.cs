using UnityEngine;

namespace Kgd.Feel
{
    /// <summary>
    /// 떠오르는 피해 숫자.
    ///
    /// **얼마나 아팠는지가 화면에 없으면 무기를 바꾼 것이 느껴지지 않는다.** 흰 번쩍임만으로는
    /// 11 을 넣었는지 40 을 넣었는지 알 수 없어, 더 센 것을 찾아 오를 이유가 사라진다.
    ///
    /// <see cref="KgdImpact"/> 와 같은 규율로 **그리지 않는다** — 자리와 나이만 들고 있고,
    /// 글자는 게임이 자기 HUD 로 찍는다. 패키지가 TMP 를 끌어오면 글꼴 없는 게임이 못 쓴다.
    /// </summary>
    public sealed class KgdFloaters
    {
        /// <summary>한 숫자가 떠 있는 시간.</summary>
        public const float Life = 0.9f;

        /// <summary>그동안 떠오르는 높이(월드 단위).</summary>
        public const float Rise = 1.5f;

        /// <summary>동시에 띄우는 수. 넘치면 가장 오래된 것을 밀어낸다.</summary>
        public const int Slots = 12;

        private readonly Vector3[] _at = new Vector3[Slots];
        private readonly float[] _amount = new float[Slots];
        private readonly float[] _age = new float[Slots];
        private readonly bool[] _heavy = new bool[Slots];
        private readonly bool[] _live = new bool[Slots];

        public void Add(Vector3 at, float amount, bool heavy = false)
        {
            int slot = -1;
            float oldest = -1f;
            for (int i = 0; i < Slots; i++)
            {
                if (!_live[i]) { slot = i; break; }
                if (_age[i] > oldest) { oldest = _age[i]; slot = i; }
            }
            // 같은 자리에 겹쳐 뜨면 한 덩어리로 읽힌다 — 조금씩 어긋나게 둔다
            float jitter = (slot % 3 - 1) * 0.35f;
            _at[slot] = at + new Vector3(jitter, 0f, jitter * 0.5f);
            _amount[slot] = amount; _age[slot] = 0f; _heavy[slot] = heavy; _live[slot] = true;
        }

        public void Tick(float dt)
        {
            for (int i = 0; i < Slots; i++)
                if (_live[i] && (_age[i] += dt) >= Life) _live[i] = false;
        }

        /// <summary>슬롯 하나를 읽는다. 살아 있지 않으면 false.</summary>
        public bool Read(int slot, out Vector3 world, out float amount, out float alpha,
                         out float scale, out bool heavy)
        {
            world = default; amount = 0f; alpha = 0f; scale = 1f; heavy = false;
            if (slot < 0 || slot >= Slots || !_live[slot]) return false;

            float k = _age[slot] / Life;
            world = _at[slot] + Vector3.up * (Rise * Mathf.Sqrt(k));   // 처음에 빠르게 뜨고 잦아든다
            amount = _amount[slot];
            alpha = k < 0.65f ? 1f : 1f - (k - 0.65f) / 0.35f;
            // 튀어나왔다 제자리로 — 숫자가 「튀어나온다」가 타격의 절반이다
            scale = (heavy = _heavy[slot]) ? 1.35f : 1f;
            scale *= 1f + 0.5f * Mathf.Exp(-k * 14f);
            return true;
        }
    }
}
