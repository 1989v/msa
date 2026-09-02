using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 막기. **방패를 든 것과 안 든 것이 같은 버튼을 쓴다** — 없으면 값이 나쁠 뿐 동작은 같다.
    ///
    /// 막기는 「안 맞는 것」이 아니라 **덜 맞고 대신 스태미나를 무는 것**이다. 무적이 되면
    /// 누르고 서 있는 것이 가장 좋은 수가 되어 싸움이 사라진다. 스태미나가 마르면 풀린다.
    ///
    /// 정면만 막는다. 뒤를 잡히면 그대로 맞아야 돌아 들어갈 이유가 생긴다.
    /// </summary>
    public sealed class KgdGuard
    {
        public struct Tuning
        {
            /// <summary>막고 있는 동안 초당 무는 값.</summary>
            public float Drain;
            /// <summary>한 대 막을 때 더 무는 값. 센 것을 계속 막지 못하게 한다.</summary>
            public float PerHit;
            /// <summary>막았을 때 남는 피해 배율. 0 이면 무적이라 안 된다.</summary>
            public float Soak;
            /// <summary>이 값보다 정면에 가까워야 막힌다(내적).</summary>
            public float FrontDot;
            /// <summary>풀린 뒤 다시 들기까지.</summary>
            public float Recover;
            /// <summary>강공(<see cref="KgdWeapon.GuardBreak"/>)을 막았을 때 남는 피해 배율. 막기가 반쯤 뚫린다.</summary>
            public float PierceSoak;

            public static Tuning Default => new()
            {
                Drain = 6f, PerHit = 12f, Soak = 0.25f, FrontDot = 0.35f, Recover = 0.45f,
                PierceSoak = 0.6f,
            };
        }

        private readonly Tuning _t;
        private readonly KgdStamina _stamina;
        private float _cool;

        public KgdGuard(Tuning tuning, KgdStamina stamina) { _t = tuning; _stamina = stamina; }

        /// <summary>지금 막고 있나.</summary>
        public bool Up { get; private set; }

        /// <summary>이 프레임에 막기가 깨졌나. 소리와 화면이 읽는다.</summary>
        public bool Broke { get; private set; }

        /// <summary><paramref name="want"/> 는 버튼을 누르고 있나. 움직이는 중에도 막을 수 있다.</summary>
        public void Tick(float dt, bool want, bool busy)
        {
            Broke = false;
            _cool -= dt;
            if (!want || busy || _cool > 0f) { Up = false; return; }
            if (!_stamina.Spend(_t.Drain * dt)) { if (Up) Broke = true; Up = false; _cool = _t.Recover; return; }
            Up = true;
        }

        /// <summary>
        /// 한 대 맞았다. 막혔으면 남는 피해를 줄여 돌려주고 스태미나를 문다.
        /// <paramref name="facing"/> 은 내가 보는 방향, <paramref name="fromDir"/> 은 때린 쪽에서 나에게 오는 방향.
        /// <paramref name="pierce"/> 는 강공 — 막혀도 <see cref="Tuning.PierceSoak"/> 가 들어오고
        /// 스태미나를 두 배로 문다. 「막고 서 있기」가 최선이 되지 않게 하는 축이다.
        /// </summary>
        public float Absorb(float damage, Vector3 facing, Vector3 fromDir, bool pierce = false)
        {
            if (!Up) return damage;
            var flat = new Vector3(fromDir.x, 0f, fromDir.z);
            if (flat.sqrMagnitude < 0.0001f) return damage;
            // 나를 향해 오는 것을 정면으로 받았나
            if (Vector3.Dot(-flat.normalized, facing) < _t.FrontDot) return damage;
            float cost = pierce ? _t.PerHit * 2f : _t.PerHit;
            if (!_stamina.TrySpend(cost)) { Up = false; Broke = true; _cool = _t.Recover; return damage; }
            return damage * (pierce ? _t.PierceSoak : _t.Soak);
        }
    }
}
