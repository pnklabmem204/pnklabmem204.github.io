> **Header Metadata**  
> - **Created At**: 2026-08-14 10:07:00  
> - **Author Agent**: Gemini 3.7 Flash  
> - **Document Version**: v3.0  
> - **Updated At**: 2026-08-20 12:07:00  

# Master AI Agent Rules

> **Scope**: `C:\Users\User\00_WorkSpace\02.Sprint\00.2026\JSB-DevTest` (2026 개발 프로젝트 통합 워크스페이스)  
> **Status**: Single Source of Truth for all AI Agent runtimes (Antigravity, Gemini CLI, Claude Code, Cursor, Codex).

---

## 1. Workspace Directory & Isolation Policy

1. **No Root `docs/` Directory**: 절대 프로젝트 루트에 중앙 `docs/` 디렉터리를 생성하지 않는다.
2. **Sub-Project Isolation (`NN_{folder_name}/`)**: 
   - 모든 소스 코드, 문서, 데이터, 스크립트는 해당 번호의 서브 프로젝트 디렉터리(예: `01_MultiAgent-Build-Test/`, `05_smart-hanger/` 등) 내부에만 생성하고 관리한다.
   - 새 프로젝트 생성 시 2자리 숫자 접두사 네이밍 규칙(`NN_{project_name}`)을 준수한다.
3. **Clean Root Policy**: 루트 디렉터리에는 공통 설정 파일(`AGENTS.md`, `README.md`, `.gitignore`, `.vscode/`) 외에 임의의 파일이나 폴더를 직접 생성하지 않는다.
4. **Root Index Sync**: 서브 프로젝트의 추가/삭제나 주요 스택/역할 변경 시, 루트 [`README.md`](file:///C:/Users/User/00_WorkSpace/02.Sprint/00.2026/JSB-DevTest/README.md)의 프로젝트 인덱스 표를 반드시 함께 갱신한다.

---

## 2. Mandatory Document Header Metadata Policy

워크스페이스 내 모든 마크다운(`.md`) 및 HTML(`.html`) 문서(서브 프로젝트 하위 문서 포함)는 **파일 최상단(Line 1)**에 아래 표준 메타데이터 블록을 반드시 포함해야 한다.

### Metadata Block Specification

```markdown
> **Header Metadata**  
> - **Created At**: <YYYY-MM-DD HH:mm:ss>  
> - **Author Agent**: <Agent Model / Name>  
> - **Document Version**: v<Integer>  
> - **Updated At**: <YYYY-MM-DD HH:mm:ss>  
```

### Strict Formatting Rules (Anti-Hallucination)
- **`Created At`**: 문서 최초 생성 일시. 문서를 수정하더라도 이 값은 절대 변경하지 않는다.
- **`Author Agent`**: 현재 작업을 수행하는 에이전트/모델명 (예: `Gemini 3.7 Flash`, `Claude 3.5 Sonnet`, `Codex`).
- **`Document Version`**: 최초 생성 시 반드시 `v1.0`으로 시작하며, 수정할 때마다 정수 1씩 증가시킨다 (`v1.0` ➔ `v2.0` ➔ `v3.0`, 소수점 증분 금지).
- **`Updated At`**: 문서의 가장 최근 수정 일시 (`YYYY-MM-DD HH:mm:ss`).

---

## 3. Sub-Project Documentation Standard

1. **Sub-Project `README.md`**: 각 `NN_{folder_name}/` 폴더는 자체 아키텍처, 셋업, 실행 방법을 설명하는 독립적인 `README.md`를 유지한다.
2. **Internal Docs**: 서브 프로젝트별 추가 도면, 배선도, 세부 설계 문서는 해당 서브 프로젝트 내부(예: `05_smart-hanger/배선.md`, `05_smart-hanger/docs/`)에 독립적으로 보관한다.

---

## 4. Git Auto-Commit on File Mutation Policy (All Agents)

모든 AI Agent(Antigravity, Codex, Cursor, Claude Code 등)는 파일 변경 작업 시 아래 규칙을 반드시 준수한다.

1. **Trigger Condition**:
   - 해당 턴(Turn/Prompt) 내에서 파일 생성, 수정, 삭제(`write_to_file`, `replace_file_content` 등)가 발생한 경우에만 실행한다.
   - 단순 질의응답, 파일 읽기, 상태 확인 등 파일 변경이 전혀 없는 경우에는 커밋을 실행하지 않는다.
2. **Execution Timing**:
   - 모든 파일 작업이 정상적으로 완료된 후, 사용자에게 최종 텍스트 응답을 반환하기 직전에 CLI 명령(`git add` 및 `git commit`)을 실행한다.
3. **Commit Message Specification**:
   - 별도의 추가 추론이나 토큰 낭비 없이, 수행한 작업 요약 1줄과 관련 컨텍스트를 간결하게 조합하여 작성한다.
   - **Format**:
     ```text
     <type>(<scope/project>): <작업 요약 1줄>

     - Task: <사용자 요청 핵심 의도>
     - Agent: <에이전트 모델명>
     ```
   - **Type Conventions**: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`
