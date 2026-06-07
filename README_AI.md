# GitHub Contribution AI Analysis Pipeline

> **API 키 사용 안내**  
> Gemini API 키는 **공유**해 드립니다. **과도한 사용은 삼가** 주세요.  
> - 담당 프로젝트·필요한 실행만 진행 (테스트는 `--no-post` 권장)
> - API 키를 외부에 재공유하거나 코드/저장소에 커밋 X  
>  
> 대규모 프로젝트(사용자 50명+)는 Gemini 호출이 많아 **10~20분** 걸리며, 할당량·비용에 영향을 줍니다.

백엔드에서 수집한 GitHub 데이터를 받아 **정량·협업·정적 점수**를 계산하고, **Gemini 요약**과 **협업 네트워크(`collab_network`)** 를 생성한 뒤 백엔드 `ai-analysis` API로 저장하는 파이프라인.

## 파이프라인 흐름

```
[1/3] GET  /api/projects/{id}/contributions  →  data.json
[2/3] 분석 엔진 (점수, collab NLP, Gemini 사용자/커밋 요약)
[3/3] 결과 파일 저장 + POST /api/projects/{id}/ai-analysis
```

## 필요 조건

- **Python 3.10+** (3.11~3.13 권장)
- 인터넷 연결
  - 백엔드 API 접속
  - HuggingFace에서 임베딩 모델 다운로드 (`BAAI/bge-m3`, 최초 1회)
  - Gemini API 호출
- **Gemini API 키** — 별도 발급 불필요. 
- 백엔드 서버 접근 가능 (기본: `http://3.39.190.222:5000`)

## 설치

```powershell
# 저장소(또는 ZIP)를 받은 뒤 프로젝트 폴더로 이동
cd capstone2

# 가상환경 (권장)
python -m venv .venv
.venv\Scripts\Activate.ps1

# 의존성 설치
pip install -r requirements.txt
```

macOS / Linux:

```bash
cd capstone2
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `GEMINI_API_KEY` | **권장** | — | 팀 공유 Gemini 키 과도한 호출 자제 |
| `AI_ANALYSIS_API_BASE` | 아니오 | `http://3.39.190.222:5000` | 백엔드 API 베이스 URL |
| `PROJECT_ID` | 아니오 | — | `--project-id` 대신 사용 가능 |
| `POST_AI_ANALYSIS` | 아니오 | `1` | `0`이면 POST 생략 (`--no-post`와 유사) |
| `GEMINI_MODEL` | 아니오 | `gemini-2.5-flash` | Gemini 모델 이름 |
| `GEMINI_PR_ISSUE_CHUNK` | 아니오 | `8` | PR/Issue 요약 배치 크기 |
| `GEMINI_MAX_COMMITS_PER_USER` | 아니오 | `80` | 사용자당 Gemini에 넣을 최대 커밋 수 |
| `HF_TOKEN` | 아니오 | — | HuggingFace 토큰 (모델 다운로드 속도·할당량 개선) |

Windows PowerShell 예시:

```powershell
$env:GEMINI_API_KEY = "담당자에게_받은_키"
$env:AI_ANALYSIS_API_BASE = "http://3.39.190.222:5000"
```

## 실행 방법

### 전체 파이프라인 (수집 → 분석 → POST)

```powershell
python main.py --project-id 1
python main.py -p 2
```

환경 변수로 프로젝트 ID 지정:

```powershell
$env:PROJECT_ID = "1"
python main.py
```

### POST 없이 로컬 결과만 생성

```powershell
python main.py --project-id 2 --no-post
```

### 기존 `data.json`만으로 분석 (API 수집 생략)

```powershell
python main.py --local
```

### payload만 재생성 (전체 분석·Gemini 생략)

`data.json`과 `analysis_result.csv`가 이미 있을 때:

```powershell
python main.py --project-id 1 --rebuild-payload-only
```

## CLI 옵션

| 옵션 | 설명 |
|------|------|
| `-p`, `--project-id N` | 프로젝트 ID (`/projects/N/`의 N) |
| `--local` | API 호출 없이 로컬 `data.json` 사용 |
| `--no-post` | 분석 후 백엔드 POST 생략 |
| `--rebuild-payload-only` | 점수 CSV + data.json으로 payload만 재생성 |

## 생성되는 파일

| 파일 | 설명 |
|------|------|
| `data.json` | contributions API 응답 (입력 캐시) |
| `analysis_result.csv` | 사용자별 상세 점수·피드백·Gemini 활동 요약 |
| `analysis_result.json` | 프론트엔드용 요약 payload |
| `analysis_result_gemini_commits.csv` | 커밋별 Gemini 한 줄 요약 |
| `ai_analysis_payload.json` | POST용 사용자 점수 + `collab_network` |
| `ai_analysis_pr_issue_summaries.json` | PR/Issue Gemini 요약 |

> 실행할 때마다 위 파일은 **같은 이름으로 덮어씌워집니다.**

## 프로젝트 구조

```
capstone2/
├── main.py                 # 실행 진입점
├── ai_engine.py            # 점수 계산, BGE 협업 NLP, Gemini 사용자/커밋 요약
├── ai_analysis_api.py      # collab_network, PR/Issue Gemini, 백엔드 POST
├── requirements.txt
├── README_AI.md
└── PROJECT_TECHNICAL_GUIDE.txt
```

실험·디버깅용 노트북(`analysis_test.ipynb` 등)은 파이프라인 실행에 **필수는 아닙니다.**

## 점수 요약

| 항목 | 설명 |
|------|------|
| `quant_score` | 커밋, PR, 이슈, 리뷰, LOC 등 정량 지표 (팀 내 상대 평가) |
| `collab_score` | BGE-M3 임베딩 + 루브릭 기반 협업 NLP 점수 |
| `static_score` | `backend_code_score`만 사용. 코드 활동 없거나 점수 null이면 **0점** |
| `final_score` | `0.2×quant + 0.6×collab + 0.2×static` (무활동 시 0) |

POST body의 `qualitative_score`는 `collab_score`와 동일합니다.

### Gemini 입력 범위 (요약용)

| 대상 | Gemini에 넣는 텍스트 |
|------|----------------------|
| 사용자 overall | 커밋 메시지 + PR/Issue **제목·본문** (댓글 제외) |
| 커밋별 요약 | 커밋 메시지만 |
| PR/Issue POST 요약 | 작성자 **제목·본문** (댓글·리뷰 제외) |

`collab_score`(BGE NLP)는 PR/Issue **댓글까지** 포함해 평가합니다. 요약과 점수의 입력 범위가 다릅니다.

## 백엔드 API

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/api/projects/{id}/contributions` | 기여 데이터 수집 |
| POST | `/api/projects/{id}/ai-analysis` | AI 분석 결과 저장 |

POST body는 로컬에서 `ai_analysis_payload.json`과 `ai_analysis_pr_issue_summaries.json`을 **하나로 합친 형태**입니다.

```json
{
  "users": [
    {
      "username": "example",
      "quantitative_score": 82.86,
      "qualitative_score": 29.0,
      "final_score": 56.89,
      "collab_network": [
        {
          "target_username": "teammate",
          "comment_count": 1,
          "review_count": 0,
          "issue_comment_count": 0,
          "weight": 1
        }
      ]
    }
  ],
  "pull_requests": [
    { "pr_number": 8, "title": "...", "pr_summary": "..." }
  ],
  "issues": [
    { "issue_number": 1, "title": "...", "issue_summary": "..." }
  ]
}
```

## 소요 시간 (참고)

| 규모 | 대략적 시간 |
|------|-------------|
| 소규모 (3~10명) | 1~3분 |
| 중규모 (50명+) | 10~20분 (Gemini 호출 수에 비례) |

첫 실행은 BGE-M3 모델 다운로드로 추가 시간이 걸릴 수 있습니다.

## 주의사항

- **POST는 백엔드 DB의 AI 분석 결과를 덮어씁니다.** 테스트 시 `--no-post` 사용을 권장합니다.
- Gemini API **할당량·요금**에 유의하세요. 대규모 프로젝트는 사용자 수만큼 API 호출이 발생합니다.
- `GEMINI_API_KEY`는 `.env`나 코드에 커밋하지 마세요.
- Gemini 응답 JSON 파싱 실패 시 `(Gemini: 응답 JSON 파싱 실패)`로 기록될 수 있습니다. 재실행으로 일부 해결됩니다.

## 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| `project_id 가 없고 data.json 도 없습니다` | `--project-id N` 지정 또는 `data.json` 준비 |
| HuggingFace 다운로드 느림 | `HF_TOKEN` 설정, 네트워크 확인 |
| Gemini 404 / quota | `GEMINI_MODEL=gemini-2.5-flash` 확인, API 키·할당량 확인 |
| POST 실패 | `AI_ANALYSIS_API_BASE` URL, 서버 상태, 방화벽 확인 |
| collab_network가 전부 0 | PR/Issue 댓글 데이터 부족 또는 팀원 간 상호작용 없음 (정상일 수 있음) |

## Git에 올릴 때 (권장)

소스만 커밋하고 실행 결과물은 제외하세요.

```
data.json
analysis_result*
ai_analysis_*
.venv/
__pycache__/
*.ipynb_checkpoints
.env
```

## 라이선스

팀/프로젝트 정책에 따릅니다.
