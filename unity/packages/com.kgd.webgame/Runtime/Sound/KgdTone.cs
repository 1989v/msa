using UnityEngine;

namespace Kgd.Sound
{
    /// <summary>
    /// 소리를 **파형으로 만든다.** 오디오 파일을 넣지 않는 이유는 전송량이다 —
    /// 게임 하나 상한이 15MB 인 곳에서 wav 몇 개가 수 MB 를 먹는다.
    ///
    /// 만드는 것은 짧은 것뿐이다(0.1~1.5초). 배경음처럼 긴 것은 파형으로 만들면
    /// 메모리를 그만큼 쓰므로, 필요해지면 그때 스트리밍을 붙인다.
    /// </summary>
    public static class KgdTone
    {
        public const int Rate = 22050;   // 효과음에 44.1k 는 과하다. 절반이면 절반 값이다

        /// <summary>사인 두 개를 겹친 「띵」. 종·주움처럼 맑은 것에 쓴다.</summary>
        public static AudioClip Bell(string name, float hz, float seconds, float decay = 5f)
        {
            return Make(name, seconds, (t, u) =>
            {
                float env = Mathf.Exp(-decay * u);
                return env * (Mathf.Sin(2f * Mathf.PI * hz * t) * 0.6f
                            + Mathf.Sin(2f * Mathf.PI * hz * 2.76f * t) * 0.25f);
            });
        }

        /// <summary>잡음을 깎아 만든 「퍽」. 타격·착지에 쓴다.</summary>
        public static AudioClip Thud(string name, float seconds, float low = 90f, float decay = 22f)
        {
            var rng = new System.Random(name.GetHashCode());
            return Make(name, seconds, (t, u) =>
            {
                float env = Mathf.Exp(-decay * u);
                float noise = (float)(rng.NextDouble() * 2.0 - 1.0);
                return env * (noise * 0.45f + Mathf.Sin(2f * Mathf.PI * low * t) * 0.55f);
            });
        }

        /// <summary>위로 훑는 소리. 계단을 올랐다·메달을 얻었다 같은 「좋아진 것」에 쓴다.</summary>
        public static AudioClip Rise(string name, float from, float to, float seconds)
        {
            return Make(name, seconds, (t, u) =>
            {
                float hz = Mathf.Lerp(from, to, u);
                float env = Mathf.Sin(u * Mathf.PI);   // 여닫이 — 뚝 끊기면 딸깍 소리가 난다
                return env * Mathf.Sin(2f * Mathf.PI * hz * t) * 0.5f;
            });
        }

        /// <summary>바람. 활공처럼 이어지는 것에 쓴다 — 반복 재생을 전제로 만든다.</summary>
        public static AudioClip Wind(string name, float seconds)
        {
            var rng = new System.Random(name.GetHashCode());
            float last = 0f;
            return Make(name, seconds, (t, u) =>
            {
                float noise = (float)(rng.NextDouble() * 2.0 - 1.0);
                last = Mathf.Lerp(last, noise, 0.06f);   // 저역만 남긴다
                // 시작과 끝을 맞춰 이어 붙였을 때 딸깍하지 않게 한다
                float seam = Mathf.Min(1f, Mathf.Min(u, 1f - u) * 12f);
                return last * 0.5f * seam;
            });
        }

        private static AudioClip Make(string name, float seconds, System.Func<float, float, float> wave)
        {
            int count = Mathf.Max(1, Mathf.RoundToInt(Rate * seconds));
            var data = new float[count];
            for (int i = 0; i < count; i++)
            {
                float t = i / (float)Rate;
                data[i] = Mathf.Clamp(wave(t, i / (float)count), -1f, 1f);
            }
            var clip = AudioClip.Create(name, count, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
