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
        public enum State { Ground, Air, Climb, Glide, Roll, Busy, Ledge }

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

            /// <summary>
            /// 활공 상태 진입 자체를 막는다. GlideSpeed = 0 으로는 부족하다 — 상태에
            /// 들어가는 순간 하강률이 GlideFall 로 고정되어 낙하의 값이 사라진다.
            /// </summary>
            public bool NoGlide;

            /// <summary>
            /// 차지 점프. 0 이면 없던 기능이다(JumpVel 즉발 점프 그대로).
            /// 0 보다 크면 점프가 <see cref="Wish.JumpCharge"/> 를 힘으로 쓴다 —
            /// 게임이 누른 시간을 0~1 로 (양자화까지 해서) 넘긴다.
            /// </summary>
            public float ChargeTime;
            public float ChargeMinVel, ChargeMaxVel;
            public float ChargeMinSpeed, ChargeMaxSpeed;
            /// <summary>차지 중 이동 배율. 조준은 되지만 걷어서 도망은 못 가는 값이어야 한다.</summary>
            public float ChargeMoveScale;

            /// <summary>
            /// 낙하 종단 속도. 0 이면 무제한(기본). 층층이 떠 있는 지형(one-way 발판)은
            /// 반드시 둔다 — 무제한이면 긴 낙하에서 한 프레임에 발판 두께를 건너뛴다.
            /// </summary>
            public float TerminalFall;

            /// <summary>
            /// 공중에서 벽에 부딪힌 축의 속도를 지운다 — 몸이 벽을 타고 떨어진다. 끄면(기본) 자리만 막히고
            /// 속도는 남아 벽 밑을 지나는 순간 다시 그 속도로 난다. 층층이 뜬 단단한 발판 지형에서는
            /// 켜야 한다(한 단 모자란 낙하의 61% 가 발판 옆을 스친 뒤 탑 밖으로 날아 지상까지 갔다).
            /// 기본이 꺼짐인 이유: 켜면 다른 게임의 봇 판 결과가 달라진다(마지막 한 사람 무기 균형 1점).
            /// </summary>
            public bool StopAtWalls;

            /// <summary>
            /// 공중에서 옆으로 들어갈 수 있는 턱. 0 이하면 StepUp 과 같다(기본). 걷는 무릎(StepUp)을 공중에도
            /// 쓰면 발이 윗면 아래인 채 덩이 속으로 들어가 정점에서 튀어 올라온다 — 「끼였다」로 보인다.
            /// 단단한 발판 지형은 0.05 쯤으로 두어 공중에서는 윗면 위로만 들어가게 한다.
            /// </summary>
            public float AirStepUp;

            /// <summary>
            /// 몸 둘레가 벽 속에 있으면 살짝 밀어낸다. 수평 이동은 둘레 표본으로 막지만 **수직 낙하는 둘레를 안 보므로**
            /// 벽 옆으로 떨어진 몸은 어깨가 벽면 안에 박힌 채 선다. 하이트맵 지형에서는 켜지 않는다 — 비탈 옆에 서 있기만
            /// 해도 밀려난다.
            /// </summary>
            public bool PushOutOfWalls;

            /// <summary>
            /// 벽을 스치고 있는 몸의 이동을 「둘레가 더 나빠지지 않으면」 허용한다. 단단한 발판 지형에서 공중 턱을
            /// 낮추면 이것 없이는 벽 옆 낙하의 조향이 통째로 죽는다. 하이트맵 게임은 끄고 쓴다(봇 판정이 흔들린다).
            /// </summary>
            public bool GrazeMove;

            /// <summary>모서리 잡기. 낙하 중 발판 가장자리에 손이 닿으면 끌어올린다 — 자동이다.</summary>
            public bool LedgeGrab;
            /// <summary>모서리까지의 수평 여유(Radius 에 더해).</summary>
            public float LedgeReach;
            /// <summary>윗면이 발 기준 이 구간에 있을 때만 손이 닿은 것이다.</summary>
            public float LedgeMinRise, LedgeMaxRise;
            public float LedgePullTime, LedgeCost;

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

            /// <summary>
            /// 잡기 버튼을 이번 프레임에 눌렀나. 벽에 닿아 있으면 **미는 방향과 무관하게** 붙는다 —
            /// 원래는 벽 쪽으로 미는 것만으로 붙었는데, 화면의 버튼 이름이 「잡기」라 사람은 그것을 누른다.
            /// 눌러도 아무 일이 없으면 버튼이 고장 난 것으로 읽힌다(사용자 신고 2026-09-05).
            /// </summary>
            public bool GrabDown;

            /// <summary>
            /// 모은 힘 0~1. <see cref="Tuning.ChargeTime"/> 이 켜진 게임만 쓴다 —
            /// JumpDown 이 서는 프레임(놓는 순간)의 값이 도약의 힘이다.
            /// 누르고 있는 동안 0 보다 크면 차지 자세(이동이 느려진다)로 취급한다.
            /// </summary>
            public float JumpCharge;
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

        /// <summary>중력 배율. 고도로 중력이 변하는 게임이 매 프레임 넣는다. 기본 1.</summary>
        public float GravityScale = 1f;

        /// <summary>
        /// 지면 미끄러짐 0~1. 0 이면 즉답(기본 — 기존 게임 무변경), 1 에 가까울수록
        /// 속도가 관성으로 이어진다. 얼음 발판 위에서 게임이 매 프레임 넣는다.
        /// </summary>
        public float Slip;

        /// <summary>
        /// 지면이 몸을 미는 수평 속도 — 급경사 미끄러짐·컨베이어. 서 있을 때만 든다. 기본 0.
        /// 게임이 발밑을 보고 매 프레임 넣는다(얼음의 <see cref="Slip"/> 과 짝이다).
        /// </summary>
        public Vector3 Drift;

        /// <summary>차지 점프로 뜬 공중인가 — 이 동안은 조향이 잠긴다. 뛰기 전에 다 정한다.</summary>
        public bool ChargedAir { get; private set; }

        /// <summary>이번 프레임에 땅에 닿았나. 소리·먼지에 쓴다.</summary>
        public bool Landed { get; private set; }

        /// <summary>이번 프레임에 머리를 부딪혔나 — 위로 가다 천장(발판 밑면)에 막혔다. 소리에 쓴다.</summary>
        public bool Bumped { get; private set; }

        /// <summary>구르기 진행(0 시작 → 1 끝). 게임이 몸을 굴리는 데 쓴다.</summary>
        public float RollPhase => _t.RollTime > 0f ? 1f - Mathf.Clamp01(_rollLeft / _t.RollTime) : 0f;

        /// <summary>구르는 중엔 맞지 않는다 — 예고를 보고 굴렀으면 회피가 반응이 된다.</summary>
        public bool Invulnerable => Now == State.Roll;

        public Vector3 Facing => new(Mathf.Sin(Yaw * Mathf.Deg2Rad), 0f, Mathf.Cos(Yaw * Mathf.Deg2Rad));

        private readonly Tuning _t;
        private readonly KgdBody _body;
        private IKgdCeiling _ceiling;
        private Vector3 _vel, _knock;
        private float _rollLeft, _sinceGround, _climbCool, _pressing;
        private float _ledgeLeft;
        private Vector3 _ledgeFrom, _ledgeTo;

        /// <summary>끌어올리는 진행 0 → 1. 게임이 몸을 접는 데 쓴다.</summary>
        public float LedgePhase =>
            Now == State.Ledge && _t.LedgePullTime > 0f
                ? 1f - Mathf.Clamp01(_ledgeLeft / _t.LedgePullTime) : 0f;

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
            ChargedAir = false;
            Now = State.Ground;
        }

        public void Tick(float dt, in Wish wish, IKgdGround ground, IKgdWall walls)
        {
            Landed = false;
            Bumped = false;
            _ceiling = ground as IKgdCeiling;   // 지형이 천장을 알면 쓴다 — 하이트맵은 모른다

            switch (Now)
            {
                case State.Ground: Walk(dt, wish, walls); break;
                case State.Air: Air(dt, wish, walls, ground); break;
                case State.Climb: Climb(dt, wish, walls, ground); break;
                case State.Glide: Glide(dt, wish); break;
                case State.Roll: Roll(dt); break;
                case State.Busy: _vel = Vector3.zero; break;
                case State.Ledge: Ledge(dt); break;
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

            // 차지 자세 — 조준은 되지만 걷어서 도망은 못 간다
            bool charging = _t.ChargeTime > 0f && wish.JumpCharge > 0f;
            if (charging) speed *= _t.ChargeMoveScale;

            // 지면이 미는 것(급경사·얼음 비탈)은 발로 거슬러야 한다 — 그대로 두면 흘러내린다
            var want = new Vector3(wish.Move.x * speed, 0f, wish.Move.z * speed) + Drift;
            if (Slip > 0f)
            {
                // 얼음 — 속도가 관성으로 이어진다. 시간 상수라 프레임률과 무관하다.
                float k = 1f - Mathf.Exp(-dt / Mathf.Lerp(0.02f, 0.7f, Slip));
                _vel = new Vector3(Mathf.Lerp(_vel.x, want.x, k), 0f, Mathf.Lerp(_vel.z, want.z, k));
            }
            else _vel = want;
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
                if (_t.ChargeTime > 0f)
                {
                    // 차지 점프 — 놓는 순간의 힘으로 몸이 향한 곳(또는 스틱 방향)으로 뛴다.
                    // 방향은 여기서 굳는다: 공중 조향이 잠기므로 뛰기 전에 다 정한 것이다.
                    float c = Mathf.Clamp01(wish.JumpCharge);
                    var dir = wish.Move.sqrMagnitude > 0.01f ? wish.Move.normalized : Facing;
                    Yaw = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;
                    _vel = dir * Mathf.Lerp(_t.ChargeMinSpeed, _t.ChargeMaxSpeed, c);
                    _vel.y = Mathf.Lerp(_t.ChargeMinVel, _t.ChargeMaxVel, c);
                    ChargedAir = true;
                }
                else _vel.y = _t.JumpVel;
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
            // **차지 점프의 공중은 조향이 잠긴다.** 뛰기 전에 다 정하는 것이 이 점프의
            // 정체성이다 — 걸어서 떨어진 낙하(ChargedAir 아님)는 그대로 조향된다.
            if (!ChargedAir)
            {
                _vel.x = Mathf.Lerp(_vel.x, wish.Move.x * _t.RunSpeed, 3f * dt);
                _vel.z = Mathf.Lerp(_vel.z, wish.Move.z * _t.RunSpeed, 3f * dt);
                if (wish.Move.sqrMagnitude > 0.01f) Face(wish.Move);
            }
            _vel.y -= _t.Gravity * GravityScale * dt;
            if (_t.TerminalFall > 0f && _vel.y < -_t.TerminalFall) _vel.y = -_t.TerminalFall;

            // **누른 것을 잠시 기억한다.** 떨어지는 중에만 펴는 것은 맞지만, 뛰어오르는
            // 도중에 누르면 아무 일도 안 일어나 「눌렀는데 안 된다」가 된다(실제 신고).
            // 올라가는 중에 눌러도 고도는 안 주고, 떨어지기 시작하는 순간 펴 준다.
            if (!_t.NoGlide)
            {
                if (wish.GlideDown) _glideWanted = GlideMemory;
                _glideWanted -= dt;
                if (_vel.y < -1f && _glideWanted > 0f && !Stamina.Empty)
                { _glideWanted = 0f; Now = State.Glide; return; }
            }
            if (TryLedge(walls, ground)) return;
            TryGrab(dt, wish, walls, ground);
        }

        /// <summary>
        /// 모서리 잡기 — 낙하 중 발판 가장자리에 손이 닿으면 자동으로 매달려 끌어올린다.
        /// 버튼을 요구하면 그 순간에 누를 수 있는 사람만 구원받는다 — 「아깝게」를
        /// 「간신히」로 바꾸는 장치라 자동이어야 한다.
        /// </summary>
        private bool TryLedge(IKgdWall walls, IKgdGround ground)
        {
            if (!_t.LedgeGrab || walls == null || _vel.y >= 0f || _climbCool > 0f) return false;
            if (!walls.WallAt(Pos, _t.Radius + _t.LedgeReach, out float topY, out var inward))
                return false;
            float rise = topY - Pos.y;
            if (rise < _t.LedgeMinRise || rise > _t.LedgeMaxRise) return false;
            if (!Stamina.TrySpend(_t.LedgeCost)) return false;

            _vel = Vector3.zero;
            ChargedAir = false;
            Face(inward);
            // StandOnWall 을 부르지 않는다 — one-way 발판은 발높이가 잡는 창 밖이면
            // 지형 질의에 안 잡혀서, 표면 찾기가 몸을 발판 속으로 걸어 들어가게 한다.
            _ledgeFrom = Pos;
            _ledgeTo = new Vector3(Pos.x, topY + 0.05f, Pos.z) + inward * (_t.Radius + 0.5f);
            _ledgeLeft = _t.LedgePullTime;
            Now = State.Ledge;
            return true;
        }

        /// <summary>끌어올린다 — 위로 먼저, 안쪽은 나중. 호를 그려야 「짚고 올라선다」로 읽힌다.</summary>
        private void Ledge(float dt)
        {
            _ledgeLeft -= dt;
            float t = _t.LedgePullTime > 0f ? 1f - Mathf.Clamp01(_ledgeLeft / _t.LedgePullTime) : 1f;
            float up = Mathf.SmoothStep(0f, 1f, Mathf.Min(1f, t * 1.4f));
            float across = t * t;
            Pos = new Vector3(Mathf.Lerp(_ledgeFrom.x, _ledgeTo.x, across),
                              Mathf.Lerp(_ledgeFrom.y, _ledgeTo.y, up),
                              Mathf.Lerp(_ledgeFrom.z, _ledgeTo.z, across));
            _vel = Vector3.zero;
            if (_ledgeLeft <= 0f)
            {
                Pos = _ledgeTo;
                Now = State.Ground;
                Landed = true;
                _climbCool = 0.2f;
            }
        }

        private void TryGrab(float dt, in Wish wish, IKgdWall walls, IKgdGround ground)
        {
            _climbCool -= dt;
            // 잡기 버튼은 **미는 방향을 요구하지 않는다** — 벽에 닿아 있으면 그것으로 뜻이 분명하다
            if (walls == null || _climbCool > 0f || Stamina.Empty ||
                (wish.Move.sqrMagnitude <= 0.01f && !wish.GrabDown))
            { _pressing = 0f; return; }

            if (!walls.WallAt(Pos, _t.Radius + _t.ClimbReach, out float topY, out var inward) ||
                (!wish.GrabDown && Vector3.Dot(wish.Move, inward) <= 0.7f))
            { _pressing = 0f; return; }

            // **낮은 것은 오르는 것이 아니라 넘는 것이다.** 상자·드럼통에까지 매달리면
            // 뛰어넘으려던 것이 등반이 되어 스태미나만 나간다(실제 신고).
            if (topY - Pos.y < _t.ClimbMinRise) { _pressing = 0f; return; }

            // 뛰어서 닿은 것은 그 자체로 뜻이 분명하다 — 길게 밀 것을 요구하지 않는다
            _pressing += dt;
            if (!wish.GrabDown && _pressing < _t.ClimbIntent) return;   // 버튼을 눌렀으면 즉시 붙는다

            _vel = Vector3.zero;
            ChargedAir = false;
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

        /// <summary>
        /// 한 번에 떨어져도 되는 거리. 층층이 떠 있는 지형에서 이보다 크게 옮기면 발판을
        /// 건너뛰어 그 발판은 없는 것이 된다 — 그래서 빠른 낙하는 끊어 옮긴다.
        /// 기둥형 지형에서는 바닥이 열 아래 어디에도 있어 결과가 같다.
        /// </summary>
        private const float FallStep = 0.8f;

        private void Apply(float dt, IKgdGround ground)
        {
            int steps = 1;
            if (_vel.y < 0f && -_vel.y * dt > FallStep)
                steps = Mathf.Min(8, Mathf.CeilToInt(-_vel.y * dt / FallStep));
            float sub = dt / steps;
            for (int i = 0; i < steps; i++)
            {
                ApplyOnce(sub, ground);
                if (Now == State.Ground || Now == State.Climb || Now == State.Ledge) break;
            }
        }

        private void ApplyOnce(float dt, IKgdGround ground)
        {
            // 등반·모서리 잡기는 스스로 자리를 놓는다 — 수평 판정을 태우면 벽이 도로 민다
            bool selfPlaced = Now == State.Climb || Now == State.Ledge;
            bool airborne = Now == State.Air || Now == State.Glide;
            // **올라서는 턱**은 공중에서 낮다 — 걷는 무릎으로 공중에서 덩이 속에 들어가면 끼인다.
            float mantle = airborne && _t.AirStepUp > 0f ? _t.AirStepUp : _t.StepUp;
            // **이동을 막는 턱**은 다르다. 지금 딛고 있는(또는 방금 떠난) 면을 기준으로 걷는 무릎만큼 열어 둔다 —
            // 비탈에서 뛰는 순간 앞쪽 지면이 0.09 높은 것이 벽으로 잡혀 수평 속도가 통째로 0 이 됐다(실측:
            // 도약 직후 vz 9.4 → 0, 제자리 상승). 몸이 지면보다 아래(옆면에 잠김)면 이 값은 낮은 채로 남는다.
            float stepUp = mantle;
            if (airborne && _t.AirStepUp > 0f)
                stepUp = Mathf.Max(_t.AirStepUp, ground.HeightAt(Pos) + _t.StepUp - Pos.y);
            float prevY = Pos.y;
            var before = Pos;
            var want = Pos + _vel * dt;
            Pos = selfPlaced ? want : _body.Resolve(ground, Pos, want, stepUp, _t.GrazeMove);

            if (!selfPlaced)
            {
                // **공중에서 벽에 부딪힌 축의 속도는 사라진다** (Tuning.StopAtWalls). 자리만 막고 속도를 남겨
                // 두면 벽 밑을 지나는 순간 다시 그 속도로 날아간다 — 탑에서 한 단 모자란 낙하의 61% 가 발판 옆을
                // 스친 뒤 탑 밖으로 날아 지상까지 갔다. 벽에 닿은 몸은 벽을 타고 떨어진다. 걷기는 매 프레임
                // 속도를 새로 놓아 무관
                if (_t.StopAtWalls && (Now == State.Air || Now == State.Glide))
                {
                    float wx = _vel.x * dt, wz = _vel.z * dt;
                    bool hitX = Mathf.Abs(wx) > 1e-4f && Mathf.Abs(Pos.x - before.x) < Mathf.Abs(wx) * 0.5f;
                    bool hitZ = Mathf.Abs(wz) > 1e-4f && Mathf.Abs(Pos.z - before.z) < Mathf.Abs(wz) * 0.5f;
                    // **정면으로 부딪히면(막힌 축이 큰 성분) 둘 다 멎는다** — 벽에 닿은 몸은 곧장 떨어진다. 막힌 축만
                    // 지우면 몸 둘레 표본이 닿았는지에 따라 나머지 성분이 남을 때도 안 남을 때도 있어, 어디로 떨어지는지가
                    // 정해지지 않는다(받침을 둘 자리가 없다). **스치듯 닿은 것(작은 성분이 막힘)은 속도를 그대로 둔다** —
                    // 올라가며 옆 덩이의 모서리를 스친 몸의 조준(작은 성분)을 지우면 목표 옆으로 떨어진다(실제 놓침)
                    bool frontal = (hitX && Mathf.Abs(_vel.x) >= Mathf.Abs(_vel.z)) || (hitZ && Mathf.Abs(_vel.z) >= Mathf.Abs(_vel.x));
                    // **올라가는 중에는 지우지 않는다.** 지우면 발판 옆면에 닿는 순간 수평 성분이 사라져
                    // 그대로 수직으로 솟았다 미끄러져 내린다 — 바로 위 발판(수평 간격 1~2)을 노린 도약이
                    // 통째로 막힌다(사용자 신고 2026-09-05: 「벽에 막힌 듯 수직으로 점프하고 미끄러짐」).
                    // 속도를 남기면 몸은 면을 타고 올라가다 윗면을 넘는 순간 들어가 선다. 자리는 여전히
                    // `CanEnter` 가 막으므로 면을 뚫지는 않는다. 못 넘는 높이면 떨어지기 시작하는 순간
                    // 아래 규칙이 속도를 지워 밑동으로 떨어진다 — Only Up 의 「벽에 닿으면 탄다」 그대로다.
                    if (frontal && _vel.y <= 0f) { _vel.x = 0f; _vel.z = 0f; }
                }

                // **천장.** 위로 가다 밑면에 닿으면 머리를 부딪히고 그 자리에서 떨어진다 — 단단한 발판
                // 아래에서 뛰어 발판 위로 나오는 길은 없다(위에서만 잡히는 one-way 였을 때는 통과했고,
                // 그것이 「뚫린다」로 읽혔다). 천장을 모르는 지형(하이트맵)은 예전과 같다.
                if (_ceiling != null && _vel.y > 0f &&
                    _ceiling.CeilingAt(Pos, _t.Height, out float lid) && Pos.y + _t.Height > lid)
                {
                    Pos.y = lid - _t.Height;
                    _vel.y = 0f;
                    Bumped = true;
                }

                float floor = ground.HeightAt(Pos);
                if (_ceiling != null)
                {
                    // **단단한 발판 지형(천장을 아는 지형)의 바닥은 「지나쳤나」로 본다.** 이 걸음 전 발높이에서
                    // 본 바닥을 이 걸음 뒤 발이 넘어 내려갔으면 그 바닥에 선다 — 빠른 낙하가 얇은 발판을 한 걸음에
                    // 건너뛰어도 잡힌다. 지나치지 않았으면 발이 윗면 아래 무릎(StepUp) 안일 때만 올라선다.
                    // 그보다 아래는 옆면이다: 위로 끌어올리지 않는다(Unstick 이 밖으로 민다). 탑에서는 한 뼘 모자란
                    // 도약이 전부 구원돼 실수의 값이 0 이 됐다.
                    // 하이트맵 게임(천장 없음)은 아래 옛 판정 그대로 — 이 분기가 다르면 봇 판 결과가 달라진다
                    // (마지막 한 사람 무기 균형 28% → 36%, 판정 시각 몇 프레임 차이가 싸움을 바꾼다)
                    float floorPrev = ground.HeightAt(new Vector3(Pos.x, prevY, Pos.z));
                    if (Now == State.Air || Now == State.Glide)
                    {
                        bool crossed = prevY >= floorPrev - 0.001f && Pos.y <= floorPrev;
                        bool onto = _vel.y <= 0.01f && Pos.y <= floor && floor - Pos.y <= mantle;
                        if (crossed || onto) Land(crossed ? floorPrev : floor);
                    }
                    else if (Now == State.Ground)
                    {
                        float diff = floor - Pos.y;
                        if (diff >= 0f && diff <= _t.StepUp) Pos.y = floor;          // 오르막·낮은 턱
                        else if (diff < 0f && -diff <= _t.StepDown) Pos.y = floor;   // 비탈을 따라 내려간다
                        else if (diff < 0f) Now = State.Air;                         // 진짜 낭떠러지다
                        // diff > StepUp — 몸이 지형 속이다. 아래 Unstick 이 밀어낸다
                    }
                    else if (Pos.y <= floor && floor - Pos.y <= mantle) Pos.y = floor;   // 구르기 등
                }
                else if (Pos.y <= floor)
                {
                    // **위로 끌어올리지 않는다.** 지면에 붙는 길은 떨어지는 것뿐이다 —
                    // 예전엔 계단 앞에서 점프하면 꼭대기로 순간이동했다.
                    Pos.y = floor;
                    if (Now == State.Air || Now == State.Glide) Land(floor);
                }
                else if (Now == State.Ground)
                {
                    float drop = Pos.y - floor;
                    if (drop <= _t.StepDown) Pos.y = floor;   // 비탈을 따라 내려간다
                    else Now = State.Air;                     // 진짜 낭떠러지다
                }
            }

            if (MapRadius > 0f)
            {
                Pos.x = Mathf.Clamp(Pos.x, -MapRadius, MapRadius);
                Pos.z = Mathf.Clamp(Pos.z, -MapRadius, MapRadius);
            }
            // **옆으로 밀어내는 것이 먼저다.** Unstick 은 갇힌 몸을 위로 올리는 마지막 수단인데, 벽 속에 잠긴 몸을
            // 먼저 올려 버리면 그것이 곧 「끼였다 빠진다」다(공중에서 1.07 솟은 실측). 옆으로 빠져나오면 그대로 떨어진다.
            // 미는 기준도 **이동을 막는 턱**과 같다 — 엄격한 공중 무릎으로 밀면 비탈에서 뛰는 몸을 뒤로 민다
            if (_t.PushOutOfWalls && !selfPlaced) Pos = _body.PushOut(ground, Pos, stepUp);
            Pos = _body.Unstick(ground, Pos);
        }

        private void Land(float y)
        {
            Pos.y = y;
            Now = State.Ground;
            _vel.y = 0f;
            // 착지 충격이 수평 속도를 반 넘게 먹는다. 즉답 지면(Slip 0)에서는 다음 프레임
            // Walk 가 덮어써 뜻이 없고, 얼음에서는 이 값이 「착지 후 얼마나 미끄러지나」다 —
            // 그대로 두면 8 유닛 속도가 반폭 2 짜리 발판을 무조건 넘겨 버렸다
            _vel.x *= 0.25f;
            _vel.z *= 0.25f;
            ChargedAir = false;
            Landed = true;
        }

        private void Face(Vector3 dir)
        {
            if (dir.sqrMagnitude < 0.0001f) return;
            Yaw = Mathf.LerpAngle(Yaw, Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg, 0.35f);
        }
    }
}
