using System.Collections.Generic;
using UnityEngine;

namespace Kgd.Feel
{
    /// <summary>
    /// 맞은 개체를 잠깐 번쩍이게 한다.
    ///
    /// **머티리얼을 직접 건드리면 안 된다.** 이 플랫폼의 게임들은 드로우콜을 아끼려고
    /// 킷 하나에 머티리얼 **한 장**을 공유한다 — 하나를 물들이면 같은 킷의 전부가 물든다.
    /// 그래서 <see cref="MaterialPropertyBlock"/> 으로 그 렌더러에만 얹는다.
    /// </summary>
    public sealed class KgdFlash
    {
        private readonly List<Renderer> _renderers = new();
        private readonly MaterialPropertyBlock _block = new();
        private readonly int _property;
        private readonly Color _base;
        private Color _color;
        private float _left, _span;

        /// <param name="property">색을 곱하는 셰이더 속성. 이 패키지의 셰이더는 `_Tint` 다.</param>
        /// <param name="baseColor">평소 색. 번쩍임이 끝나면 여기로 돌아간다.</param>
        public KgdFlash(GameObject target, Color baseColor, string property = "_Tint")
        {
            target.GetComponentsInChildren(true, _renderers);
            _property = Shader.PropertyToID(property);
            _base = baseColor;
        }

        public void Flash(Color color, float seconds)
        {
            _color = color;
            _span = Mathf.Max(0.01f, seconds);
            _left = _span;
        }

        public void Tick(float dt)
        {
            if (_left <= 0f) return;
            _left -= dt;
            float k = Mathf.Clamp01(_left / _span);
            var c = Color.Lerp(_base, _color, k);
            _block.SetColor(_property, c);
            foreach (var r in _renderers) if (r != null) r.SetPropertyBlock(_block);
            if (_left <= 0f)
            {
                _block.SetColor(_property, _base);
                foreach (var r in _renderers) if (r != null) r.SetPropertyBlock(_block);
            }
        }
    }
}
