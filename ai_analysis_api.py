"""
백엔드 AI 분석 결과 저장 API (명세 v1) 연동.

POST {AI_ANALYSIS_API_BASE}/api/projects/{project_id}/ai-analysis
Body: { "users": [...], "pull_requests": [...], "issues": [...] }
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd

from ai_engine import (
    GEMINI_INTER_CHUNK_SLEEP_SEC,
    GEMINI_MODEL_DEFAULT,
    GEMINI_SUMMARY_MAX_CHARS,
    _gemini_extract_json_object,
    _gemini_parse_json_with_retries,
    normalize_outline_summary,
)


AI_ANALYSIS_API_BASE_DEFAULT = "http://3.39.190.222:5000"
# PR/Issue Gemini: 한 번에 넣는 개수 (토큰 과다 시 줄이거나, GEMINI_PR_ISSUE_CHUNK 로 배치 호출)
GEMINI_PR_ISSUE_CHUNK = int(os.environ.get("GEMINI_PR_ISSUE_CHUNK", "8"))
# PR/Issue Gemini 요약용 본문·코멘트 전처리 (collab_network 와 무관)
GEMINI_SUMMARY_BODY_MAX_CHARS = int(os.environ.get("GEMINI_SUMMARY_BODY_MAX_CHARS", "800"))
GEMINI_SUMMARY_COMMENTS_MAX_CHARS = int(os.environ.get("GEMINI_SUMMARY_COMMENTS_MAX_CHARS", "600"))
GEMINI_SUMMARY_FALLBACK_BODY_CHARS = int(os.environ.get("GEMINI_SUMMARY_FALLBACK_BODY_CHARS", "200"))

_WORK_SECTION_HEADERS = (
    re.compile(r"##\s*[^\n]*작업\s*내용", re.I),
    re.compile(r"##\s*[^\n]*📝\s*작업\s*내용", re.I),
    re.compile(r"##\s*[^\n]*work\s*content", re.I),
    re.compile(r"##\s*[^\n]*description", re.I),
    re.compile(r"##\s*[^\n]*🐞[^\n]*버그", re.I),
    re.compile(r"##\s*[^\n]*버그\s*설명", re.I),
    re.compile(r"##\s*[^\n]*✨[^\n]*기능", re.I),
    re.compile(r"##\s*[^\n]*기능\s*설명", re.I),
)
_BOILERPLATE_HEADER = re.compile(
    r"^##\s*.*(연관\s*된\s*이슈|체크\s*리스트|checklist|review\s*checklist|"
    r"screenshot|스크린샷|related\s*issue|issue\s*link|"
    r"원인|예상|참고|리뷰\s*요구|summary\s*by|release\s*notes|"
    r"coderabbit|auto-generated|internal\s*state)",
    re.I,
)
_GITHUB_HTML_COMMENT = re.compile(r"<!--[\s\S]*?-->", re.MULTILINE)
_MARKDOWN_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
_URL_ONLY_LINE = re.compile(r"^https?://\S+\s*$", re.I)
_CHECKBOX_ONLY = re.compile(r"^-\s*\[[ xX]\]\s*[\w\s]{0,2}$")
_LOW_VALUE_COMMENT = re.compile(
    r"^(lgtm|looks?\s*good|ok\.?|done\.?|merged\.?|approve[d]?\.?|thanks?\.?|"
    r"thank\s*you\.?|👍|✅|🚀|cc\s*@.+)$",
    re.I,
)


def _clean_pr_issue_line(line: str) -> Optional[str]:
    """한 줄 단위 노이즈 제거. None이면 해당 줄 스킵."""
    line = line.strip()
    if not line:
        return None
    if _BOILERPLATE_HEADER.match(line):
        return None
    if _URL_ONLY_LINE.match(line):
        return None
    if _CHECKBOX_ONLY.match(line):
        return None
    if re.search(r"summary\s*by\s*coderabbit|auto-generated\s*comment", line, re.I):
        return None
    if line.startswith(">"):
        inner = line.lstrip(">").strip()
        if re.match(r"^(ex\)|이번\s*PR|please|screenshot|image)", inner, re.I):
            return None
        line = inner
    line = _MARKDOWN_IMAGE.sub("", line).strip()
    line = re.sub(r"https?://\S+", "", line).strip()
    return line or None


def preprocess_pr_issue_body(body: str, *, max_chars: Optional[int] = None) -> str:
    """PR/Issue 본문에서 템플릿 노이즈를 줄이고 작업·설명 구간 위주로 정리합니다."""
    limit = GEMINI_SUMMARY_BODY_MAX_CHARS if max_chars is None else max_chars
    text = str(body or "").replace("\r\n", "\n").strip()
    if not text:
        return ""

    text = _GITHUB_HTML_COMMENT.sub("", text).strip()

    extracted = ""
    for header_pat in _WORK_SECTION_HEADERS:
        match = header_pat.search(text)
        if not match:
            continue
        start = match.end()
        rest = text[start:]
        next_header = re.search(r"\n##\s+", rest)
        section = rest[: next_header.start()] if next_header else rest
        section = section.strip()
        if len(section) >= 8:
            extracted = section
            break

    if extracted:
        text = extracted
    else:
        kept: List[str] = []
        for line in text.split("\n"):
            cleaned = _clean_pr_issue_line(line)
            if cleaned is None:
                continue
            if cleaned.startswith("##") and _BOILERPLATE_HEADER.search(cleaned):
                continue
            kept.append(cleaned)
        text = "\n".join(kept).strip()

    lines = []
    for ln in text.split("\n"):
        cleaned = _clean_pr_issue_line(ln)
        if cleaned is not None:
            lines.append(cleaned)
    text = "\n".join(lines).strip()
    if limit > 0 and len(text) > limit:
        text = text[:limit] + "…"
    return text


def _is_low_value_comment(text: str) -> bool:
    compact = " ".join(str(text or "").split())
    if len(compact) < 4:
        return True
    return bool(_LOW_VALUE_COMMENT.match(compact))


def format_summary_comments_for_prompt(
    comments: List[Any],
    *,
    max_chars: Optional[int] = None,
) -> str:
    """Gemini PR/Issue 요약 프롬프트용 코멘트 (리뷰 우선, 글자 수 cap). collab_network 와 별개."""
    limit = GEMINI_SUMMARY_COMMENTS_MAX_CHARS if max_chars is None else max_chars
    if limit <= 0:
        return ""

    review_texts: List[str] = []
    other_texts: List[str] = []
    for cm in comments or []:
        text = _comment_body(cm).strip()
        if not text or _is_low_value_comment(text):
            continue
        one_line = " ".join(text.split())
        is_review = _comment_is_review(cm) or bool(re.search(r"\[review", one_line, re.I))
        if is_review:
            review_texts.append(one_line)
        else:
            other_texts.append(one_line)

    parts: List[str] = []
    used = 0
    for text in review_texts + other_texts:
        sep = 3 if parts else 0
        if used + sep + len(text) > limit:
            remain = limit - used - sep
            if remain > 48:
                parts.append(text[: remain - 1] + "…")
            break
        parts.append(text)
        used += sep + len(text)
    return " | ".join(parts)


def _summary_prompt_body(meta: dict) -> str:
    return preprocess_pr_issue_body(str(meta.get("body") or ""))


def _build_pr_issue_prompt_block(kind: str, num: int, meta: dict) -> str:
    """PR/Issue 작성자가 올린 제목·본문만 Gemini 입력 (댓글·리뷰 제외)."""
    title = (meta.get("title") or "").strip()
    body = _summary_prompt_body(meta)
    label = "PR" if kind == "pr" else "Issue"
    return f"### {label} #{num}\n제목: {title}\n작업·설명(전처리): {body or '(없음)'}\n"


def _api_base() -> str:
    return os.environ.get("AI_ANALYSIS_API_BASE", AI_ANALYSIS_API_BASE_DEFAULT).rstrip("/")


def _round_score(value) -> Optional[float]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def _comment_author_login(comment: Any) -> Optional[str]:
    """문자열/객체 댓글에서 GitHub username을 추출합니다.

    문자열 예:
      - "[dbader]: Thanks!" -> "dbader"
      - "[Code Review - NathanWailes]: Fixed" -> "NathanWailes"
      - "[Review(APPROVED) - leesh0961]: 확인" -> "leesh0961"
    """
    if isinstance(comment, str):
        text = comment.strip()
        match = re.match(r"^\[(?:[^\]]*-\s*)?([^\]\s:-]+)\]\s*:", text)
        if match:
            author = match.group(1).strip()
            return author or None
        match = re.match(r"^([A-Za-z0-9_.-]+)\s*:", text)
        if match:
            return match.group(1).strip() or None
        return None
    if not isinstance(comment, dict):
        return None
    user = comment.get("user")
    if isinstance(user, dict) and user.get("login"):
        return str(user["login"])
    if comment.get("author"):
        return str(comment["author"])
    if comment.get("login"):
        return str(comment["login"])
    return None


def _comment_body(comment: Any) -> str:
    if isinstance(comment, str):
        return comment
    if isinstance(comment, dict):
        return str(comment.get("body") or comment.get("text") or "")
    return ""


def _pr_owner_login(pr: dict) -> Optional[str]:
    u = pr.get("user") or pr.get("author")
    if isinstance(u, dict):
        v = u.get("login") or u.get("username")
        return str(v).strip() if v else None
    if isinstance(u, str) and u.strip():
        return u.strip()
    if pr.get("login"):
        return str(pr["login"]).strip()
    return None


def _issue_owner_login(issue: dict) -> Optional[str]:
    u = issue.get("user") or issue.get("author")
    if isinstance(u, dict):
        v = u.get("login") or u.get("username")
        return str(v).strip() if v else None
    if isinstance(u, str) and u.strip():
        return u.strip()
    if issue.get("login"):
        return str(issue["login"]).strip()
    return None


def _comment_is_review(comment: Any) -> bool:
    if isinstance(comment, dict):
        t = str(comment.get("type") or "").lower()
        if "review" in t or comment.get("pull_request_review_id"):
            return True
    if isinstance(comment, str):
        return bool(re.search(r"\[review", comment, re.I))
    return False


def _comment_fingerprint(cm: Any) -> str:
    if isinstance(cm, dict):
        cid = cm.get("id") or cm.get("node_id")
        if cid is not None:
            return f"id:{cid}"
        body = str(cm.get("body") or cm.get("text") or "")[:240]
        return f"{_comment_author_login(cm)}|{body}"
    return str(cm)[:240]


def _index_project_prs_issues(raw_json: dict) -> Tuple[Dict[int, dict], Dict[int, dict]]:
    """PR/issue 번호별로 작성자(owner)와 댓글 목록을 프로젝트 전체에서 합칩니다."""
    users = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else raw_json
    if not isinstance(users, list):
        return {}, {}

    prs: Dict[int, dict] = {}
    issues: Dict[int, dict] = {}

    for user in users:
        username = str(user.get("username") or "").strip() or None
        nlp = user.get("2_nlp_data", {}) or {}
        for pr in nlp.get("pull_requests", []) or []:
            num = pr.get("pr_number")
            if num is None:
                continue
            try:
                num = int(num)
            except (TypeError, ValueError):
                continue
            owner = _pr_owner_login(pr) or username
            if num not in prs:
                prs[num] = {"owner": owner, "comments": [], "_seen": set()}
            slot = prs[num]
            if owner and not slot["owner"]:
                slot["owner"] = owner
            for cm in pr.get("comments") or []:
                fp = _comment_fingerprint(cm)
                if fp in slot["_seen"]:
                    continue
                slot["_seen"].add(fp)
                slot["comments"].append(cm)

        for issue in nlp.get("issues", []) or []:
            num = issue.get("issue_number")
            if num is None:
                continue
            try:
                num = int(num)
            except (TypeError, ValueError):
                continue
            owner = _issue_owner_login(issue) or username
            if num not in issues:
                issues[num] = {"owner": owner, "comments": [], "_seen": set()}
            slot = issues[num]
            if owner and not slot["owner"]:
                slot["owner"] = owner
            for cm in issue.get("comments") or []:
                fp = _comment_fingerprint(cm)
                if fp in slot["_seen"]:
                    continue
                slot["_seen"].add(fp)
                slot["comments"].append(cm)

    for meta in prs.values():
        meta.pop("_seen", None)
    for meta in issues.values():
        meta.pop("_seen", None)
    return prs, issues


def build_collab_network(username: str, raw_json: dict, team_usernames: Set[str]) -> List[dict]:
    """현재 사용자 → 다른 팀원 방향 소통 (팀원별 한 행, 0 포함).

    API 권장 형식:
      [{"target_username": "...", "comment_count": n, "review_count": n,
        "issue_comment_count": n, "weight": n}, ...]
    weight 는 현재 임시 기준으로 세 카운트의 합입니다.
    """
    others = sorted(t for t in team_usernames if t and t != username)
    counts: Dict[str, Dict[str, int]] = {t: {"comment_count": 0, "review_count": 0, "issue_comment_count": 0} for t in others}

    pr_index, issue_index = _index_project_prs_issues(raw_json)

    for meta in pr_index.values():
        owner = meta.get("owner")
        if not owner or owner not in counts:
            continue
        for cm in meta.get("comments") or []:
            if _comment_author_login(cm) != username:
                continue
            if _comment_is_review(cm):
                counts[owner]["review_count"] += 1
            else:
                counts[owner]["comment_count"] += 1

    for meta in issue_index.values():
        owner = meta.get("owner")
        if not owner or owner not in counts:
            continue
        for cm in meta.get("comments") or []:
            if _comment_author_login(cm) != username:
                continue
            counts[owner]["issue_comment_count"] += 1

    out: List[dict] = []
    for target in others:
        c = counts[target]
        w = int(c["comment_count"] + c["review_count"] + c["issue_comment_count"])
        out.append(
            {
                "target_username": target,
                "comment_count": int(c["comment_count"]),
                "review_count": int(c["review_count"]),
                "issue_comment_count": int(c["issue_comment_count"]),
                "weight": w,
            }
        )
    return out


def _collect_pr_issue_catalog(raw_json: dict) -> Tuple[Dict[int, dict], Dict[int, dict]]:
    """프로젝트 전체에서 pr_number / issue_number 기준으로 PR·이슈 텍스트 수집."""
    prs: Dict[int, dict] = {}
    issues: Dict[int, dict] = {}
    users = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else raw_json
    if not isinstance(users, list):
        return prs, issues

    for user in users:
        nlp = user.get("2_nlp_data", {}) or {}
        for pr in nlp.get("pull_requests", []) or []:
            num = pr.get("pr_number")
            if num is None:
                continue
            try:
                num = int(num)
            except (TypeError, ValueError):
                continue
            if num not in prs:
                prs[num] = {
                    "title": (pr.get("title") or "").strip(),
                    "body": (pr.get("body") or "").strip(),
                    "comments": list(pr.get("comments") or []),
                }
        for issue in nlp.get("issues", []) or []:
            num = issue.get("issue_number")
            if num is None:
                continue
            try:
                num = int(num)
            except (TypeError, ValueError):
                continue
            if num not in issues:
                issues[num] = {
                    "title": (issue.get("title") or "").strip(),
                    "body": (issue.get("body") or "").strip(),
                    "comments": list(issue.get("comments") or []),
                }
    return prs, issues


def _summary_looks_like_body_paste(summary: str, title: str) -> bool:
    """Gemini가 fallback 형태(제목+템플릿/다중 bullet)로 붙인 경우만 재시도."""
    s = (summary or "").strip()
    t = (title or "").strip()
    if not s or not t:
        return False
    if not (s.startswith(t + " —") or s.startswith(t + "—")):
        return False
    tail = s.split(" — ", 1)[1] if " — " in s else s.split("—", 1)[-1]
    tail = tail.strip()
    if tail.startswith("##") or tail.startswith("###") or "#️⃣" in tail[:48]:
        return True
    if "\n- " in tail or tail.count("\n") >= 2:
        return True
    if tail.startswith("- ") and len(tail) > 72:
        return True
    return False


def _parse_pr_issue_summaries(
    raw_text: str,
    kind: str,
    *,
    titles_by_num: Optional[Dict[int, str]] = None,
    required_nums: Optional[Set[int]] = None,
) -> Dict[int, str]:
    """kind: 'prs' | 'issues' → {number: summary}"""
    data = _gemini_extract_json_object(raw_text)
    key = "prs" if kind == "prs" else "issues"
    num_key = "pr_number" if kind == "prs" else "issue_number"
    alt_num_key = "number"
    out: Dict[int, str] = {}
    titles = titles_by_num or {}
    for item in data.get(key, []) or []:
        if not isinstance(item, dict):
            continue
        num = None
        for k in (num_key, alt_num_key):
            if k not in item:
                continue
            try:
                num = int(item[k])
                break
            except (TypeError, ValueError):
                continue
        if num is None:
            continue
        s = normalize_outline_summary(str(item.get("summary", "") or ""))
        if not s:
            continue
        title = titles.get(num, "")
        if title and _summary_looks_like_body_paste(s, title):
            continue
        out[num] = s
    if required_nums is not None and not out and required_nums:
        raise ValueError(f"{kind} JSON 파싱 결과가 비어 있습니다")
    return out


def _verify_pr_issue_summary_parser() -> None:
    """Gemini PR/Issue 파서 회귀 방지 (프로젝트 30 NameError 버그 재발 차단)."""
    plain = _parse_pr_issue_summaries(
        '{"prs": [{"pr_number": 1, "summary": "테스트 요약"}]}',
        "prs",
    )
    if plain.get(1) != "테스트 요약":
        raise RuntimeError("PR/Issue Gemini 파서 smoke test 실패 (plain JSON)")
    fenced = _parse_pr_issue_summaries(
        '```json\n{"prs": [{"pr_number": 2, "summary": "펜스 테스트"}]}\n```',
        "prs",
    )
    if fenced.get(2) != "펜스 테스트":
        raise RuntimeError("PR/Issue Gemini 파서 smoke test 실패 (code fence)")
    issue = _parse_pr_issue_summaries(
        '{"issues": [{"issue_number": 3, "summary": "버그 수정"}]}',
        "issues",
    )
    if issue.get(3) != "버그 수정":
        raise RuntimeError("PR/Issue Gemini 파서 smoke test 실패 (issues key)")
    titles = {10: "[BE] OAuth"}
    good = _parse_pr_issue_summaries(
        '{"prs": [{"pr_number": 10, "summary": "[BE] OAuth — JWT 발급 및 검증"}]}',
        "prs",
        titles_by_num=titles,
    )
    if good.get(10) != "[BE] OAuth — JWT 발급 및 검증":
        raise RuntimeError("PR/Issue Gemini 파서 smoke test 실패 (valid em-dash summary)")
    if not _summary_looks_like_body_paste("[BE] OAuth — ## 🐞 버그 설명", "[BE] OAuth"):
        raise RuntimeError("body paste 감지 smoke test 실패 (template)")
    if _summary_looks_like_body_paste("[BE] OAuth — JWT 발급", "[BE] OAuth"):
        raise RuntimeError("body paste 오탐 (valid short summary)")


def _log_pr_issue_fallback(kind: str, num: int, reason: str) -> None:
    print(f"[gemini-pr-issue] fallback {kind} #{num}: {reason}", file=sys.stderr, flush=True)


def run_gemini_pr_issue_summaries(raw_json: dict) -> Tuple[Dict[int, str], Dict[int, str]]:
    """PR·이슈 요약: Gemini를 PR/Issue 번호 묶음(GEMINI_PR_ISSUE_CHUNK)마다 호출."""
    prs, issues = _collect_pr_issue_catalog(raw_json)
    if not prs and not issues:
        return {}, {}

    _verify_pr_issue_summary_parser()

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return (
            {n: _fallback_pr_issue_summary(meta) for n, meta in prs.items()},
            {n: _fallback_pr_issue_summary(meta) for n, meta in issues.items()},
        )

    try:
        from google import genai as google_genai
    except ImportError:
        return (
            {n: _fallback_pr_issue_summary(meta) for n, meta in prs.items()},
            {n: _fallback_pr_issue_summary(meta) for n, meta in issues.items()},
        )

    model_name = os.environ.get("GEMINI_MODEL", GEMINI_MODEL_DEFAULT).strip() or GEMINI_MODEL_DEFAULT
    client = google_genai.Client(api_key=api_key)

    pr_out: Dict[int, str] = {}
    issue_out: Dict[int, str] = {}

    def _pr_prompt_block(num: int) -> str:
        return _build_pr_issue_prompt_block("pr", num, prs[num])

    def _issue_prompt_block(num: int) -> str:
        return _build_pr_issue_prompt_block("issue", num, issues[num])

    _SUMMARY_RULES = (
        f"각 summary는 개조식 한 줄(명사형), {GEMINI_SUMMARY_MAX_CHARS}자 이내. "
        '"~했습니다/~합니다/~했다" 종결형 금지. 추측 금지. '
        "PR/Issue 작성자가 제목·본문에 적은 실제 구현·수정·버그 내용만 요약. "
        "템플릿·체크리스트·연관 이슈 안내·댓글·리뷰는 무시."
    )

    def _run_pr_chunk(chunk_nums: List[int]) -> Dict[int, str]:
        blocks = [_pr_prompt_block(num) for num in chunk_nums]
        prompt = f"""GitHub PR 요약. 출력은 JSON만:
{{"prs": [{{"pr_number": 번호, "summary": "개조식 한 줄(명사형)"}}]}}

규칙: 아래 나열된 PR 번호만 모두 포함. {_SUMMARY_RULES}

{"".join(blocks)}"""
        titles = {n: (prs[n].get("title") or "").strip() for n in chunk_nums}
        required = set(chunk_nums)
        return _gemini_parse_json_with_retries(
            client,
            model_name,
            prompt,
            lambda raw, t=titles, req=required: _parse_pr_issue_summaries(
                raw, "prs", titles_by_num=t, required_nums=req
            ),
            max_out_tokens=8192,
        )

    def _run_single_pr(num: int) -> str:
        prompt = f"""GitHub PR 요약. 출력은 JSON만:
{{"prs": [{{"pr_number": {num}, "summary": "개조식 한 줄(명사형)"}}]}}

규칙: {_SUMMARY_RULES}

{_pr_prompt_block(num)}"""
        title = (prs[num].get("title") or "").strip()
        try:
            part = _gemini_parse_json_with_retries(
                client,
                model_name,
                prompt,
                lambda raw, n=num, t=title: _parse_pr_issue_summaries(
                    raw, "prs", titles_by_num={n: t}, required_nums={n}
                ),
                max_out_tokens=2048,
            )
            if part.get(num):
                return part[num]
            _log_pr_issue_fallback("PR", num, "Gemini 응답에 summary 없음")
            return _fallback_pr_issue_summary(prs[num])
        except Exception as exc:
            _log_pr_issue_fallback("PR", num, str(exc)[:120])
            return _fallback_pr_issue_summary(prs[num])

    def _fill_pr_chunk(chunk_nums: List[int], part: Optional[Dict[int, str]] = None) -> None:
        for n in chunk_nums:
            if part and part.get(n):
                pr_out[n] = part[n]
            else:
                pr_out[n] = _run_single_pr(n)

    if prs:
        pr_nums = sorted(prs.keys())
        for i in range(0, len(pr_nums), GEMINI_PR_ISSUE_CHUNK):
            if i > 0 and GEMINI_INTER_CHUNK_SLEEP_SEC > 0:
                time.sleep(GEMINI_INTER_CHUNK_SLEEP_SEC)
            chunk = pr_nums[i : i + GEMINI_PR_ISSUE_CHUNK]
            try:
                part = _run_pr_chunk(chunk)
                _fill_pr_chunk(chunk, part)
            except Exception as exc:
                _log_pr_issue_fallback("PR-chunk", chunk[0], str(exc)[:120])
                _fill_pr_chunk(chunk, None)

    def _run_issue_chunk(chunk_nums: List[int]) -> Dict[int, str]:
        blocks = [_issue_prompt_block(num) for num in chunk_nums]
        prompt = f"""GitHub Issue 요약. 출력은 JSON만:
{{"issues": [{{"issue_number": 번호, "summary": "개조식 한 줄(명사형)"}}]}}

규칙: 아래 나열된 Issue 번호만 모두 포함. {_SUMMARY_RULES}

{"".join(blocks)}"""
        titles = {n: (issues[n].get("title") or "").strip() for n in chunk_nums}
        required = set(chunk_nums)
        return _gemini_parse_json_with_retries(
            client,
            model_name,
            prompt,
            lambda raw, t=titles, req=required: _parse_pr_issue_summaries(
                raw, "issues", titles_by_num=t, required_nums=req
            ),
            max_out_tokens=8192,
        )

    def _run_single_issue(num: int) -> str:
        prompt = f"""GitHub Issue 요약. 출력은 JSON만:
{{"issues": [{{"issue_number": {num}, "summary": "개조식 한 줄(명사형)"}}]}}

규칙: {_SUMMARY_RULES}

{_issue_prompt_block(num)}"""
        title = (issues[num].get("title") or "").strip()
        try:
            part = _gemini_parse_json_with_retries(
                client,
                model_name,
                prompt,
                lambda raw, n=num, t=title: _parse_pr_issue_summaries(
                    raw, "issues", titles_by_num={n: t}, required_nums={n}
                ),
                max_out_tokens=2048,
            )
            if part.get(num):
                return part[num]
            _log_pr_issue_fallback("Issue", num, "Gemini 응답에 summary 없음")
            return _fallback_pr_issue_summary(issues[num])
        except Exception as exc:
            _log_pr_issue_fallback("Issue", num, str(exc)[:120])
            return _fallback_pr_issue_summary(issues[num])

    def _fill_issue_chunk(chunk_nums: List[int], part: Optional[Dict[int, str]] = None) -> None:
        for n in chunk_nums:
            if part and part.get(n):
                issue_out[n] = part[n]
            else:
                issue_out[n] = _run_single_issue(n)

    if issues:
        issue_nums = sorted(issues.keys())
        for i in range(0, len(issue_nums), GEMINI_PR_ISSUE_CHUNK):
            if i > 0 and GEMINI_INTER_CHUNK_SLEEP_SEC > 0:
                time.sleep(GEMINI_INTER_CHUNK_SLEEP_SEC)
            chunk = issue_nums[i : i + GEMINI_PR_ISSUE_CHUNK]
            try:
                part = _run_issue_chunk(chunk)
                _fill_issue_chunk(chunk, part)
            except Exception as exc:
                _log_pr_issue_fallback("Issue-chunk", chunk[0], str(exc)[:120])
                _fill_issue_chunk(chunk, None)

    for n, meta in prs.items():
        if n not in pr_out:
            pr_out[n] = _fallback_pr_issue_summary(meta)
            _log_pr_issue_fallback("PR", n, "최종 누락")
    for n, meta in issues.items():
        if n not in issue_out:
            issue_out[n] = _fallback_pr_issue_summary(meta)
            _log_pr_issue_fallback("Issue", n, "최종 누락")

    pr_fb = sum(1 for n, m in prs.items() if pr_out.get(n) == _fallback_pr_issue_summary(m))
    iss_fb = sum(1 for n, m in issues.items() if issue_out.get(n) == _fallback_pr_issue_summary(m))
    if prs or issues:
        print(
            f"[gemini-pr-issue] 완료: PR {len(prs)}건 (fallback {pr_fb}), "
            f"Issue {len(issues)}건 (fallback {iss_fb})",
            flush=True,
        )

    return pr_out, issue_out


def _fallback_pr_issue_summary(meta: dict) -> str:
    title = (meta.get("title") or "").strip()
    body = preprocess_pr_issue_body(
        str(meta.get("body") or ""),
        max_chars=GEMINI_SUMMARY_FALLBACK_BODY_CHARS,
    )
    if title and body:
        text = normalize_outline_summary(f"{title} — {body}")
    elif title:
        text = normalize_outline_summary(title)
    elif body:
        text = normalize_outline_summary(body)
    else:
        text = "(요약할 본문 없음)"
    if len(text) > GEMINI_SUMMARY_MAX_CHARS:
        text = text[: GEMINI_SUMMARY_MAX_CHARS - 1] + "…"
    return text


def build_ai_analysis_payload(
    raw_json: dict,
    result_df: pd.DataFrame,
    *,
    pr_summaries: Optional[Dict[int, str]] = None,
    issue_summaries: Optional[Dict[int, str]] = None,
    include_collab_network: bool = True,
    include_pr_issue_summaries: bool = True,
) -> dict:
    """명세 v1 POST Body 생성."""
    users_raw = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else raw_json
    if not isinstance(users_raw, list):
        raise ValueError("raw_json은 {'data': [...]} 형식이어야 합니다.")

    team = {str(u.get("username", "")) for u in users_raw if u.get("username")}
    scores_by_name = {str(r["name"]): r for _, r in result_df.iterrows()}

    if pr_summaries is None or issue_summaries is None:
        gen_pr, gen_issue = run_gemini_pr_issue_summaries(raw_json)
        pr_summaries = pr_summaries if pr_summaries is not None else gen_pr
        issue_summaries = issue_summaries if issue_summaries is not None else gen_issue

    users_payload = []
    for user in users_raw:
        username = str(user.get("username", ""))
        if not username:
            continue
        row = scores_by_name.get(username)
        entry: Dict[str, Any] = {
            "username": username,
            "quantitative_score": _round_score(row["quant_score"]) if row is not None else None,
            "qualitative_score": _round_score(row["collab_score"]) if row is not None else None,
            "final_score": _round_score(row["final_score"]) if row is not None else None,
        }
        if include_collab_network:
            entry["collab_network"] = build_collab_network(username, raw_json, team)
        users_payload.append(entry)

    body: Dict[str, Any] = {"users": users_payload}
    if include_pr_issue_summaries:
        body.update(
            build_pr_issue_summary_payload(
                pr_summaries or {},
                issue_summaries or {},
                raw_json=raw_json,
            )
        )
    return body


def build_pr_issue_summary_payload(
    pr_summaries: Dict[int, str],
    issue_summaries: Dict[int, str],
    *,
    raw_json: Optional[dict] = None,
) -> Dict[str, List[dict]]:
    """PR/Issue 한 줄 요약만 분리한 payload 생성."""
    pr_catalog: Dict[int, dict] = {}
    issue_catalog: Dict[int, dict] = {}
    if raw_json is not None:
        pr_catalog, issue_catalog = _collect_pr_issue_catalog(raw_json)

    prs_payload = []
    for num, summary in sorted(pr_summaries.items()):
        if not summary or str(summary).startswith("(Gemini 오류"):
            continue
        meta = pr_catalog.get(num) or {}
        title = (meta.get("title") or "").strip()
        prs_payload.append(
            {
                "pr_number": int(num),
                "title": title,
                "pr_summary": summary,
            }
        )

    issues_payload = []
    for num, summary in sorted(issue_summaries.items()):
        if not summary or str(summary).startswith("(Gemini 오류"):
            continue
        meta = issue_catalog.get(num) or {}
        title = (meta.get("title") or "").strip()
        issues_payload.append(
            {
                "issue_number": int(num),
                "title": title,
                "issue_summary": summary,
            }
        )
    out: Dict[str, List[dict]] = {}
    if prs_payload:
        out["pull_requests"] = prs_payload
    if issues_payload:
        out["issues"] = issues_payload
    return out


def contributions_url(project_id: int, *, base_url: Optional[str] = None) -> str:
    """contributions 조회 URL (project_id 는 프로젝트마다 다름)."""
    return f"{base_url or _api_base()}/api/projects/{int(project_id)}/contributions"


def fetch_contributions(project_id: int, *, base_url: Optional[str] = None, timeout: float = 60.0) -> dict:
    import urllib.request

    url = contributions_url(project_id, base_url=base_url)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_contributions_to_data_json(
    project_id: int,
    output_path: str | os.PathLike = "data.json",
    *,
    base_url: Optional[str] = None,
    timeout: float = 60.0,
) -> tuple[dict, str]:
    """GET contributions → 전체 JSON을 data.json 등에 저장 후 반환."""
    from pathlib import Path

    url = contributions_url(project_id, base_url=base_url)
    raw = fetch_contributions(project_id, base_url=base_url, timeout=timeout)
    path = Path(output_path)
    path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return raw, url


def post_ai_analysis(
    project_id: int,
    payload: dict,
    *,
    base_url: Optional[str] = None,
    timeout: float = 120.0,
) -> dict:
    import urllib.error
    import urllib.request

    url = f"{base_url or _api_base()}/api/projects/{project_id}/ai-analysis"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"POST {url} failed ({exc.code}): {body}") from exc
