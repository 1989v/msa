using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Kgd.Editor
{
    /// <summary>
    /// WebGL 배치 빌드. 빌드 설정을 여기 한 곳에 두는 이유는, 에디터 GUI 에서 만진 값은
    /// 다음 사람이 무엇을 왜 그렇게 뒀는지 알 수 없기 때문이다 — 근거는 주석으로 남는다.
    ///
    /// 호출: unity build &lt;project&gt; --target WebGL \
    ///         --execute-method Kgd.Editor.WebBuild.Build -o &lt;출력경로&gt;
    /// </summary>
    public static class WebBuild
    {
        public static void Build()
        {
            string output = OutputPath();
            if (string.IsNullOrEmpty(output))
            {
                Fail("출력 경로가 없다 — -buildOutput <경로> 를 넘겨라 (unity build 의 -o 가 이걸로 온다)");
                return;
            }

            Apply();

            string[] scenes = Scenes();
            if (scenes.Length == 0)
            {
                Fail("빌드에 넣을 씬이 없다 — Assets/Scenes/*.unity 를 확인하라");
                return;
            }

            // 산출물 폴더를 지우고 새로 굽는다. 파일명이 해시라 옛 빌드가 남으면 계속 쌓인다.
            if (Directory.Exists(output)) Directory.Delete(output, true);
            Directory.CreateDirectory(output);

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = output,
                target = BuildTarget.WebGL,
                targetGroup = BuildTargetGroup.WebGL,
                options = BuildOptions.None
            });

            var summary = report.summary;
            Debug.Log($"[Kgd] WebGL 빌드 {summary.result} · {summary.totalSize / 1024 / 1024}MB · {summary.totalTime}");
            if (summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                Fail($"빌드 실패 — {summary.result}");
            }
        }

        private static void Apply()
        {
            var web = NamedBuildTarget.WebGL;

            // 압축은 Gzip 이다. 서빙 nginx 이미지에 brotli 모듈이 없어 .br 은 Content-Encoding 이 안 붙는다.
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;

            // 폴백을 켜면 서버 헤더가 틀려도 JS 가 대신 풀어 준다 — 즉 설정 오류가 숨는다.
            // 끄면 잘못된 순간 바로 드러나고, 로더도 그만큼 가벼워진다.
            PlayerSettings.WebGL.decompressionFallback = false;

            // 파일명에 해시가 붙어야 Build/ 를 immutable 로 캐시할 수 있다.
            // 이름이 고정이면 배포 때마다 10MB 를 재검증해야 해서 로딩이 느려진다.
            PlayerSettings.WebGL.nameFilesAsHashes = true;

            // 재방문 시 .data 를 IndexedDB 에서 읽는다 — 두 번째 로딩이 눈에 띄게 짧아진다.
            PlayerSettings.WebGL.dataCaching = true;

            // 예외 처리를 빼면 코드가 작아지고 빨라진다. 대신 스택 트레이스가 없으므로,
            // 원인을 좇아야 할 때만 이 줄을 잠깐 ExplicitlyThrownExceptionsOnly 로 바꾼다.
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;

            // SharedArrayBuffer 는 COOP/COEP 헤더가 있어야 하고 우리 nginx 는 그걸 안 준다.
            PlayerSettings.WebGL.threadsSupport = false;
            PlayerSettings.WebGL.showDiagnostics = false;
            PlayerSettings.WebGL.powerPreference = WebGLPowerPreference.HighPerformance;

            // 우리 규약이 들어간 템플릿. 기본 템플릿에는 lib/ 로드도 viewport 도 없다.
            PlayerSettings.WebGL.template = "PROJECT:Kgd";

            // 용량 — 게임 하나 전송량 상한이 15MB 다.
            PlayerSettings.SetManagedStrippingLevel(web, ManagedStrippingLevel.High);
            PlayerSettings.SetIl2CppCodeGeneration(web, Il2CppCodeGeneration.OptimizeSize);
            PlayerSettings.stripEngineCode = true;

            // Unity 6 Personal 은 스플래시를 끌 수 있다.
            // 유니티 스플래시 — Personal 라이선스는 끌 수 없고, 끌 수 있어도 켜 둔다.
            // 무엇으로 만들었는지가 보이는 편이 맞고, 그 1.5초 동안 첫 씬이 준비된다.
            PlayerSettings.SplashScreen.show = true;
            PlayerSettings.SplashScreen.showUnityLogo = true;
            PlayerSettings.SplashScreen.unityLogoStyle = PlayerSettings.SplashScreen.UnityLogoStyle.DarkOnLight;
            PlayerSettings.SplashScreen.animationMode = PlayerSettings.SplashScreen.AnimationMode.Dolly;
            PlayerSettings.SplashScreen.drawMode = PlayerSettings.SplashScreen.DrawMode.UnityLogoBelow;
            PlayerSettings.SplashScreen.backgroundColor = new Color(0.016f, 0.027f, 0.020f, 1f);

            // 모바일이 1순위 타겟이라 감마 + 저부하 기본값으로 둔다.
            PlayerSettings.colorSpace = ColorSpace.Gamma;
        }

        private static string[] Scenes()
        {
            var enabled = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (enabled.Length > 0) return enabled;

            // 씬을 Build Settings 에 등록하는 것은 에디터 GUI 작업이다 — 배치 빌드에서는
            // Assets/Scenes 를 훑어 채운다. Main.unity 가 있으면 그것이 첫 씬이다.
            var found = Directory.GetFiles("Assets/Scenes", "*.unity", SearchOption.AllDirectories)
                .Select(p => p.Replace('\\', '/'))
                .OrderBy(p => Path.GetFileName(p) == "Main.unity" ? 0 : 1)
                .ThenBy(p => p)
                .ToArray();
            return found;
        }

        private static string OutputPath()
        {
            var args = Environment.GetCommandLineArgs();
            var keys = new HashSet<string> { "-buildOutput", "-customBuildPath", "-kgdOutput" };
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (keys.Contains(args[i])) return Path.GetFullPath(args[i + 1]);
            }
            return null;
        }

        private static void Fail(string message)
        {
            Debug.LogError($"[Kgd] {message}");
            EditorApplication.Exit(1);
        }
    }
}
