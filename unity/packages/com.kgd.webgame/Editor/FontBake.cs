using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace Kgd.Editor
{
    /// <summary>
    /// 한글 UI 폰트 아틀라스를 굽는다.
    ///
    /// WebGL 에는 시스템 폰트가 없다 — 안 구우면 모든 한글이 네모로 나간다.
    /// 아틀라스는 **정적**이고, 담는 글자는 게임 소스의 문자열 리터럴에서 뽑는다.
    /// 폰트 파일 전체(2.3MB)를 넣고 런타임에 굽는 방법도 있지만, 그러면 쓰지도 않는
    /// 2,350 자가 전송량에 들어간다 — 게임 하나 상한이 15MB 인 곳에서 낼 값이 아니다.
    ///
    /// 문자열을 새로 쓰면 다시 구워야 한다. 안 구우면 그 글자만 네모가 되므로
    /// 빌드 스크립트가 굽기를 먼저 돌린다.
    /// </summary>
    public static class FontBake
    {
        private const string SourceFont = "Assets/Fonts/GothicA1-Bold.ttf";
        private const string OutputAsset = "Assets/Resources/UIFont SDF.asset";
        private const string ExtraChars = "Assets/Fonts/charset-extra.txt";

        // 36px 샘플링이면 UI 표기 크기(11~72px)에서 SDF 가 뭉개지지 않는다.
        private const int SamplingPointSize = 36;
        private const int AtlasPadding = 4;
        private const int AtlasSize = 1024;

        public static void Bake()
        {
            var font = AssetDatabase.LoadAssetAtPath<Font>(SourceFont);
            if (font == null)
            {
                Debug.LogError($"[Kgd] 폰트가 없다: {SourceFont}");
                EditorApplication.Exit(1);
                return;
            }

            string charset = Charset();

            var asset = TMP_FontAsset.CreateFontAsset(
                font, SamplingPointSize, AtlasPadding, GlyphRenderMode.SDFAA,
                AtlasSize, AtlasSize, AtlasPopulationMode.Dynamic, true);
            asset.name = "UIFont SDF";

            asset.TryAddCharacters(charset, out string missing);
            if (!string.IsNullOrEmpty(missing))
                Debug.LogWarning($"[Kgd] 폰트에 없는 글자 {missing.Length}자: {missing}");

            // 정적으로 굳힌다 — 런타임에 폰트 파일을 들고 있지 않게.
            asset.atlasPopulationMode = AtlasPopulationMode.Static;

            Directory.CreateDirectory("Assets/Resources");
            if (File.Exists(OutputAsset)) AssetDatabase.DeleteAsset(OutputAsset);
            AssetDatabase.CreateAsset(asset, OutputAsset);
            foreach (var tex in asset.atlasTextures)
            {
                tex.name = "UIFont Atlas";
                AssetDatabase.AddObjectToAsset(tex, asset);
            }
            asset.material.name = "UIFont Material";
            AssetDatabase.AddObjectToAsset(asset.material, asset);

            SetAsDefault(asset);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            int glyphs = asset.characterTable.Count;
            Debug.Log($"[Kgd] 폰트 구움 · 글자 {glyphs}자 · 아틀라스 {asset.atlasTextures.Length}장 ({AtlasSize}×{AtlasSize})");
        }

        /// <summary>
        /// 아틀라스에 담을 글자. ASCII 전체 + 소스의 문자열 리터럴에 나온 글자.
        /// 주석까지 훑으면 쓰지도 않는 글자가 아틀라스를 채운다 — 리터럴만 본다.
        /// </summary>
        private static string Charset()
        {
            var set = new SortedSet<char>();
            for (char c = ' '; c <= '~'; c++) set.Add(c);

            var literal = new Regex("\"(?:[^\"\\\\\\n]|\\\\.)*\"");
            foreach (var path in Directory.GetFiles("Assets/Scripts", "*.cs", SearchOption.AllDirectories))
            {
                foreach (Match m in literal.Matches(File.ReadAllText(path, Encoding.UTF8)))
                {
                    foreach (char c in m.Value)
                    {
                        if (c > 0x7E) set.Add(c);
                    }
                }
            }

            if (File.Exists(ExtraChars))
            {
                foreach (char c in File.ReadAllText(ExtraChars, Encoding.UTF8))
                {
                    if (!char.IsWhiteSpace(c) || c == ' ') set.Add(c);
                }
            }

            return new string(set.ToArray());
        }

        /// <summary>TMP 의 기본 폰트로 세운다 — 코드가 지정하지 않은 텍스트도 한글이 나오게.</summary>
        private static void SetAsDefault(TMP_FontAsset asset)
        {
            var settings = Resources.Load<TMP_Settings>("TMP Settings");
            if (settings == null) return;
            var so = new SerializedObject(settings);
            so.FindProperty("m_defaultFontAsset").objectReferenceValue = asset;
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(settings);
        }
    }
}
