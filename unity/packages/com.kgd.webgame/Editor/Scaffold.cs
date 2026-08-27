using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Kgd.Editor
{
    /// <summary>
    /// 새 게임의 씬 골격을 배치 모드로 만든다.
    ///
    /// 씬은 Main.unity 하나이고 그 안에는 Bootstrap 오브젝트 하나뿐이다 — 카메라·조명·프리팹까지
    /// 전부 게임 코드가 런타임에 만든다. 에디터 GUI 로 놓아 둔 상태가 없어야 파일만 보고
    /// 무엇이 왜 그렇게 되어 있는지 읽히고, 배치 빌드로 그대로 재현된다.
    /// </summary>
    public static class Scaffold
    {
        public static void CreateMainScene()
        {
            const string path = "Assets/Scenes/Main.unity";
            Directory.CreateDirectory("Assets/Scenes");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var go = new GameObject("Bootstrap");

            var entry = Type.GetType("GameEntry, Assembly-CSharp");
            if (entry != null) go.AddComponent(entry);
            else Debug.LogWarning("[Kgd] GameEntry 를 못 찾았다 — 스크립트를 넣은 뒤 다시 실행하라");

            EditorSceneManager.SaveScene(scene, path);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(path, true) };
            AssetDatabase.SaveAssets();
            Debug.Log($"[Kgd] {path} 생성 · Build Settings 등록 완료");
        }
    }
}
