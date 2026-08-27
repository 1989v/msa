namespace Kgd
{
    /// <summary>
    /// 랭킹·플랫폼 신호. 게임 안에 닉네임 입력이나 순위표를 만들지 않는다 —
    /// lib/rank.js 가 이미 하고, 둘 다 만들면 이중 입력이 된다.
    /// </summary>
    public static class KgdPlatform
    {
        /// <summary>
        /// 런 종료. 점수는 정수, detail 은 사람이 읽는 한 줄 문자열(예: "12웨이브 · 궁수 7명").
        /// board 는 모드를 나눈 게임만 채운다 — 카탈로그 시드의 score_boards 키와 같아야 한다.
        /// </summary>
        public static void SubmitScore(int score, string detail = null, string board = null)
            => KgdBridge.SubmitScore(score, detail, board);

        /// <summary>
        /// 전체 화면 메뉴를 열고 닫을 때 부른다. 이걸 안 부르면 메뉴 위에 가상패드가 그대로 떠서
        /// 버튼이 겹치고, 눌러도 아무 일이 없는 상태가 된다.
        /// </summary>
        public static void SetMenuOpen(bool open) => KgdBridge.SetMenuOpen(open);

        /// <summary>첫 프레임이 실제로 그려졌다는 신호. 템플릿의 로딩 화면이 이걸 보고 사라진다.</summary>
        public static void SignalReady() => KgdBridge.Ready();
    }
}
