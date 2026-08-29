using System;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;

namespace Kgd
{
    /// <summary>
    /// 플랫폼 JS 전역과의 유일한 접점. 게임 코드는 이 클래스를 직접 부르지 않고
    /// KgdInput · KgdPlatform · KgdSave · KgdHud · KgdDevice 파사드만 쓴다.
    ///
    /// 에디터·스탠드얼론에서는 JS 가 없으므로 값이 전부 기본값이다 — 그래서 키보드만으로도
    /// 게임이 완주되어야 하고, 그 상태로 PlayMode 테스트가 돈다.
    /// </summary>
    [DefaultExecutionOrder(-10000)]
    internal sealed class KgdBridge : MonoBehaviour
    {
        internal const int FieldCount = 10;

        internal static KgdBridge Instance { get; private set; }

        /// <summary>KgdPoll 이 채우는 프레임 스냅샷. 인덱스는 kgd.jslib 주석과 같은 순서다.</summary>
        internal readonly float[] Frame = new float[FieldCount];

        internal int PrevMask { get; private set; }
        internal int Mask => (int)Frame[7];

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Boot()
        {
            if (Instance != null) return;
            var go = new GameObject("~KgdBridge") { hideFlags = HideFlags.HideAndDontSave };
            DontDestroyOnLoad(go);
            Instance = go.AddComponent<KgdBridge>();
            Instance.Frame[6] = 1f;  // 정보 패널은 기본이 펼침 (데스크톱 기준)
            Instance.Frame[9] = 46f; // 셸이 우상단에 예약한 띠 — JS 가 없는 에디터에서도 같은 자리에 그린다
            Instance.Poll();
        }

        private void Update()
        {
            PrevMask = Mask;
            Poll();
        }

        private void Poll()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdPoll(Frame);
#endif
        }

        /// <summary>가상패드 슬롯 1~5 에 대응하는 웹 key code 를 등록한다. index.html 의 data-actions 와 같아야 한다.</summary>
        internal static void SetActionCodes(string commaSeparated)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdSetActions(commaSeparated ?? string.Empty);
#endif
        }

        internal static void SubmitScore(int score, string detail, string board)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdSubmitScore(score, detail ?? string.Empty, board ?? string.Empty);
#else
            Debug.Log($"[Kgd] runEnd score={score} detail={detail} board={board}");
#endif
        }

        internal static void SaveSet(string key, string value)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdSaveSet(key, value ?? string.Empty);
#else
            PlayerPrefs.SetString(key, value ?? string.Empty); // 에디터 전용 대체 경로
#endif
        }

        internal static string SaveGet(string key)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            int need = KgdSaveGet(key, null, 0);
            if (need <= 1) return string.Empty;
            var buf = new byte[need];
            KgdSaveGet(key, buf, need);
            int len = Array.IndexOf(buf, (byte)0);
            return Encoding.UTF8.GetString(buf, 0, len < 0 ? need : len);
#else
            return PlayerPrefs.GetString(key, string.Empty);
#endif
        }

        internal static void SetMenuOpen(bool open)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdSetMenuOpen(open ? 1 : 0);
#endif
        }

        internal static void Ready()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdReady();
#endif
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void KgdPoll(float[] outFields);
        [DllImport("__Internal")] private static extern void KgdSetActions(string codes);
        [DllImport("__Internal")] private static extern void KgdSubmitScore(int score, string detail, string board);
        [DllImport("__Internal")] private static extern void KgdSaveSet(string key, string value);
        [DllImport("__Internal")] private static extern int KgdSaveGet(string key, byte[] buffer, int bufferLength);
        [DllImport("__Internal")] private static extern void KgdSetMenuOpen(int open);
        [DllImport("__Internal")] private static extern void KgdReady();
#endif
    }
}
