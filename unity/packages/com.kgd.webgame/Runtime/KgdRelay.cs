using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;

namespace Kgd
{
    /// <summary>
    /// 게임 릴레이(`/ws/games/{slug}`) 클라이언트. 프로토콜은 ADR-0088 —
    /// join(seats)·start(players)·move(d, to)·seat·left. **여기는 통로만 안다**:
    /// 메시지를 만들고 읽는 것은 게임이 한다(스냅샷·의도의 스키마는 게임마다 다르다).
    ///
    /// 에디터·스탠드얼론에는 소켓이 없다 — <see cref="State"/> 가 늘 Closed 라
    /// 게임은 자연히 오프라인(혼자 + 봇) 경로로 간다. 게이트도 그 경로로 돈다.
    /// </summary>
    public static class KgdRelay
    {
        public enum Link { Connecting = 0, Open = 1, Closed = 2 }

        private static byte[] _buf = new byte[4096];

        /// <summary>소켓을 연다. 이미 열려 있으면 닫고 새로 연다.</summary>
        public static void Open(string slug)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdRelayOpen(slug);
#endif
        }

        public static Link State
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return (Link)KgdRelayState();
#else
                return Link.Closed;
#endif
            }
        }

        public static void Send(string json)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdRelaySend(json);
#endif
        }

        /// <summary>받은 메시지를 하나 꺼낸다. 없으면 false. 프레임마다 비워질 때까지 돈다.</summary>
        public static bool TryNext(out string message)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            int need = KgdRelayNext(null, 0);
            if (need <= 0) { message = null; return false; }
            if (_buf.Length < need) _buf = new byte[Mathf.NextPowerOfTwo(need)];
            KgdRelayNext(_buf, _buf.Length);
            int len = System.Array.IndexOf(_buf, (byte)0);
            message = Encoding.UTF8.GetString(_buf, 0, len < 0 ? need - 1 : len);
            return true;
#else
            message = null;
            return false;
#endif
        }

        public static void Close()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            KgdRelayClose();
#endif
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void KgdRelayOpen(string slug);
        [DllImport("__Internal")] private static extern int KgdRelayState();
        [DllImport("__Internal")] private static extern void KgdRelaySend(string json);
        [DllImport("__Internal")] private static extern int KgdRelayNext(byte[] buffer, int bufferLength);
        [DllImport("__Internal")] private static extern void KgdRelayClose();
#endif
    }
}
