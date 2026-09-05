using System.Globalization;
using System.Text;

namespace Kgd
{
    /// <summary>
    /// 릴레이 메시지용 초소형 JSON 리더. **평면 객체의 숫자·문자열·배열만** 읽는다 —
    /// 프로토콜(ADR-0088)이 그 이상을 안 쓰고, 20Hz 로 오는 것이라 파서가 얇아야 한다.
    ///
    /// <see cref="KgdRelay"/> 가 통로만 알고 스키마는 게임이 아는 구조라, 스키마를 읽는 도구는
    /// 게임마다 필요하다 — 그래서 여기 둔다. (「마지막 한 사람」이 같은 것을 자기 안에 갖고
    /// 있는데, 그건 이걸 만들기 전이다. 그 게임을 고치는 것은 이 작업의 범위가 아니라 그대로 뒀다.)
    /// </summary>
    public readonly struct KgdJson
    {
        private readonly string _s;

        public KgdJson(string s) { _s = s ?? ""; }

        public bool Ok => _s.Length > 1;

        public float Num(string key, float fallback)
        {
            int i = KeyIndex(key);
            if (i < 0) return fallback;
            int end = i;
            while (end < _s.Length &&
                   (char.IsDigit(_s[end]) || _s[end] == '-' || _s[end] == '.' ||
                    _s[end] == 'e' || _s[end] == 'E' || _s[end] == '+')) end++;
            return float.TryParse(_s.Substring(i, end - i), NumberStyles.Float,
                                  CultureInfo.InvariantCulture, out float v)
                ? v : fallback;
        }

        public string Str(string key)
        {
            int i = KeyIndex(key);
            if (i < 0 || i >= _s.Length || _s[i] != '"') return "";
            int end = i + 1;
            var sb = new StringBuilder();
            while (end < _s.Length && _s[end] != '"')
            {
                if (_s[end] == '\\' && end + 1 < _s.Length) end++;
                sb.Append(_s[end]);
                end++;
            }
            return sb.ToString();
        }

        /// <summary>문자열 배열. 릴레이 start 의 players 가 이 꼴이다.</summary>
        public string[] StrArray(string key)
        {
            int i = KeyIndex(key);
            if (i < 0 || i >= _s.Length || _s[i] != '[') return new string[0];
            int end = _s.IndexOf(']', i);
            if (end < 0) return new string[0];
            string inner = _s.Substring(i + 1, end - i - 1);
            if (inner.Trim().Length == 0) return new string[0];
            var parts = inner.Split(',');
            for (int n = 0; n < parts.Length; n++)
            {
                string p = parts[n].Trim();
                parts[n] = p.Length >= 2 && p[0] == '"' ? p.Substring(1, p.Length - 2) : p;
            }
            return parts;
        }

        /// <summary>중첩 객체(d 등)를 그대로 잘라 돌려준다 — 안쪽은 다시 읽는다.</summary>
        public KgdJson Obj(string key)
        {
            int i = KeyIndex(key);
            if (i < 0 || i >= _s.Length || _s[i] != '{') return new KgdJson("");
            int depth = 0;
            for (int end = i; end < _s.Length; end++)
            {
                if (_s[end] == '{') depth++;
                else if (_s[end] == '}' && --depth == 0)
                    return new KgdJson(_s.Substring(i, end - i + 1));
            }
            return new KgdJson("");
        }

        /// <summary>`"key":` 바로 뒤 값의 시작 위치. 없으면 -1.</summary>
        private int KeyIndex(string key)
        {
            // 최상위 키만 찾는다 — 중첩 객체 안의 같은 이름 키를 집으면 안 된다
            string needle = "\"" + key + "\":";
            int depth = 0;
            bool inStr = false;
            for (int i = 0; i < _s.Length; i++)
            {
                char c = _s[i];
                if (inStr)
                {
                    if (c == '\\') i++;
                    else if (c == '"') inStr = false;
                    continue;
                }
                if (c == '{' || c == '[') { depth++; continue; }
                if (c == '}' || c == ']') { depth--; continue; }
                if (c == '"')
                {
                    if (depth == 1 && i + needle.Length <= _s.Length &&
                        string.CompareOrdinal(_s, i, needle, 0, needle.Length) == 0)
                    {
                        int at = i + needle.Length;
                        while (at < _s.Length && _s[at] == ' ') at++;
                        return at;
                    }
                    inStr = true;
                }
            }
            return -1;
        }
    }
}
