using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace Kgd.Content
{
    /// <summary>
    /// 챕터 아트를 필요할 때 받아 둔다.
    ///
    /// **Addressables 를 쓰지 않는다.** 번들이 몇 개뿐이고 주소를 우리가 이미 정하고 있어서
    /// (해시 파일명 + `immutable` 은 nginx 가 한다) 카탈로그 계층이 하는 일이 없다.
    /// `com.unity.modules.assetbundle` 은 기본 매니페스트에 이미 들어 있다.
    ///
    /// **쪼개는 값은 아트가 챕터마다 다를 때만 나온다.** 같은 킷을 쓰는 챕터로 나누면
    /// 내려받는 양이 줄지 않는다 — 폰트 아틀라스처럼 챕터와 무관한 것은 늘 기본 빌드에 있다.
    /// </summary>
    public sealed class KgdChapters
    {
        private readonly Dictionary<string, AssetBundle> _loaded = new();
        private readonly Dictionary<string, Dictionary<string, UnityEngine.Object>> _index = new();

        /// <summary>받아 둔 번들 수. 화면에 보여 주거나 검사에서 센다.</summary>
        public int LoadedCount => _loaded.Count;

        public bool Ready(string bundle) => string.IsNullOrEmpty(bundle) || _loaded.ContainsKey(bundle);

        /// <summary>
        /// 번들 하나를 받는다. 이미 있으면 즉시 끝난다.
        /// <paramref name="done"/> 은 성공 여부를 받는다 — **조용히 넘어가지 않는다.**
        /// 번들이 없으면 그 챕터가 소품 없이 그려지는데, 그게 「가벼운 챕터」로 보여
        /// 원인을 못 찾는다.
        /// </summary>
        public IEnumerator Load(string bundle, Action<float> progress, Action<bool> done)
        {
            if (Ready(bundle)) { progress?.Invoke(1f); done?.Invoke(true); yield break; }

            string url = BaseUrl() + "Chapters/" + bundle;
            using var req = UnityWebRequestAssetBundle.GetAssetBundle(url);
            var op = req.SendWebRequest();
            while (!op.isDone)
            {
                progress?.Invoke(req.downloadProgress);
                yield return null;
            }

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[챕터] 번들 실패: {url} — {req.error}");
                done?.Invoke(false);
                yield break;
            }

            var loaded = DownloadHandlerAssetBundle.GetContent(req);
            if (loaded == null)
            {
                Debug.LogError($"[챕터] 번들을 열지 못했다: {url}");
                done?.Invoke(false);
                yield break;
            }

            _loaded[bundle] = loaded;
            Index(bundle, loaded);
            progress?.Invoke(1f);
            done?.Invoke(true);
        }

        /// <summary>
        /// 번들 안의 자산을 **이름으로** 찾는다. 번들의 자산 이름은 경로째 들어 있어
        /// (`assets/chapters/gy/character-zombie.fbx`) 그대로는 못 맞춘다 — 파일명만 남겨 색인한다.
        /// </summary>
        public T Find<T>(string bundle, string name) where T : UnityEngine.Object
        {
            if (string.IsNullOrEmpty(bundle) || name == null) return null;
            // 부르는 쪽은 Resources 접두(`gy/`)를 그대로 넘긴다 — 번들 이름과 맞춘다
            bundle = bundle.TrimEnd('/');
            if (!_index.TryGetValue(bundle, out var map)) return null;
            return map.TryGetValue(Normalize(name), out var found) ? found as T : null;
        }

        private void Index(string bundle, AssetBundle loaded)
        {
            var map = new Dictionary<string, UnityEngine.Object>();
            foreach (var asset in loaded.LoadAllAssets<UnityEngine.Object>())
            {
                if (asset == null) continue;
                string key = Normalize(asset.name);
                if (!map.ContainsKey(key)) map[key] = asset;
            }
            _index[bundle] = map;
            Debug.Log($"[챕터] {bundle} 색인 {map.Count}개");
        }

        private static string Normalize(string name)
        {
            int slash = name.LastIndexOfAny(new[] { '/', '\\' });
            if (slash >= 0) name = name.Substring(slash + 1);
            int dot = name.LastIndexOf('.');
            if (dot > 0) name = name.Substring(0, dot);
            return name.ToLowerInvariant();
        }

        /// <summary>
        /// 게임이 서빙되는 자리. **상대 경로로 받는다** — 배포 호스트를 코드에 박으면
        /// 로컬에서 되던 것이 배포에서 죽는다.
        /// </summary>
        public static string BaseUrl()
        {
            string u = Application.absoluteURL;
            if (string.IsNullOrEmpty(u)) return "";
            int cut = u.IndexOfAny(new[] { '?', '#' });
            if (cut >= 0) u = u.Substring(0, cut);
            int slash = u.LastIndexOf('/');
            return slash >= 0 ? u.Substring(0, slash + 1) : "";
        }
    }
}
