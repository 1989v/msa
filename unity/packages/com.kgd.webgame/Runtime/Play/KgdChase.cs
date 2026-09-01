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
        public enum State { Idle, Chase, Windup, Strike, Recover, Back, Block, Climb, Dead }

        /// <summary>
        /// 어떻게 다가오나. **다양성은 값이 아니라 여기서 나온다** — 체력·속도만 바꾼 적을
        /// 늘리면 같은 것이 하나 더 생길 뿐이고, 플레이어가 다르게 대응할 이유가 없다.
        /// </summary>
        public enum Style
        {
            /// <summary>곧장 붙어서 때린다. 기준값.</summary>
            Rush,
            /// <summary>때리고 물러난다. 붙어 있으려면 쫓아가야 한다.</summary>
            Keep,
            /// <summary>정면을 피해 옆·뒤로 돌아 들어온다. 여럿이면 에워싸인다.</summary>
            Flank,
            /// <summary>정면 공격을 막는다. 옆이나 뒤로 돌아야 통한다.</summary>
            Guard,
            /// <summary>벽을 타고 따라온다. **붙어 오르는 것이 도망이 되지 않게 한다.**</summary>
            Climb,
        }

        public struct Tuning
        {
            public float Notice, LoseTrack, Speed, Reach, Windup, Strike, Recover;
            public Style How;
            /// <summary>Keep — 때린 뒤 물러나는 시간.</summary>
            public float BackOff;
            /// <summary>Guard — 이 각도(내적) 안에서 온 공격을 막는다. 클수록 좁다.</summary>
            public float BlockDot;
            /// <summary>Climb — 벽을 타는 속도.</summary>
            public float ClimbSpeed;

            public static Tuning Default => new()
            {
                Notice = 22f, LoseTrack = 34f, Speed = 5.4f,
                Reach = 2.3f, Windup = 0.40f, Strike = 0.18f, Recover = 0.55f,
                How = Style.Rush, BackOff = 0.9f, BlockDot = 0.35f, ClimbSpeed = 3.0f,
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

        /// <summary>지금 막고 있나. 게임이 타격을 무를지 판단한다.</summary>
        public bool Blocking => Now == State.Block;

        /// <summary>이 방향에서 온 공격을 막나. 정면만 막는다 — 돌아 들어가면 통한다.</summary>
        public bool Blocks(Vector3 from)
        {
            if (!Blocking) return false;
            var to = new Vector3(from.x - Pos.x, 0f, from.z - Pos.z);
            if (to.sqrMagnitude < 0.0001f) return true;
            var facing = new Vector3(Mathf.Sin(Yaw * Mathf.Deg2Rad), 0f, Mathf.Cos(Yaw * Mathf.Deg2Rad));
            return Vector3.Dot(to.normalized, facing) > _t.BlockDot;
        }

        private readonly Tuning _t;
        private readonly Vector3 _home;
        /// <summary>Flank 가 노리는 각도. 개체마다 달라야 한 줄로 몰리지 않고 에워싼다.</summary>
        private readonly float _side;
        private float _timer;
        private Vector3 _knock;

        public KgdChase(Tuning tuning, Vector3 at)
        {
            _t = tuning;
            _home = Pos = at;
            // 자리에서 뽑는다 — 같은 시드면 같은 배치가 나와야 검사가 성립한다
            _side = (Mathf.Abs(at.GetHashCode()) % 2 == 0 ? 1f : -1f) * (50f + Mathf.Abs(at.GetHashCode()) % 60);
        }

        public void Kill() => Now = State.Dead;

        /// <summary>맞으면 깨어난다 — 멀리서 때리고 도망칠 수 있으면 안 된다.</summary>
        public void Wake() { if (Now == State.Idle) Now = State.Chase; }

        public void Knock(Vector3 impulse) => _knock = impulse;

        public void Tick(float dt, Vector3 target, IKgdGround ground, KgdBody body, IKgdWall walls = null)
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

                    // **붙어 오르는 것이 도망이 되지 않게 한다.** 목표가 위에 있고 붙을 벽이
                    // 있으면 벽을 탄다 — 없으면 벽에 매달린 사람을 아무도 못 건드린다.
                    if (_t.How == Style.Climb && walls != null &&
                        target.y > Pos.y + 2f && dist < _t.Notice &&
                        walls.WallAt(Pos, 1.6f, out _, out _))
                    { Now = State.Climb; break; }

                    if (dist <= _t.Reach)
                    {
                        // 막는 것은 붙자마자 곧장 치지 않는다. 한 번 막고 시작한다
                        if (_t.How == Style.Guard && Now != State.Block)
                        { Now = State.Block; _timer = _t.Windup * 1.6f; break; }
                        Now = State.Windup;
                        _timer = _t.Windup;
                        break;
                    }

                    var toward = target - Pos;
                    if (_t.How == Style.Flank)
                        // 정면을 피해 돌아 들어간다. 가까울수록 각을 줄여 결국은 붙는다
                        toward = Quaternion.Euler(0f, _side * Mathf.Clamp01(dist / _t.Notice), 0f) * toward;
                    Step(dt, toward, _t.Speed, ground, body);
                    break;

                case State.Block:
                    FaceTo(target);
                    Charge = 1f - Mathf.Clamp01(_timer / (_t.Windup * 1.6f));
                    if (_timer <= 0f) { Now = State.Windup; _timer = _t.Windup; }
                    else if (dist > _t.Reach + 1.5f) Now = State.Chase;
                    break;

                case State.Back:
                    // 때린 뒤 물러난다 — 붙어 있으려면 쫓아가야 한다
                    Step(dt, Pos - target, _t.Speed * 0.9f, ground, body);
                    FaceTo(target);
                    if (_timer <= 0f) Now = State.Chase;
                    break;

                case State.Climb:
                    if (walls == null || !walls.WallAt(Pos, 1.9f, out float topY, out var inward))
                    { Now = State.Chase; break; }
                    FaceTo(Pos + inward);
                    Pos += Vector3.up * _t.ClimbSpeed * dt;
                    if (Pos.y >= topY)
                    {
                        Pos = new Vector3(Pos.x, topY + 0.05f, Pos.z) + inward * 0.9f;
                        Now = State.Chase;
                    }
                    // 목표가 다시 아래로 가면 굳이 더 오르지 않는다
                    else if (target.y < Pos.y - 1f) Now = State.Chase;
                    return;

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
                    if (_timer <= 0f)
                    {
                        if (_t.How == Style.Keep) { Now = State.Back; _timer = _t.BackOff; }
                        else Now = State.Chase;
                    }
                    break;
            }

            if (Now != State.Climb) Pos.y = ground.HeightAt(Pos);
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
