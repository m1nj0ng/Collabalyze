"""
기본 흐름:
  1) GET .../api/projects/{project_id}/contributions → data.json 저장
  2) 분석 엔진 실행 → analysis_result.* 생성
  3) (선택) POST .../api/projects/{project_id}/ai-analysis

사용 예:
  python main.py --project-id 1
  python main.py -p 2
  set PROJECT_ID=3 && python main.py

로컬 data.json 만 쓰려면:
  python main.py --local
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

from ai_analysis_api import (
    build_ai_analysis_payload,
    build_pr_issue_summary_payload,
    fetch_contributions_to_data_json,
    post_ai_analysis,
    run_gemini_pr_issue_summaries,
)
from ai_engine import GitHubInsightEngine
from ai_engine import SCORE_CONFIG, SCORE_NO_ACTIVITY, has_quant_activity, static_score_for_row


INPUT_PATH = Path("data.json")
OUTPUT_JSON_PATH = Path("analysis_result.json")
OUTPUT_CSV_PATH = Path("analysis_result.csv")
OUTPUT_GEMINI_COMMITS_CSV_PATH = Path("analysis_result_gemini_commits.csv")
OUTPUT_API_PAYLOAD_PATH = Path("ai_analysis_payload.json")
OUTPUT_PR_ISSUE_SUMMARY_PATH = Path("ai_analysis_pr_issue_summaries.json")


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name, "1" if default else "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _resolve_project_id(args: argparse.Namespace) -> int | None:
    if args.local:
        return None
    if args.project_id is not None:
        return int(args.project_id)
    env_pid = os.environ.get("PROJECT_ID", "").strip()
    if env_pid:
        return int(env_pid)
    return None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="contributions API → data.json → 분석 엔진")
    parser.add_argument(
        "-p",
        "--project-id",
        type=int,
        default=None,
        help="프로젝트 ID (URL의 /projects/1/ 에서 1 부분). 미지정 시 환경 변수 PROJECT_ID 사용",
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="API 호출 없이 기존 data.json 만으로 분석",
    )
    parser.add_argument(
        "--no-post",
        action="store_true",
        help="분석 후 백엔드 ai-analysis POST 생략",
    )
    parser.add_argument(
        "--rebuild-payload-only",
        action="store_true",
        help="기존 data.json + analysis_result.csv로 ai_analysis payload만 재생성(전체 분석 미실행)",
    )
    return parser.parse_args()


def _load_existing_pr_issue_summaries() -> tuple[dict[int, str], dict[int, str]]:
    pr_summaries: dict[int, str] = {}
    issue_summaries: dict[int, str] = {}

    # 분리 파일이 있으면 우선 사용
    if OUTPUT_PR_ISSUE_SUMMARY_PATH.is_file():
        with open(OUTPUT_PR_ISSUE_SUMMARY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for row in data.get("pull_requests", []) or []:
            try:
                pr_summaries[int(row["pr_number"])] = str(row.get("pr_summary", "") or "")
            except (TypeError, ValueError, KeyError):
                continue
        for row in data.get("issues", []) or []:
            try:
                issue_summaries[int(row["issue_number"])] = str(row.get("issue_summary", "") or "")
            except (TypeError, ValueError, KeyError):
                continue
        return pr_summaries, issue_summaries

    # 기존 통합 payload 백업 파일에서 추출
    if OUTPUT_API_PAYLOAD_PATH.is_file():
        with open(OUTPUT_API_PAYLOAD_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for row in data.get("pull_requests", []) or []:
            try:
                pr_summaries[int(row["pr_number"])] = str(row.get("pr_summary", "") or "")
            except (TypeError, ValueError, KeyError):
                continue
        for row in data.get("issues", []) or []:
            try:
                issue_summaries[int(row["issue_number"])] = str(row.get("issue_summary", "") or "")
            except (TypeError, ValueError, KeyError):
                continue
    return pr_summaries, issue_summaries


def _apply_static_backend_only_scores(raw_json: dict, result_df: pd.DataFrame) -> pd.DataFrame:
    """기존 분석결과 DF에 backend_code_score 기반 static/final 점수만 재적용."""
    users_raw = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else raw_json
    row_by_name: dict[str, dict] = {}
    if isinstance(users_raw, list):
        for user in users_raw:
            username = str(user.get("username", "")).strip()
            if not username:
                continue
            q = user.get("1_quantitative_data", {}) or {}
            s = user.get("3_static_code_analysis_data", {}) or {}
            row_by_name[username] = {
                "commits": q.get("commits", 0),
                "loc_added": q.get("loc_added", 0),
                "pull_requests": q.get("pull_requests", 0),
                "issues": q.get("issues", 0),
                "code_reviews": q.get("code_reviews", 0),
                "backend_score": s.get("backend_code_score"),
            }

    df = result_df.copy()
    if "name" not in df.columns:
        return df

    def _static_for_name(name: str) -> float:
        base = row_by_name.get(str(name), {})
        if not base:
            return SCORE_NO_ACTIVITY
        return static_score_for_row(base)

    df["static_backend_score"] = df["name"].map(_static_for_name).astype(float)
    if "static_score" in df.columns:
        df["static_score"] = df["static_backend_score"]
    if "static_complexity_score" in df.columns:
        df["static_complexity_score"] = pd.NA
    if "static_complexity_weight_effective" in df.columns:
        df["static_complexity_weight_effective"] = 0.0
    if "static_backend_weight_effective" in df.columns:
        df["static_backend_weight_effective"] = 1.0

    required = {"quant_score", "collab_score", "static_score", "final_score"}
    if required.issubset(df.columns):
        wq, wc, ws = SCORE_CONFIG["w_quant"], SCORE_CONFIG["w_collab"], SCORE_CONFIG["w_static"]
        denom = wq + wc + ws
        df["final_score"] = (df["quant_score"] * wq + df["collab_score"] * wc + df["static_score"] * ws) / denom
        for _, r in df.iterrows():
            name = str(r["name"])
            base = row_by_name.get(name, {})
            if base and not has_quant_activity(base) and float(base.get("loc_added", 0) or 0) == 0:
                df.loc[df["name"] == name, "final_score"] = SCORE_NO_ACTIVITY
    return df


def main() -> None:
    args = _parse_args()
    project_id = _resolve_project_id(args)
    base_url = os.environ.get("AI_ANALYSIS_API_BASE", "").strip() or None
    post = project_id is not None and not args.no_post and _env_flag("POST_AI_ANALYSIS", default=True)

    if args.rebuild_payload_only:
        if not INPUT_PATH.is_file() or not OUTPUT_CSV_PATH.is_file():
            print(
                "오류: --rebuild-payload-only 사용 시 data.json 과 analysis_result.csv 가 모두 필요합니다.",
                file=sys.stderr,
            )
            sys.exit(1)
        with open(INPUT_PATH, "r", encoding="utf-8") as f:
            raw_json = json.load(f)
        result_df = pd.read_csv(OUTPUT_CSV_PATH)
        result_df = _apply_static_backend_only_scores(raw_json, result_df)

        pr_summaries, issue_summaries = _load_existing_pr_issue_summaries()
        api_payload = build_ai_analysis_payload(
            raw_json,
            result_df,
            pr_summaries=pr_summaries,
            issue_summaries=issue_summaries,
            include_collab_network=True,
            include_pr_issue_summaries=False,
        )
        summary_payload = build_pr_issue_summary_payload(
            pr_summaries, issue_summaries, raw_json=raw_json
        )

        with open(OUTPUT_API_PAYLOAD_PATH, "w", encoding="utf-8") as f:
            json.dump(api_payload, f, ensure_ascii=False, indent=2)
        with open(OUTPUT_PR_ISSUE_SUMMARY_PATH, "w", encoding="utf-8") as f:
            json.dump(summary_payload, f, ensure_ascii=False, indent=2)

        print("[payload-only] ai_analysis payload 재생성 완료 (전체 분석 미실행)")
        print(f"  {OUTPUT_API_PAYLOAD_PATH}, {OUTPUT_PR_ISSUE_SUMMARY_PATH}")
        if post and project_id is not None:
            try:
                merged_payload = dict(api_payload)
                merged_payload.update(summary_payload)
                resp = post_ai_analysis(project_id, merged_payload, base_url=base_url)
                print(f"--- 백엔드 저장 (POST .../projects/{project_id}/ai-analysis) ---")
                print(json.dumps(resp, ensure_ascii=False, indent=2))
            except Exception as exc:
                print(f"[경고] 백엔드 POST 실패: {exc}")
        return

    if project_id is not None:
        print(f"[1/3] contributions 수집 (project_id={project_id}) …")
        raw_json, url = fetch_contributions_to_data_json(
            project_id, INPUT_PATH, base_url=base_url
        )
        print(f"      저장 완료: {INPUT_PATH}")
        print(f"      URL: {url}")
        input_source = url
    else:
        if not INPUT_PATH.is_file():
            print(
                "오류: project_id 가 없고 data.json 도 없습니다.\n"
                "  python main.py --project-id 1\n"
                "  또는 set PROJECT_ID=1 후 실행",
                file=sys.stderr,
            )
            sys.exit(1)
        with open(INPUT_PATH, "r", encoding="utf-8") as file:
            raw_json = json.load(file)
        input_source = str(INPUT_PATH)
        print(f"[1/3] 로컬 파일 사용: {INPUT_PATH}")

    print("[2/3] 분석 엔진 실행 …")
    engine = GitHubInsightEngine()
    result_df = engine.analyze(raw_json)
    frontend_payload = engine.build_frontend_payload(result_df)

    result_df.to_csv(OUTPUT_CSV_PATH, index=False, encoding="utf-8-sig")
    commit_rows = result_df.attrs.get("gemini_commit_detail_rows") or []
    _gccols = ["name", "commit_idx", "commit_message", "gemini_commit_summary"]
    pd.DataFrame(commit_rows, columns=_gccols).to_csv(
        OUTPUT_GEMINI_COMMITS_CSV_PATH, index=False, encoding="utf-8-sig"
    )
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as file:
        json.dump(frontend_payload, file, ensure_ascii=False, indent=2, allow_nan=False)

    pr_summaries, issue_summaries = run_gemini_pr_issue_summaries(raw_json)
    api_payload = build_ai_analysis_payload(
        raw_json,
        result_df,
        pr_summaries=pr_summaries,
        issue_summaries=issue_summaries,
        include_collab_network=True,
        include_pr_issue_summaries=False,
    )
    summary_payload = build_pr_issue_summary_payload(
        pr_summaries, issue_summaries, raw_json=raw_json
    )
    with open(OUTPUT_API_PAYLOAD_PATH, "w", encoding="utf-8") as file:
        json.dump(api_payload, file, ensure_ascii=False, indent=2)
    with open(OUTPUT_PR_ISSUE_SUMMARY_PATH, "w", encoding="utf-8") as file:
        json.dump(summary_payload, file, ensure_ascii=False, indent=2)

    print("[3/3] 결과 파일 저장 완료")
    print("--- GitHub 인사이트 분석 완료 ---")
    print(f"입력: {input_source}")
    print(f"  {OUTPUT_JSON_PATH}, {OUTPUT_CSV_PATH}, {OUTPUT_GEMINI_COMMITS_CSV_PATH}")
    print()
    print(result_df[["name", "final_score", "quant_score", "collab_score", "static_score", "anomaly_status"]])

    if post and project_id is not None:
        try:
            merged_payload = dict(api_payload)
            merged_payload.update(summary_payload)
            resp = post_ai_analysis(project_id, merged_payload, base_url=base_url)
            print()
            print(f"--- 백엔드 저장 (POST .../projects/{project_id}/ai-analysis) ---")
            print(json.dumps(resp, ensure_ascii=False, indent=2))
        except Exception as exc:
            print()
            print(f"[경고] 백엔드 POST 실패: {exc}")
    elif project_id is not None and args.no_post:
        print()
        print("--no-post: 백엔드 전송을 건너뜁니다.")


if __name__ == "__main__":
    main()
