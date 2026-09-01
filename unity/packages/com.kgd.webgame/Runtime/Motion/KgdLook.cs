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

        /// <param name="zoneBottom">
        /// 시점 구역의 아래 경계(0~1, 화면 아래에서 잰 비율). 가상패드가 차지하는 아래쪽을
        /// 빼려면 0.4 언저리를 준다. 손가락은 **시작 자리로만** 걸러지므로, 잡은 뒤에는
        /// 구역 밖으로 끌어도 계속 돈다.
        /// </param>
        public void Tick(float zoneBottom)
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

                // 새로 시작한 손가락 중 시점 구역에서 눌린 것을 잡는다
                float floor = Screen.height * zoneBottom;
                for (int i = 0; i < Input.touchCount; i++)
                {
                    var t = Input.GetTouch(i);
                    if (t.phase != TouchPhase.Began || t.position.y < floor) continue;
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
