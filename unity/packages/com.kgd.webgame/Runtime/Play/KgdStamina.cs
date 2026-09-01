using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 하나로 묶인 행동 자원. 달리기·등반·활공·구르기가 **같은 통**에서 나가야
    /// 「무엇에 쓸까」가 선택이 된다 — 따로 두면 각각 아껴 쓸 뿐 고민이 없다.
    ///
    /// **바닥나도 멈추지 않는다.** 0 에서 조작이 막히면 갇히고, 갇힌 상태는
    /// 게임이 끝난 것과 같다. 대신 느려진다.
    /// </summary>
    public sealed class KgdStamina
    {
        /// <summary>지금 상한. 보상으로 올라간다.</summary>
        public float Cap { get; private set; }

        public float Value { get; private set; }

        /// <summary>바닥났다. 회복이 <see cref="RecoverAt"/> 를 넘을 때까지 유지된다.</summary>
        public bool Empty { get; private set; }

        /// <summary>바닥난 뒤 이 비율까지 차야 풀린다. 0 에서 바로 풀면 깜빡인다.</summary>
        public float RecoverAt = 0.25f;

        public float Ratio => Cap > 0f ? Value / Cap : 0f;

        public KgdStamina(float cap)
        {
            Cap = cap;
            Value = cap;
        }

        /// <summary>쓴다. 다 쓰면 <see cref="Empty"/> 가 서고 false 를 돌려준다.</summary>
        public bool Spend(float amount)
        {
            if (Empty) return false;
            Value -= amount;
            if (Value > 0f) return true;
            Value = 0f;
            Empty = true;
            return false;
        }

        /// <summary>한 번에 드는 것(구르기 등). 모자라면 쓰지 않고 false 다.</summary>
        public bool TrySpend(float amount)
        {
            if (Empty || Value < amount) return false;
            Value -= amount;
            return true;
        }

        public void Regain(float amount)
        {
            Value = Mathf.Min(Cap, Value + amount);
            if (Empty && Value > Cap * RecoverAt) Empty = false;
        }

        /// <summary>상한을 올리고 그 자리에서 채운다 — 보상이 즉시 읽혀야 한다.</summary>
        public void Raise(float by)
        {
            Cap += by;
            Value = Cap;
            Empty = false;
        }

        public void Refill()
        {
            Value = Cap;
            Empty = false;
        }
    }
}
