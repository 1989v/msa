using UnityEngine;

namespace Kgd
{
    /// <summary>
    /// 기기 상태. 분기는 기기 이름이나 폭 구간이 아니라 여기 값으로 한다
    /// (docs/conventions/game-input-standard.md — 폴드는 펴면 673×841, 접으면 344×882 로 둘 다 세로다).
    /// </summary>
    public static class KgdDevice
    {
        /// <summary>터치 기기인가. 가상패드가 켜지는 조건과 같은 기준(pointer: coarse)이다.</summary>
        public static bool IsCoarsePointer
        {
            get
            {
                var b = KgdBridge.Instance;
                return b != null && b.Frame[5] > 0.5f;
            }
        }

        public static bool IsLandscape
        {
            get
            {
                var b = KgdBridge.Instance;
                if (b == null || !IsCoarsePointer) return Screen.width > Screen.height;
                return b.Frame[4] > 0.5f;
            }
        }

        /// <summary>가상패드가 차지한 하단 띠 높이(CSS px). 세로에서만 0 이 아니다.</summary>
        public static float PadHeightCss
        {
            get
            {
                var b = KgdBridge.Instance;
                return b == null ? 0f : b.Frame[3];
            }
        }
    }

    /// <summary>
    /// 정보 패널 접기 신호. 모바일 기본값은 접힘이고, 접힌 상태에서도 지금 판단에 꼭 필요한 값
    /// (자원·체력·웨이브)은 한 줄로 보여야 한다 — 무엇을 접을지는 게임이 정한다.
    /// </summary>
    public static class KgdHud
    {
        public static bool Expanded
        {
            get
            {
                var b = KgdBridge.Instance;
                return b == null || b.Frame[6] > 0.5f;
            }
        }
    }
}
