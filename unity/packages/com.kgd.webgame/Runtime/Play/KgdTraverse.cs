using Kgd.Motion;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// **젤다라이크의 뼈대** — 걷기·달리기·점프·등반·활공·구르기가 스태미나 하나로 묶인
    /// 이동 상태기계.
    ///
    /// 이 클래스는 **어디에 서 있는지만 안다**. 무엇을 들었는지, 무엇과 싸우는지,
    /// 어떤 그림인지는 모른다 — 게임이 <see cref="Busy"/> 로 잠깐 넘겨받아 공격 같은
    /// 자기 동작을 넣고 돌려준다.
    ///
    /// 여기 든 값들은 전부 실기에서 한 번씩 틀렸던 것이다. 자세한 이유는 각 필드에 적었다.
    /// </summary>
    public sealed class KgdTraverse
    {
        public enum State { Ground, Air, Climb, Glide, Roll, Busy }

        public struct Tuning
        {
            public float WalkSpeed, RunSpeed, WornSpeed;
            public float ClimbSpeed, GlideFall, GlideSpeed;
            public float RollSpeed, RollTime, RollCost;
            /// <summary>한 번 뛸 때 무는 값. 달리기로 같은 거리를 갈 때보다 싸면 안 된다.</summary>
            public float JumpCost;
            public float Gravity, JumpVel;
            public float RunDrain, ClimbDrain, GlideDrain, Regain, RegainDelay;
            public float Radius, Height, StepUp, StepDown;
            /// <summary>벽 쪽으로 이만큼 계속 밀어야 붙는다. 스치기만 한 것과 가른다.</summary>
            public float ClimbIntent;
            public float ClimbReach;
            /// <summary>이 높이보다 낮은 것은 오르지 않는다 — 뛰어넘으면 되는 것이다.</summary>
            public float ClimbMinRise;

            /// <summary>봉우리를 오르는 게임의 기준값. 게임이 필요한 것만 덮어쓴다.</summary>
            public static Tuning Default => new()
            {
                WalkSpeed = 4.4f, RunSpeed = 10.6f, WornSpeed = 0.8f,
                ClimbSpeed = 3.2f, GlideFall = 2.6f, GlideSpeed = 12f,
                RollSpeed = 15f, RollTime = 0.42f, RollCost = 20f, JumpCost = 6f,
                Gravity = 26f, JumpVel = 10f,
                RunDrain = 4f, ClimbDrain = 11f, GlideDrain = 4f,
                Regain = 24f, RegainDelay = 0.5f,
                Radius = 0.42f, Height = 1.8f, StepUp = 1.1f, StepDown = 1.2f,
                ClimbIntent = 0.10f, ClimbReach = 1.0f, ClimbMinRise = 2.2f,
            };
        }

        /// <summary>이번 프레임에 눌린 것. 게임이 채워 넣는다.</summary>
        public struct Wish
        {
            /// <summary>가려는 방향(수평, 길이 0~1). 카메라 기준으로 이미 돌려 둔 값이다.</summary>
            public Vector3 Move;
            public bool Run, JumpDown, RollDown, GlideDown, LetGoDown;
        }

        public Vector3 Pos;
        public float Yaw;
        public State Now { get; private set; } = State.Ground;
        public readonly KgdStamina Stamina;
        public bool Running { get; private set; }

        /// <summary>
        /// 지도 반폭. 0 이면 제한이 없다. **없으면 지도 밖 허공을 계속 걷는다** —
        /// 지형 높이가 0 으로 돌아오므로 걸리는 것도 없이 영영 나간다.
        /// </summary>
        public float MapRadius;

        /// <summary>이번 프레임에 땅에 닿았나. 소리·먼지에 쓴다.</summary>
        public bool Landed { get; private set; }

        /// <summary>구르기 진행(0 시작 → 1 끝). 게임이 몸을 굴리는 데 쓴다.</summary>
        public float RollPhase => _t.RollTime > 0f ? 1f - Mathf.Clamp01(_rollLeft / _t.RollTime) : 0f;

        /// <summary>구르는 중엔 맞지 않는다 — 예고를 보고 굴렀으면 회피가 반응이 된다.</summary>
        public bool Invulnerable => Now == State.Roll;

        public Vector3 Facing => new(Mathf.Sin(Yaw * Mathf.Deg2Rad), 0f, Mathf.Cos(Yaw * Mathf.Deg2Rad));

        private readonly Tuning _t;
        private readonly KgdBody _body;
        private Vector3 _vel, _knock;
        private float _rollLeft, _sinceGround, _climbCool, _pressing;

        /// <summary>활공 버튼을 기억하는 시간. 길면 나중에 저절로 펴진 것처럼 보인다.</summary>
        private const float GlideMemory = 0.45f;
        private float _glideWanted;

        public KgdTraverse(Tuning tuning, float staminaCap)
        {
            _t = tuning;
            _body = new KgdBody(tuning.Radius, tuning.StepUp, tuning.StepDown);
            Stamina = new KgdStamina(staminaCap);
        }

        public KgdBody Body => _body;

        /// <summary>게임이 자기 동작(공격 등)을 하는 동안 이동을 멈춘다.</summary>
        public void Busy_Begin() => Now = State.Busy;

        public void Busy_End() => Now = State.Ground;

        /// <summary>맞아서 밀린다. 등반 중에는 벽에서 떨어뜨리지 않는다.</summary>
        public void Knock(Vector3 impulse)
        {
            if (Now != State.Climb) _knock = impulse;
        }

        public void Teleport(Vector3 at)
        {
            Pos = at;
            _vel = Vector3.zero;
            _knock = Vector3.zero;
            Now = State.Ground;
        }

        public void Tick(float dt, in Wish wish, IKgdGround ground, IKgdWall walls)
        {
            Landed = false;

            switch (Now)
            {
                case State.Ground: Walk(dt, wish, walls); break;
                case State.Air: Air(dt, wish, walls, ground); break;
                case State.Climb: Climb(dt, wish, walls, ground); break;
                case State.Glide: Glide(dt, wish); break;
                case State.Roll: Roll(dt); break;
                case State.Busy: _vel = Vector3.zero; break;
            }

            if (Now != State.Climb && _knock.sqrMagnitude > 0.0001f)
            {
                _vel += _knock;
                _knock = Vector3.Lerp(_knock, Vector3.zero, 14f * dt);
            }

            Recover(dt);
            Apply(dt, ground);
        }

        // ── 상태 ────────────────────────────────────────────────────────────

        private void Walk(float dt, in Wish wish, IKgdWall walls)
        {
            bool moving = wish.Move.sqrMagnitude > 0.01f;

            // 달리기는 **누르고 있는 동안**이다. 늘 달리면 걷는 내내 스태미나가 빠져
            // 오를 힘이 남지 않는다.
            Running = moving && !Stamina.Empty && wish.Run;
            float speed = Stamina.Empty ? _t.WalkSpeed * _t.WornSpeed
                        : Running ? _t.RunSpeed : _t.WalkSpeed;
            if (Running && !Stamina.Spend(_t.RunDrain * dt)) Running = false;

            _vel = new Vector3(wish.Move.x * speed, 0f, wish.Move.z * speed);
            if (moving) Face(wish.Move);

            if (wish.RollDown && moving && Stamina.TrySpend(_t.RollCost))
            {
                _rollLeft = _t.RollTime;
                Now = State.Roll;
                return;
            }
            // **점프도 값을 문다.** 공짜면 뛰어다니는 것이 달리기와 속도가 비슷한데
            // 스태미나는 무제한이라, 달리기를 쓸 이유가 없어진다(실제 신고).
            if (wish.JumpDown && Stamina.TrySpend(_t.JumpCost))
            {
                _vel.y = _t.JumpVel;
                Now = State.Air;
                return;
            }
            // **땅에서 밀기만으로는 안 붙는다.** 벽을 향해 걷다 보면 저절로 매달려서,
            // 길을 따라 걷는 것과 오르려는 것이 구별되지 않았다(실제 신고).
            // 오르려면 **뛰어서 붙어야 한다** — 뛰는 것은 우연히 안 되는 동작이다.
            _pressing = 0f;
        }

        private void Air(float dt, in Wish wish, IKgdWall walls, IKgdGround ground)
        {
            Running = false;
            _vel.x = Mathf.Lerp(_vel.x, wish.Move.x * _t.RunSpeed, 3f * dt);
            _vel.z = Mathf.Lerp(_vel.z, wish.Move.z * _t.RunSpeed, 3f * dt);
            _vel.y -= _t.Gravity * dt;
            if (wish.Move.sqrMagnitude > 0.01f) Face(wish.Move);

            // **누른 것을 잠시 기억한다.** 떨어지는 중에만 펴는 것은 맞지만, 뛰어오르는
            // 도중에 누르면 아무 일도 안 일어나 「눌렀는데 안 된다」가 된다(실제 신고).
            // 올라가는 중에 눌러도 고도는 안 주고, 떨어지기 시작하는 순간 펴 준다.
            if (wish.GlideDown) _glideWanted = GlideMemory;
            _glideWanted -= dt;
            if (_vel.y < -1f && _glideWanted > 0f && !Stamina.Empty)
            { _glideWanted = 0f; Now = State.Glide; return; }
            TryGrab(dt, wish, walls, ground);
        }

        private void TryGrab(float dt, in Wish wish, IKgdWall walls, IKgdGround ground)
        {
            _climbCool -= dt;
            if (walls == null || _climbCool > 0f || Stamina.Empty || wish.Move.sqrMagnitude <= 0.01f)
            { _pressing = 0f; return; }

            if (!walls.WallAt(Pos, _t.Radius + _t.ClimbReach, out float topY, out var inward) ||
                Vector3.Dot(wish.Move, inward) <= 0.7f)
            { _pressing = 0f; return; }

            // **낮은 것은 오르는 것이 아니라 넘는 것이다.** 상자·드럼통에까지 매달리면
            // 뛰어넘으려던 것이 등반이 되어 스태미나만 나간다(실제 신고).
            if (topY - Pos.y < _t.ClimbMinRise) { _pressing = 0f; return; }

            // 뛰어서 닿은 것은 그 자체로 뜻이 분명하다 — 길게 밀 것을 요구하지 않는다
            _pressing += dt;
            if (_pressing < _t.ClimbIntent) return;

            _vel = Vector3.zero;
            Now = State.Climb;
            Face(inward);
            StandOnWall(ground, inward);
        }

        /// <summary>
        /// **벽면에 세운다.** 붙는 순간 몸을 표면 밖으로 빼지 않으면, 파고든 자리에서
        /// 오르기 시작해 벽 속을 통과하는 것처럼 보인다(실제 신고).
        /// 안쪽이면 밖으로, 너무 멀면 안으로 — 어느 쪽이든 표면에 맞춘다.
        /// </summary>
        private void StandOnWall(IKgdGround ground, Vector3 inward)
        {
            if (ground == null) return;
            const float Step = 0.06f;
            // 먼저 확실히 바깥으로 뺀다
            for (int i = 0; i < 40 && ground.HeightAt(Pos) > Pos.y + 0.1f; i++)
                Pos -= inward * Step;
            // 그다음 벽에 닿을 때까지 다가간다 — 반지름만큼 띄워 세운다
            for (int i = 0; i < 40; i++)
            {
                var probe = Pos + inward * (_t.Radius + Step);
                if (ground.HeightAt(probe) > Pos.y + 0.1f) break;
                Pos += inward * Step;
            }
        }

        private void Climb(float dt, in Wish wish, IKgdWall walls, IKgdGround ground)
        {
            if (walls == null ||
                !walls.WallAt(Pos, _t.Radius + _t.ClimbReach + 0.3f, out float topY, out var inward))
            { Detach(); return; }

            Face(inward);
            if (!Stamina.Spend(_t.ClimbDrain * dt)) { Detach(); return; }

            var side = Vector3.Cross(Vector3.up, inward);
            float up = Vector3.Dot(wish.Move, inward);
            float lat = Vector3.Dot(wish.Move, side);
            _vel = wish.Move.sqrMagnitude < 0.01f
                 ? Vector3.zero
                 : (Vector3.up * up + side * lat).normalized * _t.ClimbSpeed;

            // **벽면에 붙여 둔다.** 등반 중에는 수평 판정을 안 태우므로, 그냥 두면
            // 기둥 안으로 흘러들어 파묻힌 채 올라간다(실제 신고). 몸이 solid 안에
            // 들어갔으면 벽 바깥으로 밀어낸다.
            StandOnWall(ground, inward);

            if (Pos.y + _t.Height * 0.6f >= topY)
            {
                Pos = new Vector3(Pos.x, topY + 0.05f, Pos.z) + inward * (_t.Radius + 0.5f);
                _vel = Vector3.zero;
                Now = State.Ground;
                _climbCool = 0.25f;
                return;
            }
            if (wish.LetGoDown) Detach();
        }

        private void Glide(float dt, in Wish wish)
        {
            if (!Stamina.Spend(_t.GlideDrain * dt)) { Now = State.Air; return; }

            _vel.y = -_t.GlideFall;
            _vel.x = Mathf.Lerp(_vel.x, wish.Move.x * _t.GlideSpeed, 1.6f * dt);
            _vel.z = Mathf.Lerp(_vel.z, wish.Move.z * _t.GlideSpeed, 1.6f * dt);
            if (wish.Move.sqrMagnitude > 0.01f) Face(wish.Move);
            if (wish.GlideDown) Now = State.Air;
        }

        private void Roll(float dt)
        {
            _rollLeft -= dt;
            _vel = Facing * _t.RollSpeed;
            _vel.y = 0f;
            if (_rollLeft <= 0f) Now = State.Ground;
        }

        // ── 공통 ────────────────────────────────────────────────────────────

        private void Detach()
        {
            _pressing = 0f;
            Now = State.Air;
            _vel = Vector3.zero;
            _climbCool = 0.3f;
        }

        private void Recover(float dt)
        {
            // **걷는 동안에도 찬다.** 서 있어야만 차게 두면 이동과 회복을 같이 못 해
            // 오르기 전에 늘 멈춰 서 있어야 한다.
            if ((Now == State.Ground && !Running) || Now == State.Roll)
            {
                _sinceGround += dt;
                if (_sinceGround >= _t.RegainDelay) Stamina.Regain(_t.Regain * dt);
            }
            else _sinceGround = 0f;
        }

        private void Apply(float dt, IKgdGround ground)
        {
            var want = Pos + _vel * dt;
            Pos = Now == State.Climb ? want : _body.Resolve(ground, Pos, want);

            float floor = ground.HeightAt(Pos);
            if (Now != State.Climb && Pos.y <= floor)
            {
                // **위로 끌어올리지 않는다.** 지면에 붙는 길은 떨어지는 것뿐이다 —
                // 예전엔 계단 앞에서 점프하면 꼭대기로 순간이동했다.
                Pos.y = floor;
                if (Now == State.Air || Now == State.Glide)
                {
                    Now = State.Ground;
                    _vel.y = 0f;
                    Landed = true;
                }
            }
            else if (Now == State.Ground)
            {
                float drop = Pos.y - floor;
                if (drop <= _t.StepDown) Pos.y = floor;   // 비탈을 따라 내려간다
                else Now = State.Air;                     // 진짜 낭떠러지다
            }

            if (MapRadius > 0f)
            {
                Pos.x = Mathf.Clamp(Pos.x, -MapRadius, MapRadius);
                Pos.z = Mathf.Clamp(Pos.z, -MapRadius, MapRadius);
            }
            Pos = _body.Unstick(ground, Pos);
        }

        private void Face(Vector3 dir)
        {
            if (dir.sqrMagnitude < 0.0001f) return;
            Yaw = Mathf.LerpAngle(Yaw, Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg, 0.35f);
        }
    }
}
