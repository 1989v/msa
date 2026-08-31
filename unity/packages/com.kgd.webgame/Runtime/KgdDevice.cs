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

        /// <summary>
        /// **우상단에 비워 둬야 하는 띠 높이(CSS px).**
        ///
        /// 플랫폼 셸(portal-fe 게임 상세 화면)이 그 자리에 닫기 ✕ · 전체화면 ⛶ 칩을 띄운다.
        /// 셸은 iframe 바깥이라 항상 위에 뜨고, 게임이 같은 자리에 버튼을 두면 **눌리지 않는다**
        /// (2026-08-29: 궁수 키우기의 강화창 닫기 버튼이 그랬다).
        /// 게임의 우상단 UI 는 이 값만큼 내려서 놓는다. 기기의 안전영역이 더해진 값이다.
        /// </summary>
        public static float ChromeTopCss
        {
            get
            {
                var b = KgdBridge.Instance;
                return b == null ? 46f : Mathf.Max(0f, b.Frame[9]);
            }
        }

        /// <summary>
        /// **기기가 가리는 위쪽 높이(CSS px).** 노치·상태바 몫이고, 셸 칩은 빠져 있다.
        ///
        /// 셸의 닫기·전체화면 칩은 **우상단 모서리**에 뜬다 — 화면을 가로지르는 띠가 아니다.
        /// 왼쪽·가운데 UI 까지 <see cref="ChromeTopCss"/> 만큼 내리면, 칩이 없는 PC 에서
        /// 체력·자원이 이유 없이 한 줄 내려앉는다. 우상단에 놓는 것만 그 값을 쓰고
        /// 나머지는 이 값을 쓴다.
        /// </summary>
        public static float SafeTopCss
        {
            get
            {
                var b = KgdBridge.Instance;
                return b == null ? 0f : Mathf.Max(0f, b.Frame[10]);
            }
        }
    }

    /// <summary>
    /// 언어. 셸(포털·lib/i18n.js)이 정한 값이고, 셸이 없으면 브라우저 언어로 떨어진다.
    ///
    /// **에디터·게이트에는 JS 가 없어 항상 한국어다.** 게이트 로그가 한국어로 남아야
    /// 지금까지의 진단 기록·문서와 말이 맞는다.
    ///
    /// 저장 키(`game_lang`)는 플랫폼 공용이라 포털과 다른 게임도 같이 따라온다 — 그래서
    /// 게임 세이브가 아니고, index.html 의 saveKeys 에 넣지 않는다(넣으면 언어 설정이
    /// 계정 세이브로 서버에 올라간다).
    /// </summary>
    public static class KgdLang
    {
        public static bool IsEnglish
        {
            get
            {
                var b = KgdBridge.Instance;
                return b != null && b.Frame[11] > 0.5f;
            }
        }

        public static void Save(bool english) => KgdBridge.SaveSet("game_lang", english ? "en" : "ko");
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
