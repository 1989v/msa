using UnityEngine;

namespace Kgd.Art
{
    /// <summary>
    /// 하늘과 환경광을 한 벌로 잡는다.
    ///
    /// **비용은 거의 없다.** 하늘은 어차피 지워야 하는 픽셀이고, 환경광 3색(하늘·지평선·땅)은
    /// 정점 셰이더의 구면조화 상수에 들어가 픽셀 비용이 0 이다. 그런데 화면에서는 이 둘이
    /// 「덜 만든 것」과 「만든 것」을 가른다 — 단색 하늘 + 단색 환경광은 어느 각도에서 봐도 평평하다.
    ///
    /// 셰이더 `Kgd/Sky` 는 게임의 Resources 에 둔다(스트리핑 때문, KgdMat 과 같은 이유).
    /// </summary>
    public static class KgdSky
    {
        private static Material _mat;

        /// <summary>
        /// 하늘 색 하나로 나머지를 뽑는다. 챕터가 바뀌면 다시 부른다.
        /// <paramref name="sun"/> 은 그 씬의 방향광 — 해 원반이 그 방향에 뜬다.
        /// <paramref name="cloudBelow"/> 는 **수평선 아래**의 구름띠(0~1) — 성층권처럼
        /// 구름이 발밑에 있는 고도에서 쓴다. 셰이더에 _CloudBelow 가 없으면 조용히 무시된다.
        /// </summary>
        public static void Apply(Camera camera, Color sky, Light sun, float cloud = 0.5f,
                                 float cloudBelow = 0f)
        {
            if (_mat == null)
            {
                var shader = Shader.Find("Kgd/Sky");
                if (shader == null) { Debug.LogError("셰이더를 못 찾았다: Kgd/Sky"); return; }
                _mat = new Material(shader) { name = "Sky" };
            }

            // 지평선은 하늘색을 밝게 탈색한 것, 천정은 짙게 — 산란의 모양이다
            Color.RGBToHSV(sky, out float hh, out float ss, out float vv);
            var top = Color.HSVToRGB(hh, Mathf.Clamp01(ss * 1.25f), Mathf.Clamp01(vv * 0.92f));
            var horizon = Color.HSVToRGB(hh, ss * 0.35f, Mathf.Clamp01(vv * 1.10f + 0.06f));
            var ground = Color.HSVToRGB(hh, ss * 0.3f, vv * 0.62f);

            _mat.SetColor("_Top", top);
            _mat.SetColor("_Horizon", horizon);
            _mat.SetColor("_Ground", ground);
            _mat.SetFloat("_CloudAmount", cloud);
            _mat.SetFloat("_CloudBelow", cloudBelow);
            if (sun != null) _mat.SetVector("_SunDir", -sun.transform.forward);

            RenderSettings.skybox = _mat;
            camera.clearFlags = CameraClearFlags.Skybox;

            // 환경광 3색 — 위는 하늘, 옆은 지평선, 아래는 땅의 반사. Lambert 표면 셰이더가
            // 그대로 받는다. 단색이면 절벽의 아랫면과 윗면이 같은 밝기라 높이가 안 읽힌다.
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            // 그늘이 빛의 40% 쯤이라야 한다. 그보다 어두우면 빛 반대편 면이 검은 판이 된다 —
            // 실측: 환경광 0.55 배에서 명암비 6:1, 벽 가까이서 화면 반이 검게 찼다
            RenderSettings.ambientSkyColor = Color.Lerp(top, Color.white, 0.3f) * 0.85f;
            RenderSettings.ambientEquatorColor = horizon * 0.92f;
            RenderSettings.ambientGroundColor = new Color(0.42f, 0.40f, 0.34f);

            // 안개는 지평선색으로 — 먼 것이 하늘에 녹아든다(공기 원근)
            RenderSettings.fogColor = horizon;
        }

        /// <summary>림라이트를 하늘색으로 — 야간용 초록 림이 주간에 남아 있으면 모든 것이 곰팡이 색이 된다.</summary>
        public static void TintRim(Material mat, Color sky, float strength = 0.45f)
        {
            if (mat == null) return;
            mat.SetColor("_RimColor", Color.Lerp(sky, Color.white, 0.4f));
            mat.SetFloat("_RimStrength", strength);
        }
    }
}
