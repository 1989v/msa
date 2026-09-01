using Kgd.Motion;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 날아가는 것들. 화살·돌·창 던지기가 전부 같은 규칙을 쓴다.
    ///
    /// **맞는 판정은 여기가 하지 않는다.** 무엇에 맞는지는 게임마다 다르고(적·상자·판때기),
    /// 여기가 목록을 알면 게임 종류마다 고쳐야 한다. 여기는 **어디에 있나**만 들고 있고,
    /// 게임이 훑으며 맞았다고 알려 주면 지운다.
    ///
    /// 미리 만들어 두고 껐다 켠다 — 쏠 때마다 만들면 그때 프레임이 튄다.
    /// </summary>
    public sealed class KgdShots
    {
        /// <summary>동시에 날아다니는 수. 넘치면 가장 오래된 것을 밀어낸다.</summary>
        public const int Slots = 24;

        private readonly Vector3[] _at = new Vector3[Slots];
        private readonly Vector3[] _vel = new Vector3[Slots];
        private readonly float[] _age = new float[Slots];
        private readonly float[] _damage = new float[Slots];
        private readonly bool[] _live = new bool[Slots];

        /// <summary>이 시간이 지나면 스스로 사라진다. 없으면 지도 밖까지 날아가 쌓인다.</summary>
        public float Life = 3.2f;

        /// <summary>떨어지는 정도. 0 이면 곧게 날아간다.</summary>
        public float Drop = 9f;

        public void Fire(Vector3 from, Vector3 dir, float speed, float damage)
        {
            int slot = -1; float oldest = -1f;
            for (int i = 0; i < Slots; i++)
            {
                if (!_live[i]) { slot = i; break; }
                if (_age[i] > oldest) { oldest = _age[i]; slot = i; }
            }
            _at[slot] = from;
            _vel[slot] = dir.normalized * speed;
            _age[slot] = 0f; _damage[slot] = damage; _live[slot] = true;
        }

        /// <summary>
        /// 한 걸음 나아간다. 땅에 닿거나 수명이 다하면 스스로 사라진다.
        /// </summary>
        public void Tick(float dt, IKgdGround ground)
        {
            for (int i = 0; i < Slots; i++)
            {
                if (!_live[i]) continue;
                _vel[i].y -= Drop * dt;
                _at[i] += _vel[i] * dt;
                _age[i] += dt;
                if (_age[i] >= Life) { _live[i] = false; continue; }
                if (ground != null && _at[i].y <= ground.HeightAt(_at[i])) _live[i] = false;
            }
        }

        public bool Read(int slot, out Vector3 at, out Vector3 vel, out float damage)
        {
            at = default; vel = default; damage = 0f;
            if (slot < 0 || slot >= Slots || !_live[slot]) return false;
            at = _at[slot]; vel = _vel[slot]; damage = _damage[slot];
            return true;
        }

        /// <summary>맞았다 — 이 하나를 지운다.</summary>
        public void Spend(int slot)
        {
            if (slot >= 0 && slot < Slots) _live[slot] = false;
        }

        public void Clear()
        {
            for (int i = 0; i < Slots; i++) _live[i] = false;
        }
    }
}
