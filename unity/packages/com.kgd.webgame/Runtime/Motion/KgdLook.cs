using UnityEngine;

namespace Kgd.Motion
{
    /// <summary>
    /// 화면을 끌어 시점을 돌린다.
    ///
    /// **가상패드를 잡은 손가락을 피해야 한다.** `Input.GetTouch(0)` 만 보면 스틱을 미는
    /// 손가락이 카메라까지 돌려, 걸으면 화면이 같이 돈다(실제 신고). 그래서 손가락을
    /// **id 로 붙들고**, 시작 자리가 시점 구역 안일 때만 잡는다.
    ///
    /// 마우스는 구역을 따지지 않는다 — 가상패드가 없는 기기라 겹칠 손가락이 없다.
    /// </summary>
    public sealed class KgdLook
    {
        private int _finger = -1;
        private Vector2 _last;
        private bool _mouse;

        /// <summary>이번 프레임에 끈 만큼(픽셀). 안 끌면 0 이다.</summary>
        public Vector2 Delta { get; private set; }

        /// <summary>지금 시점을 돌리는 중인가.</summary>
        public bool Active => _finger >= 0 || _mouse;

        /// <summary>
        /// 이동 스틱이 차지하는 **좌하단 사각형**. 여기서 시작한 손가락은 시점을 안 돌린다.
        ///
        /// 띠(가로줄)로 가르면 안 된다 — 스틱 영역이 세로로 길어서, 띠 경계 위쪽에
        /// 스틱 영역이 남고 그 자리에서 시작하면 **이동과 시점이 같이 움직인다**
        /// (실제 신고). 가로 844×390 에서 스틱 영역은 287×210 이라 화면 위 기준
        /// y 180~390 인데, 띠를 0.40 으로 두면 시점 구역이 y 0~234 라 54px 이 겹쳤다.
        ///
        /// 세로/가로에서 스틱 영역의 비율이 달라 방향에 따라 다른 값을 쓴다.
        /// </summary>
        public static Rect StickZone => KgdDevice.IsLandscape
            ? new Rect(0f, 0f, 0.42f, 0.60f)    // 실제 0.34 × 0.54 를 덮는다
            : new Rect(0f, 0f, 0.58f, 0.34f);   // 실제 0.52 × 0.28 을 덮는다

        /// <summary>
        /// 손가락은 **시작 자리로만** 걸러진다 — 잡은 뒤에는 구역 밖으로 끌어도 계속 돈다.
        /// </summary>
        public void Tick() => Tick(StickZone);

        public void Tick(Rect exclude)
        {
            Delta = Vector2.zero;

            if (Input.touchCount > 0)
            {
                _mouse = false;

                // 붙들고 있던 손가락을 먼저 찾는다
                if (_finger >= 0)
                {
                    for (int i = 0; i < Input.touchCount; i++)
                    {
                        var t = Input.GetTouch(i);
                        if (t.fingerId != _finger) continue;
                        if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled) { _finger = -1; break; }
                        Delta = t.position - _last;
                        _last = t.position;
                        return;
                    }
                    if (_finger >= 0) _finger = -1;   // 목록에서 사라졌다
                }

                // 새로 시작한 손가락 중 **스틱 영역 밖**에서 눌린 것을 잡는다
                for (int i = 0; i < Input.touchCount; i++)
                {
                    var t = Input.GetTouch(i);
                    if (t.phase != TouchPhase.Began) continue;
                    var n = new Vector2(t.position.x / Mathf.Max(1, Screen.width),
                                        t.position.y / Mathf.Max(1, Screen.height));
                    if (exclude.Contains(n)) continue;
                    _finger = t.fingerId;
                    _last = t.position;
                    return;
                }
                return;
            }

            _finger = -1;
            if (Input.GetMouseButtonDown(0)) { _mouse = true; _last = Input.mousePosition; }
            else if (!Input.GetMouseButton(0)) _mouse = false;
            else if (_mouse)
            {
                Vector2 now = Input.mousePosition;
                Delta = now - _last;
                _last = now;
            }
        }
    }
}
