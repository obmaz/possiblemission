# GEMINI / Antigravity 전용 설정

@[agent.md](./agent.md)

## Antigravity / Gemini 환경 규칙
- 워크스페이스 스킬은 `.agents/skills/` 경로를 사용합니다.
- 틀린그림찾기 신규 이미지 스테이지 제작 시 `spot-difference-stage` 스킬(`.agents/skills/spot-difference-stage/SKILL.md`)을 먼저 읽고, `image-generator` 서브에이전트(또는 이미지 생성 모델)를 사용할 수 있을 때만 진행합니다.
- 이미지 생성 도구가 비활성 상태라면 임의 도형/기존 이미지로 대체하지 말고 즉시 불가 사유를 안내합니다.
- 응답과 문서는 한국어로 작성하며, 마크다운 글머리 기호는 `- ` 단일 하이픈을 사용하고 헤더 바로 아래 빈 줄을 두지 않습니다.
