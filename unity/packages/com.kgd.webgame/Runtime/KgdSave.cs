namespace Kgd
{
    /// <summary>
    /// 세이브. 반드시 이 클래스를 쓴다 — PlayerPrefs 는 WebGL 에서 IndexedDB 에 쓰므로
    /// lib/platform.js 의 localStorage 가로채기에 안 걸리고, 서버 동기화가 조용히 사라진다.
    ///
    /// 여기 쓴 키는 index.html 의 PlatformAdapter.init({ saveKeys: [...] }) 에도 같이 적어야 한다.
    /// </summary>
    public static class KgdSave
    {
        public static void Set(string key, string json) => KgdBridge.SaveSet(key, json);

        /// <summary>없으면 빈 문자열.</summary>
        public static string Get(string key) => KgdBridge.SaveGet(key);
    }
}
