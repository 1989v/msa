using Kgd.Motion;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 쫓아와서 때리는 것의 뼈대. **예고 없이 때리지 않는다** — 예고가 없으면 회피가
    /// 반응이 아니라 운이 되고, 그러면 구르기를 넣은 이유가 사라진다.
    ///
    /// 무엇으로 보이는지·얼마나 아픈지는 게임이 안다. 여기는 **언제 무엇을 하는지**만 안다.
    /// </summary>
    public sealed class KgdChase
    {
        public enum State { Idle, Chase, Windup, Strike, Recover, Dead }

        public struct Tuning
        {
            public float Notice, LoseTrack, Speed, Reach, Windup, Strike, Recover;

            public static Tuning Default => new()
            {
                Notice = 22f, LoseTrack = 34f, Speed = 5.4f,
                Reach = 2.3f, Windup = 0.40f, Strike = 0.18f, Recover = 0.55f,
            };
        }

        public Vector3 Pos;
        public float Yaw { get; private set; }
        public State Now { get; private set; } = State.Idle;
        public bool Alive => Now != State.Dead;

        /// <summary>예고가 끝나 실제로 쳤다. 게임이 읽고 지운다.</summary>
        public bool Hit;

        /// <summary>예고에서 타격까지의 진행(0~1). 몸을 젖히는 데 쓴다.</summary>
        public float Charge { get; private set; }

        private readonly Tuning _t;
        private readonly Vector3 _home;
        private float _timer;
        private Vector3 _knock;

        public KgdChase(Tuning tuning, Vector3 at)
        {
            _t = tuning;
            _home = Pos = at;
        }

        public void Kill() => Now = State.Dead;

        /// <summary>맞으면 깨어난다 — 멀리서 때리고 도망칠 수 있으면 안 된다.</summary>
        public void Wake() { if (Now == State.Idle) Now = State.Chase; }

        public void Knock(Vector3 impulse) => _knock = impulse;

        public void Tick(float dt, Vector3 target, IKgdGround ground, KgdBody body)
        {
            if (Now == State.Dead) return;

            _timer -= dt;
            float dist = Vector3.Distance(Pos, target);

            if (_knock.sqrMagnitude > 0.0001f)
            {
                Move(_knock * dt, ground, body);
                _knock = Vector3.Lerp(_knock, Vector3.zero, 12f * dt);
            }

            switch (Now)
            {
                case State.Idle:
                    if (dist < _t.Notice) Now = State.Chase;
                    else
                    {
                        // 제자리를 크게 벗어나지 않는다 — 배회로 흘러내리면 배치가 무너진다
                        var back = _home - Pos;
                        if (back.sqrMagnitude > 36f) Step(dt, back, _t.Speed * 0.35f, ground, body);
                    }
                    break;

                case State.Chase:
                    if (dist > _t.LoseTrack) { Now = State.Idle; break; }
                    if (dist <= _t.Reach) { Now = State.Windup; _timer = _t.Windup; break; }
                    Step(dt, target - Pos, _t.Speed, ground, body);
                    break;

                case State.Windup:
                    FaceTo(target);
                    Charge = 1f - Mathf.Clamp01(_timer / _t.Windup);
                    if (_timer <= 0f)
                    {
                        // 예고가 끝난 **자리에서만** 맞는다 — 예고 중에 빠져나가면 헛친다
                        if (Vector3.Distance(Pos, target) <= _t.Reach + 0.5f) Hit = true;
                        Now = State.Strike;
                        _timer = _t.Strike;
                    }
                    break;

                case State.Strike:
                    Charge = 1f - Mathf.Clamp01(_timer / _t.Strike);
                    if (_timer <= 0f) { Now = State.Recover; _timer = _t.Recover; }
                    break;

                case State.Recover:
                    Charge = Mathf.Clamp01(_timer / _t.Recover);
                    if (_timer <= 0f) Now = State.Chase;
                    break;
            }

            Pos.y = ground.HeightAt(Pos);
        }

        private void Step(float dt, Vector3 dir, float speed, IKgdGround ground, KgdBody body)
        {
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) return;
            dir.Normalize();
            Move(dir * speed * dt, ground, body);
            FaceTo(Pos + dir);
        }

        /// <summary>주인공과 **같은 규칙**으로 움직인다 — 적만 벽을 통과하면 도망이 성립하지 않는다.</summary>
        private void Move(Vector3 delta, IKgdGround ground, KgdBody body)
        {
            var to = Pos + delta;
            if (body.CanEnter(ground, Pos, to)) Pos = to;
        }

        private void FaceTo(Vector3 at)
        {
            var d = at - Pos; d.y = 0f;
            if (d.sqrMagnitude < 0.0001f) return;
            Yaw = Mathf.LerpAngle(Yaw, Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg, 0.3f);
        }
    }
}
