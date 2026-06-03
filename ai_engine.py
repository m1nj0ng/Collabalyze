import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler


os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# Gemini 한 줄 요약 (선택): 환경 변수 GEMINI_API_KEY 가 있을 때만 호출됩니다.
# Google AI Studio에서 API 키 발급 후 터미널에서 set GEMINI_API_KEY=... (Windows) 또는 export (Unix)
# 신규 API 키/프로젝트는 2.0-flash-lite 미제공(404)일 수 있음 → 2.5 Flash 사용. GEMINI_MODEL 로 덮어쓰기 가능.
GEMINI_MODEL_DEFAULT = "gemini-2.5-flash"
GEMINI_MAX_INPUT_CHARS = 12000
GEMINI_SUMMARY_MAX_CHARS = 220
# 사용자당 Gemini 1회: 커밋 목록에 넣을 한 줄 최대 길이·한 요청당 최대 커밋 수
GEMINI_COMMIT_LINE_IN_PROMPT = int(os.environ.get("GEMINI_COMMIT_LINE_IN_PROMPT", "500"))
GEMINI_MAX_COMMITS_PER_USER = int(os.environ.get("GEMINI_MAX_COMMITS_PER_USER", "80"))
# 커밋이 이 개수를 초과하면 청크 분할 요약(C), 이하이면 단일 요청
GEMINI_COMMIT_CHUNK_SIZE = int(os.environ.get("GEMINI_COMMIT_CHUNK_SIZE", "25"))
GEMINI_MAX_RETRIES = int(os.environ.get("GEMINI_MAX_RETRIES", "4"))
GEMINI_RETRY_BASE_SEC = float(os.environ.get("GEMINI_RETRY_BASE_SEC", "2.0"))
GEMINI_INTER_CHUNK_SLEEP_SEC = float(os.environ.get("GEMINI_INTER_CHUNK_SLEEP_SEC", "1.0"))
GEMINI_JSON_PARSE_RETRIES = int(os.environ.get("GEMINI_JSON_PARSE_RETRIES", "2"))

PRIMARY_EMBEDDING_MODEL = "BAAI/bge-m3"
FALLBACK_EMBEDDING_MODEL = "intfloat/multilingual-e5-large-instruct"

SCORE_CONFIG = {"w_quant": 0.2, "w_collab": 0.5, "w_static": 0.3}
COLLAB_CHANNEL_WEIGHTS = {"commit": 0.25, "pr": 0.45, "issue": 0.30}
# 정량 하위 지표 가중치 (합 = 1.0)
QUANT_COMPONENT_WEIGHTS = {
    "commits": 0.15,
    "pull_requests": 0.20,
    "issues": 0.15,
    "code_reviews": 0.20,
    "log1p_loc_added": 0.10,
    "log1p_loc_deleted": 0.10,
    "loc_per_commit": 0.10,
}
# 활동/텍스트/코드 데이터 없음 → 0점 (기본 70점 시스템 제거)
SCORE_NO_ACTIVITY = 0.0
MIN_N_RELATIVE = 5
MIN_N_ISOF = 8
COMPLEXITY_LOWER_IS_BETTER = True
# 하위 호환: 예전 이름 참조 방지
COLLAB_NEUTRAL_ALL_MISSING = SCORE_NO_ACTIVITY
STATIC_DEFAULT_SCORE = SCORE_NO_ACTIVITY

RUBRIC_COMMIT = re.compile(
    r"^(feat|fix|refactor|docs|chore|test|style|perf|build|ci)(\([^)]+\))?!?:",
    re.I,
)
LONG_KW_EN = [
    "architecture",
    "logic",
    "refactor",
    "optimization",
    "database",
    "why",
    "how",
    "rationale",
    "testing",
    "migration",
]
LONG_KW_KO = ["설계", "구조", "성능", "리팩터", "데이터베이스", "이유", "방법", "테스트", "마이그레이션"]

ANCHOR_POS = [
    "성능 최적화를 위해 캐싱 로직을 도입했습니다. 주요 변경사항과 테스트 계획은 다음과 같습니다.",
    "Introduce caching to reduce latency; rationale, risks, and test plan are described below.",
]
ANCHOR_NEG = [
    "수정 완료. 그냥 업데이트함.",
    "wip fix update asap",
]


def rate_quant_column(series: pd.Series, min_n: int = MIN_N_RELATIVE) -> pd.Series:
    """정량 지표 점수: 0 활동은 0점, 소표본은 순위(percentile), 충분 시 MAD 상대평가."""
    s = pd.to_numeric(series, errors="coerce").fillna(0.0)
    out = pd.Series(SCORE_NO_ACTIVITY, index=s.index, dtype=float)
    positive = s > 0
    if not positive.any():
        return out
    n = len(s)
    if n < min_n:
        ranks = s.rank(method="average", pct=True) * 100.0
        out.loc[positive] = ranks.loc[positive]
        return out.clip(0, 100)
    med = s.median()
    mad = (s - med).abs().median()
    if mad == 0 or np.isnan(mad):
        ranks = s.rank(method="average", pct=True) * 100.0
        out.loc[positive] = ranks.loc[positive]
        return out.clip(0, 100)
    rz = 0.6745 * (s - med) / mad
    rated = (50.0 + rz * 15.0).clip(0, 100)
    out.loc[positive] = rated.loc[positive]
    return out


def quant_activity_count(row) -> int:
    return int(row.get("commits", 0) or 0) + int(row.get("pull_requests", 0) or 0) + int(
        row.get("issues", 0) or 0
    ) + int(row.get("code_reviews", 0) or 0)


def has_quant_activity(row) -> bool:
    return quant_activity_count(row) > 0 or float(row.get("loc_added", 0) or 0) > 0


def compute_weighted_quant_score(df: pd.DataFrame, quant_cols: List[str]) -> pd.Series:
    """QUANT_COMPONENT_WEIGHTS 기반 가중 평균 quant_score."""
    weighted_sum = pd.Series(0.0, index=df.index, dtype=float)
    total_weight = 0.0
    for col in quant_cols:
        w = float(QUANT_COMPONENT_WEIGHTS.get(col, 0.0))
        if w <= 0:
            continue
        score_col = f"quant_{col}_score"
        if score_col not in df.columns:
            continue
        weighted_sum += pd.to_numeric(df[score_col], errors="coerce").fillna(0.0) * w
        total_weight += w
    if total_weight <= 0:
        return pd.Series(SCORE_NO_ACTIVITY, index=df.index, dtype=float)
    return (weighted_sum / total_weight).clip(0, 100)


def static_score_for_row(row) -> float:
    """코드 활동 없음 또는 backend 점수 없음 → 0."""
    commits = int(row.get("commits", 0) or 0)
    loc_added = float(row.get("loc_added", 0) or 0)
    if commits == 0 and loc_added == 0:
        return SCORE_NO_ACTIVITY
    backend = row.get("backend_score")
    if backend is None or (isinstance(backend, float) and np.isnan(backend)):
        return SCORE_NO_ACTIVITY
    try:
        return float(np.clip(float(backend), 0, 100))
    except (TypeError, ValueError):
        return SCORE_NO_ACTIVITY


def impute_median(series):
    m = pd.to_numeric(series, errors="coerce").median()
    if pd.isna(m):
        m = 0.0
    return pd.to_numeric(series, errors="coerce").fillna(m)


def flat_comment_texts(items):
    """PR/issue comments가 문자열 또는 {body|text} 객체인 경우 모두 문자열로 펼칩니다."""
    out = []
    for item in items or []:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            text = item.get("body") or item.get("text") or ""
            if str(text).strip():
                out.append(str(text).strip())
    return out


def effective_collab_weights(commit_avg, pr_avg, issue_avg, weights):
    vals = {"commit": commit_avg, "pr": pr_avg, "issue": issue_avg}
    used = [key for key, value in vals.items() if value is not None]
    denom = sum(weights[key] for key in used)
    if denom <= 0:
        return {key: 0.0 for key in weights}, used
    return {key: (weights[key] / denom if key in used else 0.0) for key in weights}, used


def blend_collab_channels(commit_avg, pr_avg, issue_avg, weights, neutral=SCORE_NO_ACTIVITY):
    eff_w, used = effective_collab_weights(commit_avg, pr_avg, issue_avg, weights)
    if not used:
        return float(neutral)
    vals = {"commit": commit_avg, "pr": pr_avg, "issue": issue_avg}
    return sum(float(vals[key]) * eff_w[key] for key in used)


def weighted_final(df, cfg):
    wq, wc, ws = cfg["w_quant"], cfg["w_collab"], cfg["w_static"]
    denom = wq + wc + ws
    return (df["quant_score"] * wq + df["collab_score"] * wc + df["static_score"] * ws) / denom


def validate_score_ranges(df, score_cols):
    for col in score_cols:
        valid = df[col].dropna()
        if not valid.between(0, 100).all():
            bad = df.loc[~df[col].between(0, 100) & df[col].notna(), ["name", col]]
            raise ValueError(f"{col} 점수가 0~100 범위를 벗어났습니다.\n{bad}")


def collect_activity_text_bundle(row) -> str:
    """커밋/PR/이슈 텍스트를 한 덩어리로 모읍니다 (Gemini 입력용)."""
    nlp = row["raw_user_data"].get("2_nlp_data", {})
    parts = []

    if nlp.get("commits"):
        for c in nlp["commits"]:
            if isinstance(c, dict) and c.get("message"):
                parts.append(f"[커밋] {c['message']}")
    elif nlp.get("commit_messages"):
        for m in nlp["commit_messages"]:
            if str(m).strip():
                parts.append(f"[커밋] {m}")

    for pr in nlp.get("pull_requests", []):
        t = (pr.get("title") or "").strip()
        b = (pr.get("body") or "").strip()
        if t or b:
            parts.append(f"[PR] {t} {b}".strip())
        for cm in flat_comment_texts(pr.get("comments")):
            parts.append(f"[PR 코멘트] {cm}")

    for issue in nlp.get("issues", []):
        t = (issue.get("title") or "").strip()
        b = (issue.get("body") or "").strip()
        if t or b:
            parts.append(f"[이슈] {t} {b}".strip())
        for cm in flat_comment_texts(issue.get("comments")):
            parts.append(f"[이슈 코멘트] {cm}")

    blob = "\n".join(parts).strip()
    if len(blob) > GEMINI_MAX_INPUT_CHARS:
        blob = blob[:GEMINI_MAX_INPUT_CHARS] + "\n...(이하 생략)"
    return blob


def list_ordered_commit_messages_from_row(row) -> List[str]:
    """커밋 메시지를 data.json 순서대로 반환합니다 (Gemini 커밋별 요약 idx 정렬용)."""
    nlp = row["raw_user_data"].get("2_nlp_data", {})
    out: List[str] = []
    if nlp.get("commits"):
        for c in nlp["commits"]:
            if isinstance(c, dict) and c.get("message"):
                m = str(c["message"]).strip()
                if m:
                    out.append(m)
    elif nlp.get("commit_messages"):
        for msg in nlp["commit_messages"]:
            if str(msg).strip():
                out.append(str(msg).strip())
    return out


def _gemini_format_error(exc: Exception, max_len: int = 280) -> str:
    msg = str(exc).replace("\r", " ").replace("\n", " ")
    if len(msg) > max_len:
        msg = msg[: max_len - 1] + "…"
    return f"(Gemini 오류: {msg})"


def _gemini_strip_code_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def normalize_outline_summary(text: str, *, max_len: int = GEMINI_SUMMARY_MAX_CHARS) -> str:
    """Gemini 요약을 개조식 한 줄(명사형)로 정규화합니다."""
    s = str(text or "").strip().replace("\n", " ").replace("\r", " ")
    s = " ".join(s.split())
    if not s or s.startswith("("):
        return s
    endings = (
        r"했습니다\.?$",
        r"합니다\.?$",
        r"였습니다\.?$",
        r"입니다\.?$",
        r"됩니다\.?$",
        r"있다\.?$",
        r"없다\.?$",
        r"있다$",
        r"없다$",
        r"했다\.?$",
        r"함\.?$",
        r"됨\.?$",
        r"임\.?$",
    )
    for _ in range(3):
        changed = False
        for pat in endings:
            new_s = re.sub(pat, "", s).strip()
            if new_s != s:
                s = new_s
                changed = True
        if not changed:
            break
    s = s.rstrip(".")
    if s and len(s) > max_len:
        s = s[: max_len - 1] + "…"
    return s


def _gemini_retry_delay_sec(exc_msg: str) -> Optional[float]:
    m = re.search(r"retry in ([\d.]+)\s*s", exc_msg, re.I)
    if m:
        return min(float(m.group(1)), 90.0)
    return None


def _gemini_response_text(resp) -> str:
    raw = ""
    try:
        raw = (resp.text or "").strip()
    except (ValueError, AttributeError):
        cand = getattr(resp, "candidates", None) or []
        if cand and getattr(cand[0], "content", None):
            parts = getattr(cand[0].content, "parts", None) or []
            raw = "".join(getattr(p, "text", "") or "" for p in parts).strip()
    return raw


def _gemini_generate_with_retries(client, model_name: str, prompt: str, max_out_tokens: int = 4096):
    """Google Gen AI SDK (`google-genai`) — 구형 `google-generativeai` 대체."""
    from google.genai import types

    last_exc = None
    for attempt in range(GEMINI_MAX_RETRIES):
        try:
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=max_out_tokens,
                ),
            )
        except Exception as exc:
            last_exc = exc
            msg = str(exc)
            if "429" not in msg and "RESOURCE_EXHAUSTED" not in msg and "quota" not in msg.lower():
                raise
            if attempt >= GEMINI_MAX_RETRIES - 1:
                raise
            wait = _gemini_retry_delay_sec(msg) or min(90.0, GEMINI_RETRY_BASE_SEC * (2**attempt))
            time.sleep(wait)
    raise last_exc  # pragma: no cover


def _gemini_parse_json_with_retries(
    client: Any,
    model_name: str,
    prompt: str,
    parser_fn: Any,
    *,
    max_out_tokens: int = 4096,
) -> Any:
    """Gemini 호출 후 JSON 파싱 실패 시 재프롬프트 재시도 (A)."""
    last_exc: Optional[BaseException] = None
    attempts = GEMINI_JSON_PARSE_RETRIES + 1
    for attempt in range(attempts):
        retry_prompt = prompt
        if attempt > 0:
            retry_prompt = (
                prompt
                + "\n\n[재시도] 반드시 유효한 JSON 객체 하나만 출력하세요. "
                "마크다운 코드펜스·설명 문장·주석 금지."
            )
        resp = _gemini_generate_with_retries(
            client, model_name, retry_prompt, max_out_tokens=max_out_tokens
        )
        raw = _gemini_response_text(resp)
        try:
            return parser_fn(raw)
        except (json.JSONDecodeError, ValueError, TypeError, KeyError) as exc:
            last_exc = exc
            if attempt < attempts - 1:
                time.sleep(min(2.0, GEMINI_RETRY_BASE_SEC * (attempt + 1)))
    if last_exc is not None:
        raise last_exc
    raise ValueError("Gemini JSON 파싱 실패")


def _gemini_extract_json_object(raw_text: str) -> dict:
    text = _gemini_strip_code_fence(raw_text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("JSON 객체를 찾지 못했습니다.")
    return json.loads(text[start : end + 1])


def _gemini_parse_overall_and_per_commit(raw_text: str, n_commits: int) -> Tuple[str, List[str]]:
    """모델 응답에서 overall 한 줄 + 커밋별 요약 리스트(길이 n_commits)를 추출합니다."""
    data = _gemini_extract_json_object(raw_text)
    if not isinstance(data, dict):
        raise ValueError("최상위 JSON은 객체여야 합니다.")

    overall = normalize_outline_summary(str(data.get("overall", "") or ""))

    per: List[str] = [""] * n_commits
    commits_payload = data.get("commits")
    if isinstance(commits_payload, list):
        for item in commits_payload:
            if not isinstance(item, dict):
                continue
            try:
                idx = int(item.get("idx", -1))
            except (TypeError, ValueError):
                continue
            if idx < 0 or idx >= n_commits:
                continue
            s = normalize_outline_summary(str(item.get("summary", "") or ""))
            if s:
                per[idx] = s

    if not overall and any(per):
        overall = per[0]
    return overall, per


def _format_commit_lines(commits: List[str]) -> str:
    lines = []
    for local_i, msg in enumerate(commits):
        line = str(msg).replace("\r", " ").replace("\n", " ")
        if len(line) > GEMINI_COMMIT_LINE_IN_PROMPT:
            line = line[: GEMINI_COMMIT_LINE_IN_PROMPT - 1] + "…"
        lines.append(f"[{local_i}] {line}")
    return "\n".join(lines) if lines else "(커밋 메시지 없음)"


def _gemini_parse_commits_only(raw_text: str, n_commits: int) -> List[str]:
    """청크 응답에서 커밋별 summary만 추출 (local idx 0..n-1)."""
    data = _gemini_extract_json_object(raw_text)
    if not isinstance(data, dict):
        raise ValueError("최상위 JSON은 객체여야 합니다.")
    per: List[str] = [""] * n_commits
    for item in data.get("commits") or []:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("idx", -1))
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= n_commits:
            continue
        s = normalize_outline_summary(str(item.get("summary", "") or ""))
        if s:
            per[idx] = s
    return per


def _fallback_commit_summary(message: str) -> str:
    line = str(message).replace("\r", " ").replace("\n", " ").strip()
    if not line:
        return "(커밋 메시지 없음)"
    return normalize_outline_summary(line[: GEMINI_SUMMARY_MAX_CHARS])


def _gemini_summarize_overall_only(client: Any, model_name: str, username: str, bundle: str) -> str:
    """전체 활동 맥락만으로 overall 한 줄 생성 (청크 분할 시 별도 호출)."""
    prompt = f"""당신은 소프트웨어 팀의 GitHub 활동을 요약하는 어시스턴트입니다.
대상 사용자: "{username}"

출력은 JSON 객체 하나만: {{"overall": "개조식 한 줄(명사형) 활동 요약"}}
규칙: PR/이슈/커밋 맥락을 반영한 전체 흐름. "~했습니다/~합니다/~했다" 종결형 금지. 추측 금지.
공백 포함 {GEMINI_SUMMARY_MAX_CHARS}자 이내.

--- 전체 활동 맥락 ---
{bundle if bundle.strip() else "(비어 있음)"}
--- 끝 ---"""

    def _parse(raw: str) -> str:
        data = _gemini_extract_json_object(raw)
        overall = normalize_outline_summary(str(data.get("overall", "") or ""))
        if not overall:
            raise ValueError("overall 비어 있음")
        return overall

    return _gemini_parse_json_with_retries(
        client, model_name, prompt, _parse, max_out_tokens=1024
    )


def _gemini_summarize_commits_chunked(
    client: Any,
    model_name: str,
    username: str,
    head: List[str],
) -> List[str]:
    """커밋 목록을 GEMINI_COMMIT_CHUNK_SIZE 단위로 분할 요약 후 merge."""
    per = [""] * len(head)
    chunk_size = max(1, GEMINI_COMMIT_CHUNK_SIZE)
    for start in range(0, len(head), chunk_size):
        if start > 0 and GEMINI_INTER_CHUNK_SLEEP_SEC > 0:
            time.sleep(GEMINI_INTER_CHUNK_SLEEP_SEC)
        chunk = head[start : start + chunk_size]
        commit_block = _format_commit_lines(chunk)
        n_local = len(chunk)
        prompt = f"""당신은 GitHub 커밋 메시지를 요약하는 어시스턴트입니다.
대상 사용자: "{username}"

출력은 JSON만: {{"commits": [{{"idx": 0, "summary": "개조식 한 줄"}}, ...]}}
규칙: 아래 목록의 local idx 0..{n_local - 1} 전부 포함. 각 summary 개조식 한 줄(명사형), {GEMINI_SUMMARY_MAX_CHARS}자 이내.
"~했습니다/~합니다/~했다" 종결형 금지. 추측 금지.

--- 요약 대상 커밋 목록 (local idx) ---
{commit_block}
--- 끝 ---"""
        max_out = min(8192, max(2048, 256 + 120 * n_local))
        try:
            part = _gemini_parse_json_with_retries(
                client,
                model_name,
                prompt,
                lambda raw, n=n_local: _gemini_parse_commits_only(raw, n),
                max_out_tokens=max_out,
            )
            for i, summ in enumerate(part):
                if summ:
                    per[start + i] = summ
                else:
                    per[start + i] = _fallback_commit_summary(chunk[i])
        except Exception:
            for i, msg in enumerate(chunk):
                per[start + i] = _fallback_commit_summary(msg)
    return per


def _gemini_summarize_user_combined(
    client: Any,
    model_name: str,
    username: str,
    bundle: str,
    head: List[str],
    overflow_note: str,
) -> Tuple[str, List[str]]:
    """커밋 수가 적을 때: overall + 커밋별 요약을 한 번에 요청."""
    commit_block = _format_commit_lines(head)
    prompt = f"""당신은 소프트웨어 팀의 GitHub 활동을 요약하는 어시스턴트입니다.
대상 사용자: "{username}"

출력은 JSON 객체 하나만:
{{"overall": "개조식 한 줄(명사형) 활동 요약", "commits": [{{"idx": 0, "summary": "해당 커밋 개조식 한 줄"}}, ...]}}

규칙:
1. commits 배열에 idx 0..{len(head) - 1} 전부 포함.
2. 각 summary 개조식 한 줄(명사형), {GEMINI_SUMMARY_MAX_CHARS}자 이내. "~했습니다/~합니다/~했다" 종결형 금지.
3. 텍스트에 근거, 추측 금지.

--- 전체 활동 맥락 ---
{bundle if bundle.strip() else "(비어 있음)"}
--- 끝 ---

--- 요약 대상 커밋 목록 ---
{overflow_note}{commit_block}
--- 끝 ---"""
    max_out = min(16384, max(2048, 256 + 120 * len(head)))
    return _gemini_parse_json_with_retries(
        client,
        model_name,
        prompt,
        lambda raw: _gemini_parse_overall_and_per_commit(raw, len(head)),
        max_out_tokens=max_out,
    )


def run_gemini_activity_summaries(df: pd.DataFrame) -> Tuple[List[str], List[Dict[str, Any]]]:
    """사용자별 Gemini 활동 요약.

    - 커밋 ≤ GEMINI_COMMIT_CHUNK_SIZE: overall+커밋 단일 요청
    - 커밋 >  청크 크기: 커밋 청크 분할 요약(C) + overall 별도 요청

    Returns:
        overall_summaries: 사용자별 전체 한 줄 요약 (기존 `gemini_activity_summary` 열)
        commit_detail_rows: `analysis_result_gemini_commits.csv`용 행 목록
            (name, commit_idx, commit_message, gemini_commit_summary)
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    n = len(df)
    overall_out: List[Optional[str]] = [None] * n
    detail_rows: List[Dict[str, Any]] = []

    if not api_key:
        ph = "(Gemini 미실행: 환경 변수 GEMINI_API_KEY 미설정)"
        return [ph] * n, detail_rows

    try:
        from google import genai as google_genai
    except ImportError:
        ph = "(Gemini 미실행: pip install google-genai 필요)"
        return [ph] * n, detail_rows

    model_name = os.environ.get("GEMINI_MODEL", GEMINI_MODEL_DEFAULT).strip() or GEMINI_MODEL_DEFAULT
    client = google_genai.Client(api_key=api_key)

    for ui, (_, row) in enumerate(df.iterrows()):
        if ui and GEMINI_INTER_CHUNK_SLEEP_SEC > 0:
            time.sleep(GEMINI_INTER_CHUNK_SLEEP_SEC)

        username = str(row.get("name", ""))
        bundle = collect_activity_text_bundle(row)
        commits_all = list_ordered_commit_messages_from_row(row)

        if not (bundle or "").strip() and not commits_all:
            overall_out[ui] = "(요약할 커밋/PR/이슈 텍스트 없음)"
            continue

        head = commits_all[:GEMINI_MAX_COMMITS_PER_USER]
        overflow_note = ""
        if len(commits_all) > GEMINI_MAX_COMMITS_PER_USER:
            overflow_note = (
                f"\n(참고: 커밋 총 {len(commits_all)}개, 요약 대상 {len(head)}개, "
                f"idx 0..{len(head) - 1})\n"
            )
        bundle_text = bundle if (bundle or "").strip() else ""

        try:
            if head and len(head) > GEMINI_COMMIT_CHUNK_SIZE:
                per_head = _gemini_summarize_commits_chunked(client, model_name, username, head)
                try:
                    overall = _gemini_summarize_overall_only(
                        client, model_name, username, bundle_text
                    )
                except Exception:
                    filled = [s for s in per_head if s]
                    overall = filled[0] if filled else "(Gemini: 전체 요약 비어 있음)"
            elif head:
                overall, per_head = _gemini_summarize_user_combined(
                    client, model_name, username, bundle_text, head, overflow_note
                )
                if not overall:
                    overall = "(Gemini: 전체 요약 비어 있음)"
            else:
                per_head = []
                overall = _gemini_summarize_overall_only(
                    client, model_name, username, bundle_text
                )
        except (json.JSONDecodeError, ValueError, TypeError, KeyError):
            overall = "(Gemini: 응답 JSON 파싱 실패)"
            per_head = [""] * len(head)
        except Exception as exc:
            err = _gemini_format_error(exc)
            overall_out[ui] = err
            for idx, msg in enumerate(commits_all):
                detail_rows.append(
                    {
                        "name": username,
                        "commit_idx": idx,
                        "commit_message": msg,
                        "gemini_commit_summary": err,
                    }
                )
            continue

        overall_out[ui] = overall

        for idx, msg in enumerate(commits_all):
            if idx < len(per_head):
                summ = per_head[idx] or "(Gemini: 해당 커밋 요약 누락)"
            else:
                summ = f"(요약 생략: 한 요청당 커밋 상한 {GEMINI_MAX_COMMITS_PER_USER}개 초과)"
            detail_rows.append(
                {
                    "name": username,
                    "commit_idx": idx,
                    "commit_message": msg,
                    "gemini_commit_summary": summ,
                }
            )

    return [x if x is not None else "(Gemini 응답 없음)" for x in overall_out], detail_rows


def gemini_one_line_summary(text: str, username: str) -> str:
    """단일 사용자·단일 텍스트 요약 (노트북 등). 엔진 기본 경로는 `run_gemini_activity_summaries`입니다."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return "(Gemini 미실행: 환경 변수 GEMINI_API_KEY 미설정)"
    if not text.strip():
        return "(요약할 커밋/PR/이슈 텍스트 없음)"

    try:
        from google import genai as google_genai
    except ImportError:
        return "(Gemini 미실행: pip install google-genai 필요)"

    model_name = os.environ.get("GEMINI_MODEL", GEMINI_MODEL_DEFAULT).strip() or GEMINI_MODEL_DEFAULT
    client = google_genai.Client(api_key=api_key)

    prompt = f"""당신은 소프트웨어 팀의 GitHub 활동을 요약하는 어시스턴트입니다.
아래 텍스트는 사용자 "{username}"의 커밋 메시지, PR, 이슈, 코멘트에서 추출한 내용입니다.

규칙:
1. 한국어 개조식 한 줄(명사형)만 출력하세요. (줄바꿈 금지, 따옴표 금지)
2. "~했습니다", "~합니다", "~했다" 같은 문장 종결형 금지.
3. 무엇을 주로 개발/수정했는지, 어떤 흐름인지가 드러나게 쓰세요.
4. 없는 내용은 추측하지 마세요. 텍스트에 근거해 요약하세요.
5. 길이는 공백 포함 {GEMINI_SUMMARY_MAX_CHARS}자 이내로 하세요.

--- 텍스트 시작 ---
{text}
--- 텍스트 끝 ---"""

    try:
        resp = _gemini_generate_with_retries(client, model_name, prompt, max_out_tokens=256)
        raw = _gemini_response_text(resp)
        out = normalize_outline_summary(raw)
        if not out:
            return "(Gemini 응답 없음)"
        return out
    except Exception as exc:
        return _gemini_format_error(exc)


def _json_safe(value: Any):
    if isinstance(value, dict):
        return {key: _json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(val) for val in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value):
            return None
        return float(value)
    if isinstance(value, float) and np.isnan(value):
        return None
    if pd.isna(value) and not isinstance(value, (str, bytes)):
        return None
    return value


class CollaborationEvaluator:
    def __init__(self, encode_fn, pos_vecs, neg_vecs):
        self.encode = encode_fn
        self.pos_vecs = pos_vecs
        self.neg_vecs = neg_vecs

    def _sim(self, msg):
        vec = self.encode(msg)
        pos_score = np.mean([float(np.dot(vec, pos_vec)) for pos_vec in self.pos_vecs])
        neg_score = np.mean([float(np.dot(vec, neg_vec)) for neg_vec in self.neg_vecs])
        return ((pos_score - neg_score + 1) / 2) * 100

    def eval_text(self, text, kind="commit"):
        score, feedback = 0.0, []
        text = str(text)
        lower_text = text.lower()

        if kind == "commit":
            if RUBRIC_COMMIT.match(lower_text.strip()):
                score += 40
            else:
                feedback.append("커밋 컨벤션을 준수하세요.")
            score += self._sim(text) * 0.6
        else:
            density = sum(1 for word in LONG_KW_EN if word in lower_text)
            density += sum(1 for word in LONG_KW_KO if word in text)
            if density >= 2:
                score += 40
            else:
                feedback.append("PR/Issue 본문에 상세 설명을 추가하세요.")
            score += self._sim(text) * 0.6

        return {"score": min(100.0, score), "feedback": feedback}


class GitHubInsightEngine:
    """data.json 구조를 분석해 점수표와 프론트 전달용 payload를 생성합니다."""

    def __init__(self, embedding_model_name=None, fallback_model_name=FALLBACK_EMBEDDING_MODEL):
        assert abs(sum(SCORE_CONFIG.values()) - 1.0) < 1e-9, "SCORE_CONFIG 합은 1이어야 합니다."
        assert abs(sum(COLLAB_CHANNEL_WEIGHTS.values()) - 1.0) < 1e-9, "COLLAB_CHANNEL_WEIGHTS 합은 1이어야 합니다."

        preferred = embedding_model_name or PRIMARY_EMBEDDING_MODEL
        self.model, self.embedding_model_name = self._load_sentence_model(preferred, fallback_model_name)
        self.embedding_dim = self._get_embedding_dim()
        self.pos_vecs = [self.encode_text(text) for text in ANCHOR_POS]
        self.neg_vecs = [self.encode_text(text) for text in ANCHOR_NEG]
        self.evaluator = CollaborationEvaluator(self.encode_text, self.pos_vecs, self.neg_vecs)
        print(f"[github-insight] 임베딩 모델 준비 완료: {self.embedding_model_name}", flush=True)

    def _load_sentence_model(self, preferred, fallback):
        last_error = None
        for name in (preferred, fallback):
            if not name:
                continue
            try:
                return SentenceTransformer(name, trust_remote_code=True), name
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"임베딩 모델 로드 실패: {last_error}")

    def _get_embedding_dim(self):
        try:
            return self.model.get_embedding_dimension()
        except Exception:
            return self.model.get_sentence_embedding_dimension()

    def encode_text(self, text):
        clean = re.sub(r"\[.*?\]", "", str(text or "")).strip()
        if not clean:
            return np.zeros(self.embedding_dim, dtype=np.float32)
        return self.model.encode(
            clean,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

    def analyze_file(self, file_path="data.json"):
        with open(file_path, "r", encoding="utf-8") as file:
            raw_json = json.load(file)
        result_df = self.analyze(raw_json)
        return result_df, self.build_frontend_payload(result_df)

    def analyze(self, raw_json):
        users = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else raw_json
        if not isinstance(users, list):
            raise ValueError("입력 데이터는 {'data': [...]} 또는 사용자 리스트 형식이어야 합니다.")

        rows = []
        for user in users:
            q = user.get("1_quantitative_data", {})
            s = user.get("3_static_code_analysis_data", {})
            rows.append(
                {
                    "name": user.get("username"),
                    "commits": q.get("commits", 0),
                    "loc_added": q.get("loc_added", 0),
                    "loc_deleted": q.get("loc_deleted", 0),
                    "code_reviews": q.get("code_reviews", 0),
                    "pull_requests": q.get("pull_requests", 0),
                    "issues": q.get("issues", 0),
                    "backend_score": s.get("backend_code_score"),
                    "complexity": s.get("total_complexity_score"),
                    "raw_user_data": user,
                }
            )

        df = pd.DataFrame(rows)
        n_users = len(df)
        print(f"[github-insight] 사용자 {n_users}명 — 정량/이상치/정적 점수 계산 중…", flush=True)
        df["log1p_loc_added"] = np.log1p(df["loc_added"].clip(lower=0))
        df["log1p_loc_deleted"] = np.log1p(df["loc_deleted"].clip(lower=0))
        df["loc_per_commit"] = df["loc_added"] / (df["commits"] + 1)

        quant_cols = [
            "commits",
            "pull_requests",
            "issues",
            "code_reviews",
            "log1p_loc_added",
            "log1p_loc_deleted",
            "loc_per_commit",
        ]

        scaler = RobustScaler()
        x_quant = scaler.fit_transform(df[quant_cols])
        if n_users < MIN_N_ISOF:
            df["is_anomaly"] = 1
            df["anomaly_score"] = np.nan
            df["anomaly_status"] = "skipped"
            df["anomaly_reason"] = f"표본 수 {n_users}명 < 최소 {MIN_N_ISOF}명"
        else:
            contamination = min(0.15, max(1.0 / n_users, 0.05))
            iso = IsolationForest(n_estimators=200, contamination=contamination, random_state=42)
            df["is_anomaly"] = iso.fit_predict(x_quant)
            df["anomaly_score"] = iso.decision_function(x_quant)
            df["anomaly_status"] = "evaluated"
            df["anomaly_reason"] = "IsolationForest decision_function 기준"

        df["activity_count"] = (
            df["commits"].fillna(0).astype(int)
            + df["pull_requests"].fillna(0).astype(int)
            + df["issues"].fillna(0).astype(int)
            + df["code_reviews"].fillna(0).astype(int)
        )

        quant_component_cols = []
        for col in quant_cols:
            score_col = f"quant_{col}_score"
            df[score_col] = rate_quant_column(df[col])
            quant_component_cols.append(score_col)
        df["quant_score"] = compute_weighted_quant_score(df, quant_cols)
        inactive_quant = ~df.apply(has_quant_activity, axis=1)
        df.loc[inactive_quant, "quant_score"] = SCORE_NO_ACTIVITY

        # backend_code_score: 코드 활동·분석 결과 없으면 0
        df["static_backend_score"] = df.apply(static_score_for_row, axis=1)
        df["static_complexity_score"] = np.nan
        df["static_complexity_weight_effective"] = 0.0
        df["static_backend_weight_effective"] = 1.0
        df["static_score"] = df["static_backend_score"]

        print("[github-insight] 협업 NLP(커밋·PR·이슈 텍스트 임베딩) 점수 계산 중… (데이터가 많으면 수 분 걸릴 수 있음)", flush=True)
        self._apply_collab_scores(df)
        print("[github-insight] 협업 점수 계산 완료.", flush=True)
        df["final_score"] = weighted_final(df, SCORE_CONFIG)
        fully_inactive = inactive_quant & (df["loc_added"].fillna(0) == 0)
        df.loc[fully_inactive, "final_score"] = SCORE_NO_ACTIVITY

        validate_score_ranges(
            df,
            [
                "quant_score",
                "collab_score",
                "static_complexity_score",
                "static_backend_score",
                "static_score",
                "final_score",
            ],
        )

        print("[github-insight] Gemini 호출 중… (사용자당 1회: 전체 맥락+커밋별 JSON, 할당량 제한 시 재시도)", flush=True)
        gemini_summaries, gemini_commit_detail_rows = run_gemini_activity_summaries(df)
        df["gemini_activity_summary"] = gemini_summaries
        print("[github-insight] Gemini 요약 단계 완료.", flush=True)

        output_cols = [
            "name",
            "quant_score",
            *quant_component_cols,
            "collab_score",
            "collab_commit_score",
            "collab_pr_score",
            "collab_issue_score",
            "collab_commit_weight_effective",
            "collab_pr_weight_effective",
            "collab_issue_weight_effective",
            "collab_used_channels",
            "collab_missing_channels",
            "commit_text_count",
            "pr_text_count",
            "issue_text_count",
            "static_score",
            "static_complexity_score",
            "static_backend_score",
            "static_complexity_weight_effective",
            "static_backend_weight_effective",
            "final_score",
            "is_anomaly",
            "anomaly_score",
            "anomaly_status",
            "anomaly_reason",
            "strengths",
            "improvements",
            "data_notes",
            "top_feedback",
            "gemini_activity_summary",
        ]
        result_df = df[output_cols].copy()
        result_df.attrs["gemini_commit_detail_rows"] = gemini_commit_detail_rows
        result_df.attrs["embedding_model"] = self.embedding_model_name
        result_df.attrs["score_config"] = dict(SCORE_CONFIG)
        result_df.attrs["quant_component_weights"] = dict(QUANT_COMPONENT_WEIGHTS)
        result_df.attrs["collab_channel_weights"] = dict(COLLAB_CHANNEL_WEIGHTS)
        result_df.attrs["score_no_activity"] = SCORE_NO_ACTIVITY
        result_df.attrs["min_n_for_isolation_forest"] = MIN_N_ISOF
        result_df.attrs["complexity_lower_is_better"] = COMPLEXITY_LOWER_IS_BETTER
        return result_df

    def _apply_collab_scores(self, df):
        collab_scores, feedbacks = [], []
        strengths_list, improvements_list, data_notes_list = [], [], []
        commit_vals, pr_vals, issue_vals = [], [], []
        commit_weights, pr_weights, issue_weights = [], [], []
        used_channels_list, missing_channels_list = [], []
        commit_counts, pr_counts, issue_counts = [], [], []

        for _, row in df.iterrows():
            nlp = row["raw_user_data"].get("2_nlp_data", {})
            commit_msgs = []
            if nlp.get("commits"):
                commit_msgs = [commit.get("message", "") for commit in nlp["commits"] if isinstance(commit, dict)]
            elif nlp.get("commit_messages"):
                commit_msgs = nlp["commit_messages"]

            pr_texts = []
            for pr in nlp.get("pull_requests", []):
                block = f"{pr.get('title') or ''} {pr.get('body') or ''}".strip()
                if block:
                    pr_texts.append(block)
                pr_texts.extend(flat_comment_texts(pr.get("comments")))

            issue_texts = []
            for issue in nlp.get("issues", []):
                block = f"{issue.get('title') or ''} {issue.get('body') or ''}".strip()
                if block:
                    issue_texts.append(block)
                issue_texts.extend(flat_comment_texts(issue.get("comments")))

            commit_results = [self.evaluator.eval_text(msg, "commit") for msg in commit_msgs if str(msg).strip()]
            pr_results = [self.evaluator.eval_text(text, "long") for text in pr_texts if str(text).strip()]
            issue_results = [self.evaluator.eval_text(text, "long") for text in issue_texts if str(text).strip()]

            avg_commit = float(np.mean([res["score"] for res in commit_results])) if commit_results else None
            avg_pr = float(np.mean([res["score"] for res in pr_results])) if pr_results else None
            avg_issue = float(np.mean([res["score"] for res in issue_results])) if issue_results else None

            eff_w, used_channels = effective_collab_weights(avg_commit, avg_pr, avg_issue, COLLAB_CHANNEL_WEIGHTS)
            missing_channels = [key for key in COLLAB_CHANNEL_WEIGHTS if key not in used_channels]

            if not commit_results and not pr_results and not issue_results:
                collab_scores.append(SCORE_NO_ACTIVITY)
            else:
                collab_scores.append(
                    blend_collab_channels(avg_commit, avg_pr, avg_issue, COLLAB_CHANNEL_WEIGHTS)
                )
            commit_vals.append(avg_commit if avg_commit is not None else np.nan)
            pr_vals.append(avg_pr if avg_pr is not None else np.nan)
            issue_vals.append(avg_issue if avg_issue is not None else np.nan)
            commit_weights.append(eff_w["commit"])
            pr_weights.append(eff_w["pr"])
            issue_weights.append(eff_w["issue"])
            used_channels_list.append(",".join(used_channels) if used_channels else "none")
            missing_channels_list.append(",".join(missing_channels) if missing_channels else "none")
            commit_counts.append(len(commit_results))
            pr_counts.append(len(pr_results))
            issue_counts.append(len(issue_results))

            strengths, improvements, data_notes = self._build_user_insights(
                row=row,
                avg_commit=avg_commit,
                avg_pr=avg_pr,
                avg_issue=avg_issue,
                commit_count=len(commit_results),
                pr_count=len(pr_results),
                issue_count=len(issue_results),
                used_channels=used_channels,
                missing_channels=missing_channels,
            )
            strengths_list.append(strengths)
            improvements_list.append(improvements)
            data_notes_list.append(data_notes)

            # 기존 feedback 필드는 프론트에서 간단히 보여줄 수 있는 핵심 개선/주의 문구만 유지합니다.
            short_feedback = improvements[:2] + data_notes[:1]
            if not short_feedback:
                short_feedback = strengths[:2]
            feedbacks.append(short_feedback[:3])

        df["collab_score"] = collab_scores
        df["collab_commit_score"] = commit_vals
        df["collab_pr_score"] = pr_vals
        df["collab_issue_score"] = issue_vals
        df["collab_commit_weight_effective"] = commit_weights
        df["collab_pr_weight_effective"] = pr_weights
        df["collab_issue_weight_effective"] = issue_weights
        df["collab_used_channels"] = used_channels_list
        df["collab_missing_channels"] = missing_channels_list
        df["commit_text_count"] = commit_counts
        df["pr_text_count"] = pr_counts
        df["issue_text_count"] = issue_counts
        df["strengths"] = strengths_list
        df["improvements"] = improvements_list
        df["data_notes"] = data_notes_list
        df["top_feedback"] = feedbacks

    def _build_user_insights(
        self,
        row,
        avg_commit,
        avg_pr,
        avg_issue,
        commit_count,
        pr_count,
        issue_count,
        used_channels,
        missing_channels,
    ):
        strengths = []
        improvements = []
        data_notes = []

        loc_added = float(row.get("loc_added", 0) or 0)
        loc_per_commit = float(row.get("loc_per_commit", 0) or 0)

        if commit_count >= 12:
            strengths.append("커밋 기록이 꾸준히 확인되어 작업 흐름을 추적하기 좋습니다.")
        elif commit_count >= 6:
            strengths.append("기능 구현 과정이 여러 커밋으로 남아 있어 기본적인 작업 흐름이 확인됩니다.")
        elif commit_count > 0:
            strengths.append("커밋 메시지 기반으로 최소한의 작업 흔적은 확인됩니다.")

        if loc_added >= 5000:
            strengths.append("큰 규모의 코드 변경을 수행해 구현 기여도가 뚜렷하게 나타납니다.")
        elif loc_added >= 1500:
            strengths.append("의미 있는 수준의 코드 변경량이 확인됩니다.")

        if avg_commit is not None:
            if avg_commit >= 65:
                strengths.append("커밋 메시지에서 변경 목적과 맥락이 비교적 잘 드러납니다.")
            elif avg_commit < 45:
                improvements.append("커밋 메시지에 변경 목적과 이유를 더 구체적으로 적으면 협업자가 맥락을 이해하기 쉽습니다.")
        else:
            improvements.append("커밋 메시지 데이터가 없어 변경 의도를 분석하기 어렵습니다.")

        if pr_count > 0:
            if avg_pr is not None and avg_pr >= 65:
                strengths.append("PR 설명이나 코멘트에서 변경 맥락이 비교적 잘 드러납니다.")
            elif avg_pr is not None:
                improvements.append("PR 본문에 구현 이유, 주요 변경점, 테스트 여부를 더 구체적으로 남기면 좋습니다.")
        else:
            improvements.append("주요 기능 단위는 PR로 남기면 변경 의도와 리뷰 흐름을 더 잘 보여줄 수 있습니다.")

        if issue_count > 0:
            if avg_issue is not None and avg_issue >= 65:
                strengths.append("이슈 기록을 통해 작업 배경이나 문제 정의를 일부 확인할 수 있습니다.")
            elif avg_issue is not None:
                improvements.append("이슈에 재현 방법, 기대 동작, 실제 동작을 적으면 문제 정의가 더 명확해집니다.")
        else:
            improvements.append("작업 배경이나 버그 맥락을 이슈로 남기면 협업 인사이트가 더 풍부해집니다.")

        if loc_per_commit >= 300:
            improvements.append("커밋당 변경량이 큰 편입니다. 큰 변경은 더 작은 커밋이나 PR 설명으로 나누면 리뷰하기 쉽습니다.")
        elif 0 < loc_per_commit <= 80 and commit_count >= 5:
            strengths.append("커밋 단위가 비교적 작게 나뉘어 변경 흐름을 따라가기 쉽습니다.")

        if missing_channels:
            data_notes.append(
                f"현재 {', '.join(missing_channels)} 데이터가 없어 협업 점수는 사용 가능한 채널({', '.join(used_channels) if used_channels else '없음'}) 기준으로 계산되었습니다."
            )

        if float(row.get("static_score", 0) or 0) == SCORE_NO_ACTIVITY and (
            int(row.get("commits", 0) or 0) == 0 and float(row.get("loc_added", 0) or 0) == 0
        ):
            data_notes.append("코드 활동이 없어 정적 점수는 0점입니다.")
        elif float(row.get("static_score", 0) or 0) == SCORE_NO_ACTIVITY:
            data_notes.append("backend_code_score가 없어 정적 점수는 0점입니다.")
        if not used_channels and commit_count == 0 and pr_count == 0 and issue_count == 0:
            data_notes.append("협업 텍스트(커밋/PR/이슈)가 없어 협업 점수는 0점입니다.")

        if row.get("anomaly_status") == "skipped":
            data_notes.append(str(row.get("anomaly_reason")))
        elif row.get("is_anomaly") == -1:
            data_notes.append("정량 활동 패턴이 팀 내 다른 사용자와 다르게 나타나 데이터 확인이 필요합니다.")

        return (
            list(dict.fromkeys(strengths))[:3],
            list(dict.fromkeys(improvements))[:3],
            list(dict.fromkeys(data_notes))[:3],
        )

    def build_frontend_payload(self, result_df):
        users = []
        for _, row in result_df.iterrows():
            users.append(
                {
                    "name": row["name"],
                    "final_score": _json_safe(row["final_score"]),
                    "scores": {
                        "quant": _json_safe(row["quant_score"]),
                        "collab": _json_safe(row["collab_score"]),
                        "static": _json_safe(row["static_score"]),
                    },
                    "collab_breakdown": {
                        "commit": _json_safe(row["collab_commit_score"]),
                        "pr": _json_safe(row["collab_pr_score"]),
                        "issue": _json_safe(row["collab_issue_score"]),
                        "effective_weights": {
                            "commit": _json_safe(row["collab_commit_weight_effective"]),
                            "pr": _json_safe(row["collab_pr_weight_effective"]),
                            "issue": _json_safe(row["collab_issue_weight_effective"]),
                        },
                        "used_channels": row["collab_used_channels"],
                        "missing_channels": row["collab_missing_channels"],
                    },
                    "static_breakdown": {
                        "complexity": _json_safe(row["static_complexity_score"]),
                        "backend": _json_safe(row["static_backend_score"]),
                        "effective_weights": {
                            "complexity": _json_safe(row["static_complexity_weight_effective"]),
                            "backend": _json_safe(row["static_backend_weight_effective"]),
                        },
                    },
                    "activity_counts": {
                        "commit_text": _json_safe(row["commit_text_count"]),
                        "pr_text": _json_safe(row["pr_text_count"]),
                        "issue_text": _json_safe(row["issue_text_count"]),
                    },
                    "anomaly": {
                        "label": _json_safe(row["is_anomaly"]),
                        "score": _json_safe(row["anomaly_score"]),
                        "status": row["anomaly_status"],
                        "reason": row["anomaly_reason"],
                    },
                    "insights": {
                        "strengths": _json_safe(row["strengths"]),
                        "improvements": _json_safe(row["improvements"]),
                        "data_notes": _json_safe(row["data_notes"]),
                    },
                    "feedback": _json_safe(row["top_feedback"]),
                }
            )

        return {
            "summary": {
                "score_weights": dict(SCORE_CONFIG),
                "collab_channel_weights": dict(COLLAB_CHANNEL_WEIGHTS),
                "embedding_model": self.embedding_model_name,
                "min_n_for_isolation_forest": MIN_N_ISOF,
                "complexity_lower_is_better": COMPLEXITY_LOWER_IS_BETTER,
            },
            "users": users,
            "visualization": {
                "score_bar": [
                    {"name": user["name"], "final_score": user["final_score"]}
                    for user in users
                ],
                "score_breakdown": [
                    {"name": user["name"], **user["scores"]}
                    for user in users
                ],
                "collab_breakdown": [
                    {
                        "name": user["name"],
                        "commit": user["collab_breakdown"]["commit"],
                        "pr": user["collab_breakdown"]["pr"],
                        "issue": user["collab_breakdown"]["issue"],
                    }
                    for user in users
                ],
            },
        }


# 이전 main.py가 import하던 이름과의 호환용 별칭입니다.
MyAIEngine = GitHubInsightEngine