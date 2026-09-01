using Kgd.Motion;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 3인칭 궤도 카메라.
    ///
    /// **고도가 게임의 축이면 올려다보기·내려다보기가 넓어야 한다** — 피치 상한을 좁히면
    /// 정상도 낭떠러지도 화면에 안 들어온다.
    ///
    /// 지형을 두 번 피한다: 아래로는 바닥에 눕지 않게 들고, 뒤로는 벽을 뚫지 않게 당긴다.
    /// 둘 다 실기에서 화면이 통째로 막히고 나서 넣은 것이다.
    /// </summary>
    public sealed class KgdOrbitCam
    {
        public float MinPitch = -32f, MaxPitch = 62f;
        public float Near = 7f, Far = 15f;

        public float Yaw { get; private set; }
        public float Pitch { get; private set; } = 16f;

        /// <summary>타격 흔들림. 게임이 <see cref="Feel.KgdImpact"/> 에서 받아 넣는다.</summary>
        public Vector3 Shake { get; set; }

        private readonly Transform _tr;
        private readonly IKgdGround _ground;
        private readonly KgdLook _look = new();
        private Vector3 _focus;
        private float _dist;

        /// <summary>시점을 돌릴 수 있는 화면 구역의 아래 경계. 가상패드 위에서만 잡는다.</summary>
        public float LookZone = 0.40f;

        public KgdOrbitCam(Camera camera, IKgdGround ground, Vector3 focus, float yaw = 0f)
        {
            _tr = camera.transform;
            _ground = ground;
            _focus = focus;
            Yaw = yaw;
            _dist = Far;
        }

        public void Tick(float dt, Vector3 target, float eyeHeight, bool close)
        {
            // 키보드
            float kx = 0f, ky = 0f;
            if (Input.GetKey(KeyCode.LeftArrow)) kx -= 1f;
            if (Input.GetKey(KeyCode.RightArrow)) kx += 1f;
            if (Input.GetKey(KeyCode.UpArrow)) ky += 1f;
            if (Input.GetKey(KeyCode.DownArrow)) ky -= 1f;
            Yaw += kx * 130f * dt;
            Pitch = Mathf.Clamp(Pitch - ky * 90f * dt, MinPitch, MaxPitch);

            // 손가락을 붙들고 끈다 — 스틱을 잡은 손가락과 갈리지 않으면 걸을 때 화면이 돈다
            _look.Tick(LookZone);
            Yaw += _look.Delta.x * 0.16f;
            Pitch = Mathf.Clamp(Pitch - _look.Delta.y * 0.12f, MinPitch, MaxPitch);

            _dist = Mathf.Lerp(_dist, close ? Near : Far, 1f - Mathf.Exp(-4f * dt));
            _focus = Vector3.Lerp(_focus, target + Vector3.up * eyeHeight, 1f - Mathf.Exp(-9f * dt));

            var rot = Quaternion.Euler(Pitch, Yaw, 0f);
            var back = -(rot * Vector3.forward);

            // 지형을 뚫고 들어가지 않게 당겨온다
            float reach = _dist;
            for (float d = 1.6f; d <= _dist; d += 1.2f)
            {
                var probe = _focus + back * d;
                if (_ground.HeightAt(probe) > probe.y - 0.5f) { reach = Mathf.Max(2.4f, d - 1.2f); break; }
            }
            var at = _focus + back * reach;

            // 바닥 아래로 내려가지 않는다 — 올려다보면 카메라가 뒤·아래로 밀린다
            float floor = _ground.HeightAt(at) + 1.1f;
            if (at.y < floor)
            {
                at.y = floor;
                _tr.position = at + Shake;
                _tr.rotation = Quaternion.LookRotation((_focus - at).normalized, Vector3.up);
                return;
            }
            _tr.position = at + Shake;
            _tr.rotation = rot;
        }
    }
}
