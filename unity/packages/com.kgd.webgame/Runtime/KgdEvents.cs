using UnityEngine;
using UnityEngine.EventSystems;

namespace Kgd
{
    /// <summary>
    /// **유니티 UI 버튼이 눌리게 하는 것.** 캔버스와 <c>GraphicRaycaster</c> 만으로는 UI 가
    /// 그려지되 클릭·터치가 오류 없이 조용히 버려진다 — <see cref="EventSystem"/> 이 있어야 한다.
    ///
    /// 이 플랫폼의 게임은 씬을 코드로 세우므로(에디터에 놓아 둔 것이 없다) EventSystem 도
    /// 게임마다 잊기 쉽다. 실제로 두 게임이 그 상태로 배포됐다(마지막 한 사람 시작 화면 ·
    /// 아홉 종 가방 칸). 그래서 게임이 부르지 않아도 **씬이 뜨면 패키지가 세운다.**
    ///
    /// 입력 처리기는 레거시 <c>Input</c> 기준이다(패키지의 <see cref="KgdInput"/> 이 그것을 읽는다).
    /// 새 Input System 만 켠 프로젝트면 모듈이 없으니 경고만 남긴다 — 그 프로젝트는 자기 모듈을 단다.
    /// </summary>
    public static class KgdEvents
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Ensure()
        {
            if (Object.FindFirstObjectByType<EventSystem>() != null) return;

            var go = new GameObject("~KgdEvents", typeof(EventSystem));
#if ENABLE_LEGACY_INPUT_MANAGER
            go.AddComponent<StandaloneInputModule>();
#else
            Debug.LogWarning("[Kgd] 레거시 입력 관리자가 꺼져 있다 — EventSystem 에 입력 모듈을 직접 달아야 버튼이 눌린다");
#endif
            Object.DontDestroyOnLoad(go);
        }
    }
}
