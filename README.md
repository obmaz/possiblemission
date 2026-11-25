# POSSIBLE MISSION (가능미션) — 네온 워크샵 미니게임 아케이드

5~100명 규모의 회사 워크샵, 팀 빌딩, 온보딩 행사에서 **로그인·설치 없이 링크 하나로 즉시 다 함께 즐길 수 있는 정적 웹 미니게임 아케이드**입니다.

---

## 주요 특징

- **제로 백엔드 · 100% 정적 웹 (GitHub Pages 즉시 배포)**: 빌드 과정 없는 순수 HTML5 / CSS3 / ES Modules (`./` 상대 경로 기반).
- **룸 시드(Room Seed) 동기화**: 진행자(MC)가 시드 코드(예: `MISSION-1`) 또는 공유 링크(`?seed=...&game=...`)를 전파하면, 5~100명이 모두 **동일한 문제·카드 배치·숫자/알파벳 시퀀스**로 공정하게 경쟁할 수 있습니다.
- **Slack / 카카오톡 원클릭 결과 공유**: 클리어 직후 S/A/B/C 랭크, 클리어 타임, 정확도, 시드 정보가 담긴 이모지 스코어카드를 1초 만에 복사합니다.
- **내장 Web Audio 신디사이저 + 모바일 최적화**: 별도 오디오 파일 없이 경쾌한 아케이드 효과음을 실시간 합성하며, 모바일(360px+)과 데스크톱(1440px+) 모두에 대응합니다.

---

## 4대 미니게임 라인업

1. **숨은그림찾기 (`HIDDEN MISSION`)** — `js/games/hidden-object.js`
   - 커스텀 일러스트 배경 2종(크리에이티브 오피스 대소동 / 궤도 천문대 라운지) 속에 숨겨진 벡터 소품 7개(Normal) 또는 10개(Hard)를 찾는 게임. 돋보기 루페, 줌/팬, 2회 무료 힌트 제공.
2. **틀린그림찾기 (`SPOT THE GLITCH`)** — `js/games/spot-difference.js`
   - 좌/우 동기화된 듀얼 `<canvas>`(보드게임 디저트 카페 / 황혼의 모험 캠프)에서 시드별로 선택된 6개(Normal) 또는 8개(Hard)의 차이점을 찾는 게임.
3. **네온 메모리 매치 (`NEON MEMORY`)** — `js/games/memory-match.js`
   - `4x3`(6쌍), `4x4`(8쌍), `6x4`(12쌍) 3가지 템포, 2초 프리뷰 플래시, 3D 카드 플립, 연속 매칭 콤보 배율 지원.
4. **절망요새 숨바꼭질 (`DESPAIR FORTRESS`)** — `js/games/despair-fortress.js`
   - 후지큐 하이랜드 절망요새 모티브! 화면에 떠다니는 **알파벳-숫자 노드**를 기억한 뒤, **숫자가 사라지고 알파벳만 남은 상태**에서 시스템이 요구하는 **숫자 3개**에 해당하는 알파벳 3개를 순서대로 입력해 보안 섹터를 돌파하는 서바이벌 게임.

---

## 로컬 실행 방법

ES Modules를 사용하므로 `file://` 직접 열기 대신 정적 서버로 실행해야 합니다.

```bash
python3 -m http.server 8080
# 브라우저에서 http://127.0.0.1:8080 접속
```

---

## GitHub Pages 배포 설정 방법

1. GitHub 저장소(`https://github.com/obmaz/possiblemission`) 페이지로 이동합니다.
2. 상단 탭 **Settings** → 좌측 메뉴 **Pages**를 클릭합니다.
3. **Build and deployment** 영역에서:
   - **Source**: `Deploy from a branch` 선택
   - **Branch**: `main` / `/ (root)` 선택 후 **Save** 클릭
4. 약 1~2분 후 `https://obmaz.github.io/possiblemission/` 에서 바로 플레이할 수 있습니다. (루트에 `.nojekyll` 파일이 포함되어 있어 그대로 정적 서빙됩니다.)

---

## 이어서 개발하기

후속 에이전트 및 개발자를 위한 상세 컨셉·아키텍처·현재 검독 현황·다음 할 일은 [`HANDOFF.md`](./HANDOFF.md)와 [`DESIGN_SPEC.md`](./DESIGN_SPEC.md)를 참고하세요.
