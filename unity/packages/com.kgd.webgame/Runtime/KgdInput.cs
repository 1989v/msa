using UnityEngine;

namespace Kgd
{
    /// <summary>
    /// 게임이 읽는 유일한 입력 창구. 키보드(플랫폼 입력 표준)와 가상패드를 합쳐서 준다.
    ///
    /// UnityEngine.Input 을 게임 코드에서 직접 읽으면 가상패드가 이 합류점을 우회해
    /// 모바일에서 조용히 안 움직인다. 키 배치는 docs/conventions/game-input-standard.md 가 원본이고,
    /// 손잡이(오른손/왼손) 선택은 lib/keys.js 가 전 게임 공유로 들고 있다.
    /// </summary>
    public static class KgdInput
    {
        /// <summary>슬롯 1~5 의 오른손잡이 키 (액션1 공격 / 액션2 점프·결정 / 액션3 대시·특수 / 보조1 / 보조2)</summary>
        private static readonly KeyCode[] RightHand = { KeyCode.C, KeyCode.X, KeyCode.Z, KeyCode.A, KeyCode.S };
        private static readonly KeyCode[] LeftHand = { KeyCode.L, KeyCode.K, KeyCode.J, KeyCode.U, KeyCode.I };

        /// <summary>이동 입력. Unity 좌표계(위가 +y)로 돌려준다. 길이는 0~1 이고 아날로그 값이 살아 있다.</summary>
        /// <summary>
        /// **가상패드만.** 키보드는 게임이 고른다 — 3D 게임은 이동과 시점을 갈라야 해서
        /// 공용 배치(오른손잡이 = 방향키 이동)를 그대로 쓰면 시점 키와 겹친다.
        /// 2D 게임은 <see cref="Move"/> 를 그대로 쓰면 된다.
        /// </summary>
        public static Vector2 PadMove
        {
            get
            {
                var b = KgdBridge.Instance;
                if (b == null || b.Frame[2] <= 0f) return Vector2.zero;
                return new Vector2(b.Frame[0], -b.Frame[1]);   // 화면 좌표는 아래가 +y 다
            }
        }

        /// <summary>WASD. 3D 게임에서 이동에 쓰고, 시점은 방향키로 가른다.</summary>
        public static Vector2 Wasd
        {
            get
            {
                Vector2 k = Vector2.zero;
                if (Input.GetKey(KeyCode.A)) k.x -= 1f;
                if (Input.GetKey(KeyCode.D)) k.x += 1f;
                if (Input.GetKey(KeyCode.W)) k.y += 1f;
                if (Input.GetKey(KeyCode.S)) k.y -= 1f;
                return k.sqrMagnitude > 1f ? k.normalized : k;
            }
        }

        /// <summary>방향키. 3D 게임에서 시점에 쓴다.</summary>
        public static Vector2 Arrows
        {
            get
            {
                Vector2 k = Vector2.zero;
                if (Input.GetKey(KeyCode.LeftArrow)) k.x -= 1f;
                if (Input.GetKey(KeyCode.RightArrow)) k.x += 1f;
                if (Input.GetKey(KeyCode.UpArrow)) k.y += 1f;
                if (Input.GetKey(KeyCode.DownArrow)) k.y -= 1f;
                return k;
            }
        }

        public static Vector2 Move
        {
            get
            {
                var b = KgdBridge.Instance;
                Vector2 pad = Vector2.zero;
                if (b != null && b.Frame[2] > 0f)
                {
                    pad = new Vector2(b.Frame[0], -b.Frame[1]); // 화면 좌표는 아래가 +y 다
                }

                Vector2 key = Vector2.zero;
                if (LeftHanded)
                {
                    if (Input.GetKey(KeyCode.A)) key.x -= 1f;
                    if (Input.GetKey(KeyCode.D)) key.x += 1f;
                    if (Input.GetKey(KeyCode.W)) key.y += 1f;
                    if (Input.GetKey(KeyCode.S)) key.y -= 1f;
                }
                else
                {
                    if (Input.GetKey(KeyCode.LeftArrow)) key.x -= 1f;
                    if (Input.GetKey(KeyCode.RightArrow)) key.x += 1f;
                    if (Input.GetKey(KeyCode.UpArrow)) key.y += 1f;
                    if (Input.GetKey(KeyCode.DownArrow)) key.y -= 1f;
                }
                if (key.sqrMagnitude > 1f) key.Normalize();

                var sum = pad + key;
                return sum.sqrMagnitude > 1f ? sum.normalized : sum;
            }
        }

        /// <summary>
        /// 이동 입력을 XZ 평면 벡터로. <see cref="Move"/> 를 Vector3 에 그대로 대입하면
        /// 앞뒤가 **위아래**로 들어가 앞으로 한 발도 못 간다 — 3D 게임은 이걸 쓴다.
        /// </summary>
        public static Vector3 MovePlanar
        {
            get
            {
                var m = Move;
                return new Vector3(m.x, 0f, m.y);
            }
        }

        /// <summary>손잡이 배치. lib/keys.js 의 선택을 그대로 따른다 (전 게임 공유값).</summary>
        public static bool LeftHanded
        {
            get
            {
                var b = KgdBridge.Instance;
                return b != null && b.Frame[8] > 0.5f;
            }
        }

        /// <summary>슬롯 1~5 를 누르고 있는가.</summary>
        public static bool Action(int slot) => Held(slot);

        /// <summary>이 프레임에 눌렸는가.</summary>
        public static bool ActionDown(int slot)
        {
            if (slot < 1 || slot > 5) return false;
            var b = KgdBridge.Instance;
            bool padNow = b != null && (b.Mask & (1 << (slot - 1))) != 0;
            bool padPrev = b != null && (b.PrevMask & (1 << (slot - 1))) != 0;
            return (padNow && !padPrev) || Input.GetKeyDown(KeyOf(slot));
        }

        /// <summary>일시정지/메뉴 — Enter. 가상패드의 시스템 ⏸ 버튼(Escape 합성)도 여기로 들어온다.</summary>
        public static bool PauseDown
        {
            get
            {
                var b = KgdBridge.Instance;
                bool padNow = b != null && (b.Mask & 32) != 0;
                bool padPrev = b != null && (b.PrevMask & 32) != 0;
                return (padNow && !padPrev) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter);
            }
        }

        /// <summary>뒤로/취소 — Esc. 레이아웃과 무관한 공통 키다.</summary>
        public static bool BackDown => Input.GetKeyDown(KeyCode.Escape);

        /// <summary>
        /// 화면을 누르고 있는가. 터치와 마우스를 같이 본다 —
        /// 자동 사격 게임에서는 이것이 **이동 입력**이 될 수 있고, 그러면 모바일에서
        /// 조이스틱을 찾지 않고도 한 손으로 논다.
        /// </summary>
        public static bool PointerHeld =>
            Input.touchCount > 0 ? Input.GetTouch(0).phase != TouchPhase.Ended &&
                                   Input.GetTouch(0).phase != TouchPhase.Canceled
                                 : Input.GetMouseButton(0);

        public static bool PointerDown =>
            Input.touchCount > 0 ? Input.GetTouch(0).phase == TouchPhase.Began
                                 : Input.GetMouseButtonDown(0);

        /// <summary>누른 자리(스크린 좌표). 누르고 있지 않으면 마지막 자리를 준다.</summary>
        public static Vector2 PointerScreen =>
            Input.touchCount > 0 ? Input.GetTouch(0).position : (Vector2)Input.mousePosition;

        private static bool Held(int slot)
        {
            if (slot < 1 || slot > 5) return false;
            var b = KgdBridge.Instance;
            if (b != null && (b.Mask & (1 << (slot - 1))) != 0) return true;
            return Input.GetKey(KeyOf(slot));
        }

        private static KeyCode KeyOf(int slot) => (LeftHanded ? LeftHand : RightHand)[slot - 1];

        /// <summary>
        /// 가상패드 슬롯에 대응하는 웹 key code 를 등록한다. index.html 의 data-actions 순서와 같아야 한다.
        /// 게임 부팅 시 한 번 부른다.
        /// </summary>
        public static void BindPadActions(params string[] webKeyCodes)
            => KgdBridge.SetActionCodes(string.Join(",", webKeyCodes));
    }
}
