import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import UserInsightCard from '../components/UserInsightCard';
import ActivityTimeline from '../components/ActivityTimeline';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const FilteredActivityList = ({ logs }) => {
  const [filter, setFilter] = useState('All');

  // logs 객체를 단일 배열로 평탄화하고 타입(배지 디자인) 부여
  const activities = useMemo(() => {
    const formatItem = (item, type, color, bg, index) => {
      let text = typeof item === 'string' ? item : item.text;
      let date = typeof item === 'object' && item.date ? item.date : null;
      let changedFiles = typeof item === 'object' && item.changed_files ? item.changed_files : [];
      
      let dateObj = new Date();
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          dateObj = d;
        }
      } else {
        dateObj.setDate(dateObj.getDate() - index * 2);
        dateObj.setHours(14 - index, 30, 0);
      }
      
      const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      
      return { type, text, date: dateStr, dateObj, color, bg, changedFiles };
    };

    const prs = (logs?.pullRequests || []).map((item, i) => formatItem(item, 'PR', '#10b981', '#d1fae5', i));
    const issues = (logs?.issues || []).map((item, i) => formatItem(item, 'Issue', '#ef4444', '#fee2e2', i));
    const commits = (logs?.commits || []).map((item, i) => formatItem(item, 'Commit', '#4f46e5', '#eef2ff', i));
    
    const combined = [...commits, ...prs, ...issues];
    
    // 실제 날짜(최신순)를 기준으로 통합 정렬
    combined.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    
    return combined;
  }, [logs]);

  const filteredActivities = activities.filter(a => filter === 'All' || a.type === filter);

  return (
    <div style={{ padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginTop: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>상세 활동 내역 (통합 타임라인)</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Commit', 'PR', 'Issue'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              style={{ 
                padding: '6px 14px', 
                borderRadius: '20px', 
                border: filter === f ? 'none' : '1px solid #cbd5e1', 
                backgroundColor: filter === f ? '#1e293b' : '#ffffff', 
                color: filter === f ? '#ffffff' : '#64748b',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f === 'All' ? '전체' : f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
        {filteredActivities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredActivities.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: item.bg, color: item.color, fontSize: '0.75rem', fontWeight: 'bold', minWidth: '55px', textAlign: 'center', marginTop: '2px', flexShrink: 0 }}>{item.type}</span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left', marginTop: '2px' }}>
                    <span style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.5', wordBreak: 'break-word' }}>{item.text}</span>
                  {item.changedFiles && item.changedFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {item.changedFiles.slice(0, 5).map((file, fIdx) => (
                        <span key={fIdx} style={{ padding: '2px 8px', backgroundColor: '#ffffff', color: '#64748b', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                          📄 {file.split('/').pop()}
                        </span>
                      ))}
                      {item.changedFiles.length > 5 && (
                        <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#94a3b8', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid #e2e8f0' }}>+{item.changedFiles.length - 5}</span>
                      )}
                    </div>
                  )}
                  </div>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px', textAlign: 'right' }}>{item.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.95rem', backgroundColor: '#f8fafc', borderRadius: '10px' }}>해당 활동 기록이 없습니다.</div>
        )}
      </div>
    </div>
  );
};

const DetailPage = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 컴포넌트가 마운트될 때 화면 최상단으로 스크롤 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const realMember = location.state?.member;
  const allMembers = location.state?.allMembers;

  const getMemberPersona = (memberData) => {
    const { score = 0, collaborationScore = 0, backendCodeScore = 0, commits = 0, pullRequests = 0, reviews = 0, issues = 0 } = memberData;
    if (!score) return { label: '분석 대기 중', color: '#64748b', bg: '#f1f5f9' };

    const totalActivities = commits + pullRequests + reviews + issues;

    if (backendCodeScore >= 90 && score >= 85) return { label: '핵심 아키텍트', color: '#4f46e5', bg: '#eef2ff' };
    if ((reviews > 0 && reviews / (totalActivities || 1) >= 0.25) || collaborationScore >= 90) return { label: '전문 리뷰어', color: '#075985', bg: '#e0f2fe' };
    if (issues > 0 && issues / (totalActivities || 1) >= 0.2) return { label: '버그 헌터', color: '#991b1b', bg: '#fee2e2' };
    if (pullRequests > 0 && pullRequests / (totalActivities || 1) >= 0.2) return { label: '핵심 기여자', color: '#166534', bg: '#dcfce7' };
    if (score >= 80) return { label: '올라운더', color: '#0d9488', bg: '#ecfdf5' };
    if (commits > 0 && commits / (totalActivities || 1) >= 0.75) return { label: '코드 머신', color: '#854d0e', bg: '#fef9c3' };
    
    return { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
  };

  const memberData = {
    "1": {
      name: 'Alice',
      role: '메인 컨트리뷰터',
      contributionScore: 95,
      skills: '🛠 개발 역량: 상위 5% (모듈화 전문)',
      engagement: '💬 협업 참여도: 매우 높음 (빠른 피드백)',
      codeAnalysis: "클린 코드 원칙을 잘 준수하며, 특히 모듈화 능력이 뛰어납니다.",
      commitAnalysis: "평균 커밋 메시지가 명확하며, 논리적 단위로 분할하여 커밋하는 습관이 있습니다.",
      analysis: {
        expertise: "코어 모듈의 결합도를 낮추는 리팩토링 기여도가 전체의 40% 이상입니다. 특히 인터페이스 설계에서 강점을 보입니다.",
        collaboration: "평균 PR 응답 시간이 2시간 이내로 팀 내에서 가장 빠릅니다. 코드 리뷰 시 단순 지적이 아닌 대안 코드를 제안하는 스타일입니다.",
        habit: "Semantic Commit을 엄격히 준수하여 히스토리 관리에 큰 도움을 줍니다."
      },
      analysisMetrics: {
        expertise: ["리팩토링 커밋 42%", "커밋당 평균 32줄 수정", "코드 복잡도 낮음"],
        collaboration: ["평균 PR 응답 1.5시간", "코드 제안(Suggestion) 12회"],
        habit: ["커밋 컨벤션 준수율 94%", "PR 템플릿 작성률 100%"]
      },
      radarData: [
        { subject: '구현력', A: 85, fullMark: 100 },
        { subject: '설계 능력', A: 95, fullMark: 100 },
        { subject: '소통/리뷰', A: 90, fullMark: 100 },
        { subject: '문서화', A: 75, fullMark: 100 },
        { subject: '문제해결', A: 80, fullMark: 100 },
      ],
      activities: ["PR #12 리뷰 수행", "Issue #4 해결 리팩토링", "신규 피처 '로그인' 구현"],
      metrics: { testCoverage: "85%", reviewCount: 42, avgResponseTime: "1.5h" },
      detailedLogs: {
        pullRequests: ["PR #12: 로그인 기능 모듈화", "PR #8: API 공통 핸들러 구현", "PR #5: 프로젝트 초기 설정"],
        issues: ["Issue #4: 인증 토큰 만료 버그 수정", "Issue #1: 프로젝트 구조 설계"],
        commits: ["feat: auth module 리팩토링", "docs: API 명세서 업데이트", "refactor: 인터페이스 분리"]
      },
      timelineData: {
        monthly: [
          { date: '1월', commits: 5 }, { date: '2월', commits: 12 }, { date: '3월', commits: 8 },
          { date: '4월', commits: 15 }, { date: '5월', commits: 10 }, { date: '6월', commits: 20 }
        ],
        weekly: [
          { date: '1주차', commits: 4 }, { date: '2주차', commits: 6 }, { date: '3주차', commits: 5 }, { date: '4주차', commits: 8 }
        ],
        daily: [
          { date: '월', commits: 2 }, { date: '화', commits: 4 }, { date: '수', commits: 1 }, { date: '목', commits: 3 }, { date: '금', commits: 5 }, { date: '토', commits: 2 }, { date: '일', commits: 0 }
        ]
      }
    },
    "2": {
      name: 'Bob',
      role: '아키텍트',
      contributionScore: 88,
      skills: '🛠 개발 역량: 상위 10% (시스템 설계)',
      engagement: '💬 협업 참여도: 보통',
      codeAnalysis: "시스템 전반의 구조를 파악하는 안목이 뛰어나며 코드 리뷰에 강점이 있습니다.",
      commitAnalysis: "안정적인 배포를 위해 꼼꼼한 테스트 코드를 동반한 커밋을 지향합니다.",
      activities: ["API 명세 표준화", "CI/CD 파이프라인 최적화", "주니어 코드 리뷰"],
      analysis: {
        expertise: "Infra 및 CI/CD 파이프라인 자동화의 핵심 기여자입니다. 대규모 시스템의 안정성을 확보하는 데 특화되어 있습니다.",
        collaboration: "코드 리뷰 시 보안 및 성능 관점의 피드백을 주로 남기며, 주니어 개발자들의 멘토 역할을 수행합니다.",
        habit: "배포 전 체크리스트를 철저히 확인하며, 대규모 작업보다 작고 안전한 변경을 선호합니다."
      },
      analysisMetrics: {
        expertise: ["인프라(IaC) 관련 커밋 35%", "테스트 커버리지 92%"],
        collaboration: ["시니어-주니어 리뷰 매칭률 1위", "보안 관련 피드백 28회"],
        habit: ["릴리스 노트 작성 100%", "소규모 잦은 배포 선호"]
      },
      radarData: [
        { subject: '구현력', A: 75, fullMark: 100 },
        { subject: '설계 능력', A: 95, fullMark: 100 },
        { subject: '소통/리뷰', A: 85, fullMark: 100 },
        { subject: '문서화', A: 80, fullMark: 100 },
        { subject: '문제해결', A: 90, fullMark: 100 },
      ],
      metrics: { testCoverage: "92%", reviewCount: 65, avgResponseTime: "4.2h" },
      detailedLogs: {
        pullRequests: ["PR #15: CI/CD 파이프라인 최적화", "PR #11: API 표준 가이드라인"],
        issues: ["Issue #21: 인프라 보안 취약점 점검"],
        commits: ["chore: github actions 워크플로우 수정", "test: 빌드 스크립트 안정화"]
      },
      timelineData: {
        monthly: [
          { date: '1월', commits: 8 }, { date: '2월', commits: 5 }, { date: '3월', commits: 12 },
          { date: '4월', commits: 8 }, { date: '5월', commits: 15 }, { date: '6월', commits: 10 }
        ],
        weekly: [
          { date: '1주차', commits: 3 }, { date: '2주차', commits: 7 }, { date: '3주차', commits: 2 }, { date: '4주차', commits: 5 }
        ],
        daily: [
          { date: '월', commits: 1 }, { date: '화', commits: 2 }, { date: '수', commits: 4 }, { date: '목', commits: 1 }, { date: '금', commits: 3 }, { date: '토', commits: 0 }, { date: '일', commits: 2 }
        ]
      }
    },
    "3": {
      name: 'Charlie',
      role: '버그 헌터',
      contributionScore: 72,
      skills: '🛠 개발 역량: 성장 중 (디버깅 전문)',
      engagement: '💬 협업 참여도: 안정적',
      codeAnalysis: "복잡한 버그 원인을 파악하고 해결하는 데 탁월한 집중력을 보입니다.",
      commitAnalysis: "빠른 피드백 반영을 위해 잦은 커밋으로 진행 상황을 공유합니다.",
      analysis: {
        expertise: "복잡한 레거시 코드의 흐름을 파악하여 숨겨진 엣지 케이스 버그를 찾아내는 능력이 탁월합니다.",
        collaboration: "팀원들의 피드백을 수용하는 태도가 매우 유연하며, 문제 해결 과정을 투명하게 공유합니다.",
        habit: "작업 단위를 작게 쪼개어 자주 커밋함으로써 작업 리스크를 최소화합니다."
      },
      analysisMetrics: {
        expertise: ["버그 픽스 관련 커밋 55%", "복잡도 감소 리팩토링 15회"],
        collaboration: ["리뷰 반영 속도 평균 2시간", "이슈 토론 참여율 1위"],
        habit: ["1일 평균 커밋 3.5회", "작업 단위 세분화 우수"]
      },
      radarData: [
        { subject: '구현력', A: 80, fullMark: 100 },
        { subject: '설계 능력', A: 65, fullMark: 100 },
        { subject: '소통/리뷰', A: 85, fullMark: 100 },
        { subject: '문서화', A: 70, fullMark: 100 },
        { subject: '문제해결', A: 98, fullMark: 100 },
      ],
      activities: ["레거시 코드 버그 수정", "문서화 작업 (README)", "UI 스타일 가이드 적용"],
      metrics: { testCoverage: "65%", reviewCount: 12, avgResponseTime: "3.5h" },
      detailedLogs: {
        pullRequests: ["PR #10: README.md 한글 번역", "PR #4: UI 컴포넌트 라이브러리 도입"],
        issues: ["Issue #7: UI 레이아웃 깨짐 현상 수정", "Issue #9: 모바일 반응형 대응"],
        commits: ["fix: z-index 이슈 해결", "style: 버튼 색상 통일", "docs: 설치 가이드 보완"]
      },
      timelineData: {
        monthly: [
          { date: '1월', commits: 15 }, { date: '2월', commits: 20 }, { date: '3월', commits: 18 },
          { date: '4월', commits: 25 }, { date: '5월', commits: 22 }, { date: '6월', commits: 30 }
        ],
        weekly: [
          { date: '1주차', commits: 6 }, { date: '2주차', commits: 8 }, { date: '3주차', commits: 10 }, { date: '4주차', commits: 12 }
        ],
        daily: [
          { date: '월', commits: 3 }, { date: '화', commits: 5 }, { date: '수', commits: 4 }, { date: '목', commits: 6 }, { date: '금', commits: 5 }, { date: '토', commits: 1 }, { date: '일', commits: 1 }
        ]
      }
    },
    "4": {
      name: 'Dave',
      role: 'SRE / DevOps',
      contributionScore: 91,
      skills: '🛠 개발 역량: 상위 7% (클라우드 전문)',
      engagement: '💬 협업 참여도: 매우 높음',
      codeAnalysis: "인프라 코드(IaC)의 안정성이 매우 높으며 보안 취약점 발견에 능숙합니다.",
      commitAnalysis: "변경 사항의 영향도를 명확히 기술하며 롤백 계획을 항상 포함합니다.",
      analysis: {
        expertise: "Kubernetes 환경 최적화와 모니터링 시스템 구축의 핵심 인력입니다.",
        collaboration: "Bob과 긴밀하게 소통하며 배포 자동화 프로세스를 개선했습니다.",
        habit: "작업 전후의 성능 지표 변화를 기록하는 철저한 습관이 있습니다."
      },
      analysisMetrics: {
        expertise: ["클라우드/K8s 관련 PR 80%", "장애 복구 시간 50% 단축"],
        collaboration: ["타팀(Bob) 과의 협업 로그 30회", "장애 사후 분석(Postmortem) 100%"],
        habit: ["성능 벤치마크 지표 항상 첨부", "커밋 롤백 플랜 작성"]
      },
      radarData: [
        { subject: '구현력', A: 70, fullMark: 100 },
        { subject: '설계 능력', A: 90, fullMark: 100 },
        { subject: '소통/리뷰', A: 80, fullMark: 100 },
        { subject: '문서화', A: 85, fullMark: 100 },
        { subject: '문제해결', A: 95, fullMark: 100 },
      ],
      activities: ["K8s 클러스터 업그레이드", "보안 취약점 0건 달성", "로그 시스템 구축"],
      metrics: { testCoverage: "45%", reviewCount: 120, avgResponseTime: "1.2h" },
      detailedLogs: {
        pullRequests: ["PR #40: 테라폼 코드 리팩토링", "PR #35: Helm 차트 업데이트"],
        issues: ["Issue #50: 스테이징 환경 네트워크 지연"],
        commits: ["chore: docker 이미지 최적화", "security: 의존성 보안 패치"]
      },
      timelineData: {
        monthly: [
          { date: '1월', commits: 2 }, { date: '2월', commits: 3 }, { date: '3월', commits: 5 },
          { date: '4월', commits: 4 }, { date: '5월', commits: 6 }, { date: '6월', commits: 5 }
        ],
        weekly: [
          { date: '1주차', commits: 1 }, { date: '2주차', commits: 2 }, { date: '3주차', commits: 1 }, { date: '4주차', commits: 2 }
        ],
        daily: [
          { date: '월', commits: 0 }, { date: '화', commits: 1 }, { date: '수', commits: 0 }, { date: '목', commits: 2 }, { date: '금', commits: 1 }, { date: '토', commits: 0 }, { date: '일', commits: 0 }
        ]
      }
    },
    "5": {
      name: 'Eve',
      role: 'UI/UX 엔지니어',
      contributionScore: 85,
      skills: '🛠 개발 역량: 상위 15% (디자인 시스템)',
      engagement: '💬 협업 참여도: 매우 높음',
      codeAnalysis: "컴포넌트의 재사용성을 극대화하며 스타일 가이드를 엄격히 준수합니다.",
      commitAnalysis: "시각적 변경 사항을 스크린샷과 함께 상세히 공유합니다.",
      analysis: {
        expertise: "전사 디자인 시스템 구축 및 접근성 표준 준수의 리더입니다.",
        collaboration: "기획자 및 디자이너와 개발팀 사이의 훌륭한 가교 역할을 합니다.",
        habit: "코드 리뷰 시 사용자 경험(UX) 관점의 피드백을 가장 많이 남깁니다."
      },
      analysisMetrics: {
        expertise: ["재사용 컴포넌트 20종 구축", "웹 접근성(A11y) 100% 달성"],
        collaboration: ["타직군 멘션 비율 45%", "UX 리뷰 피드백 38회"],
        habit: ["UI 변경 시 스냅샷 자동화", "시각적 자료(스크린샷) 첨부율 90%"]
      },
      radarData: [
        { subject: '구현력', A: 85, fullMark: 100 },
        { subject: '설계 능력', A: 80, fullMark: 100 },
        { subject: '소통/리뷰', A: 95, fullMark: 100 },
        { subject: '문서화', A: 90, fullMark: 100 },
        { subject: '문제해결', A: 75, fullMark: 100 },
      ],
      activities: ["공통 컴포넌트 라이브러리 제작", "접근성 검사 수행", "메인 대시보드 UI 구현"],
      metrics: { testCoverage: "88%", reviewCount: 95, avgResponseTime: "2.5h" },
      detailedLogs: {
        pullRequests: [
          "PR #22: 다크모드 테마 적용", 
          "PR #18: 차트 라이브러리 교체",
          "PR #15: 공통 UI 컴포넌트 모듈화",
          "PR #14: 접근성(A11y) 가이드라인 적용",
          "PR #11: 메인 페이지 반응형 디자인 적용"
        ],
        issues: [
          "Issue #12: 폰트 렌더링 최적화",
          "Issue #9: 특정 브라우저에서 버튼 정렬 깨짐 제보",
          "Issue #5: 다크모드 전환 시 번쩍임 현상 완화 필요"
        ],
        commits: [
          "feat: 디자인 시스템 1.0 배포", 
          "refactor: 컬러 변수 정리",
          "fix: 모바일 해상도 네비게이션 바 겹침 버그 수정",
          "style: Primary 버튼 호버 애니메이션 추가",
          "chore: 미사용 SVG 아이콘 에셋 제거",
          "feat: 모달 컴포넌트 접근성(aria-label) 속성 추가",
          "docs: UI 스토리북(Storybook) 문서화 업데이트",
          "test: 주요 화면 UI 스냅샷 테스트 추가",
          "fix: 텍스트 입력 창 포커스 아웃라인 일관성 유지"
        ]
      },
      timelineData: {
        monthly: [
          { date: '1월', commits: 10 }, { date: '2월', commits: 12 }, { date: '3월', commits: 9 },
          { date: '4월', commits: 18 }, { date: '5월', commits: 14 }, { date: '6월', commits: 16 }
        ],
        weekly: [
          { date: '1주차', commits: 4 }, { date: '2주차', commits: 5 }, { date: '3주차', commits: 3 }, { date: '4주차', commits: 6 }
        ],
        daily: [
          { date: '월', commits: 2 }, { date: '화', commits: 2 }, { date: '수', commits: 3 }, { date: '목', commits: 4 }, { date: '금', commits: 3 }, { date: '토', commits: 0 }, { date: '일', commits: 0 }
        ]
      }
    }
  };

  const generateTimeline = (commits) => {
    const monthlyCounts = {};
    const weeklyCounts = {};
    const dailyCounts = {};
    
    (commits || []).forEach(c => {
      const targetDate = c.date || c.created_at || c.timestamp;
      if (!targetDate) return;

      let d = new Date(targetDate);
      if (isNaN(d.getTime()) && typeof targetDate === 'string') {
        d = new Date(targetDate.replace(' ', 'T'));
      }
      if (isNaN(d.getTime())) return;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
      
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      
      const dCopy = new Date(d.getTime());
      const day = dCopy.getDay();
      const diffToMonday = dCopy.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dCopy.setDate(diffToMonday));
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
    });
    
    return {
      monthly: Object.keys(monthlyCounts).sort().map(key => ({ date: `${key.split('-')[0].substring(2)}년 ${key.split('-')[1]}월`, commits: monthlyCounts[key] })),
      weekly: Object.keys(weeklyCounts).sort().map(key => ({ date: `${key.split('-')[1]}/${key.split('-')[2]} 주`, commits: weeklyCounts[key] })),
      daily: Object.keys(dailyCounts).sort().map(key => ({ date: `${key.split('-')[1]}/${key.split('-')[2]}`, commits: dailyCounts[key] }))
    };
  };

  // 개인별 타임라인 Mock 데이터 (API 연동 시 실제 데이터로 동적 교체 가능)
  const defaultTimelineData = {
    monthly: [
      { date: '1월', commits: 4 }, { date: '2월', commits: 8 }, { date: '3월', commits: 5 },
      { date: '4월', commits: 12 }, { date: '5월', commits: 7 }, { date: '6월', commits: 15 }
    ],
    weekly: [
      { date: '1주차', commits: 2 }, { date: '2주차', commits: 5 }, { date: '3주차', commits: 3 }, { date: '4주차', commits: 6 }
    ],
    daily: [
      { date: '월', commits: 1 }, { date: '화', commits: 3 }, { date: '수', commits: 0 }, { date: '목', commits: 2 }, { date: '금', commits: 4 }, { date: '토', commits: 1 }, { date: '일', commits: 0 }
    ]
  };

  // 실제 회원의 데이터를 기반으로 레이더 차트 동적 생성 로직
  const generateRadarData = (memberStats, teamMembers) => {
    if (!memberStats) return baseMember.radarData || [];
    const membersToCompare = teamMembers && teamMembers.length > 0 ? teamMembers : [memberStats];

    // 팀 내 최고점 계산
    const maxCommits = Math.max(...membersToCompare.map(m => (m.commits || 0) + (m.pullRequests || 0)), 1);
    const maxReviews = Math.max(...membersToCompare.map(m => m.reviews || 0), 1);
    const maxIssues = Math.max(...membersToCompare.map(m => m.issues || 0), 1);
    const maxBackendScore = Math.max(...membersToCompare.map(m => m.backendCodeScore || 0), 1);
    const maxCollabScore = Math.max(...membersToCompare.map(m => m.collaborationScore || 0), 1);
    
    const { commits = 0, pullRequests = 0, reviews = 0, issues = 0, score = 0, backendCodeScore = 0, collaborationScore = 0 } = memberStats;
    
    const base = 15; // 변별력을 위해 기본 점수 하향
    const scale = 85; // 점수 범위를 15-100으로 매핑
    
    const implementation = base + (((commits + pullRequests) / maxCommits) * scale);
    const design = base + (((backendCodeScore || 0) / maxBackendScore) * scale);
    const communication = base + ((reviews / maxReviews) * 0.7 + ((collaborationScore || 0) / maxCollabScore) * 0.3) * scale;
    const documentation = base + (((collaborationScore || 0) / maxCollabScore) * 0.6 + (((pullRequests + issues) / (maxCommits + maxIssues))) * 0.4) * scale;
    const problemSolving = base + ((issues / maxIssues) * scale);

    return [
      { subject: '구현력', A: Math.min(100, Math.round(implementation)), fullMark: 100 },
      { subject: '설계 능력', A: Math.min(100, Math.round(design)), fullMark: 100 },
      { subject: '소통/리뷰', A: Math.min(100, Math.round(communication)), fullMark: 100 },
      { subject: '문서화', A: Math.min(100, Math.round(documentation)), fullMark: 100 },
      { subject: '문제해결', A: Math.min(100, Math.round(problemSolving)), fullMark: 100 },
    ];
  };

  const maxStats = useMemo(() => {
    const teamMembersToCompare = allMembers && allMembers.length > 0 ? allMembers : [realMember || {}];
    return {
      score: Math.max(...teamMembersToCompare.map(m => m.score || 0), 0),
      commits: Math.max(...teamMembersToCompare.map(m => m.commits || 0), 0),
      pullRequests: Math.max(...teamMembersToCompare.map(m => m.pullRequests || 0), 0),
      reviews: Math.max(...teamMembersToCompare.map(m => m.reviews || 0), 0),
      issues: Math.max(...teamMembersToCompare.map(m => m.issues || 0), 0),
    };
  }, [allMembers, realMember]);

  const baseMember = realMember || memberData[memberId] || memberData["1"];
  
  // 실제 데이터 또는 Mock 데이터를 통합한 객체
  const member = {
    ...baseMember,
    name: realMember ? realMember.name : baseMember.name,
    role: realMember ? getMemberPersona(realMember).label : baseMember.role,
    
    // 본인 기여도 표시 (실제 데이터 우선)
    score: realMember ? realMember.score : baseMember.contributionScore,
    quantitativeScore: realMember ? realMember.quantitativeScore : 0,
    collaborationScore: realMember ? realMember.collaborationScore : 0,
    backendCodeScore: realMember ? realMember.backendCodeScore : null,
    commitsCount: realMember ? realMember.commits : 0,
    prCount: realMember ? realMember.pullRequests : 0,
    reviewsCount: realMember ? realMember.reviews : 0,
    issuesCount: realMember ? realMember.issues : 0,
    
    // NLP 분석 텍스트 (추후 백엔드에서 제공할 키값을 우선 참조하고, 없으면 안내 문구 노출)
    codeAnalysis: realMember ? (realMember.codeAnalysis || "AI 코드 분석이 수행되었습니다. 향후 백엔드에서 구체적인 요약 텍스트를 제공하면 이곳에 표시됩니다.") : baseMember.codeAnalysis,
    commitAnalysis: realMember ? (realMember.commitAnalysis || "커밋 히스토리를 분석하여 협업 패턴을 도출합니다.") : baseMember.commitAnalysis,
    analysis: realMember ? {
      expertise: realMember.analysis?.expertise || "주로 다룬 파일과 커밋 내용을 바탕으로 핵심 전문 분야를 파악합니다.",
      collaboration: realMember.analysis?.collaboration || "PR과 리뷰 기록을 기반으로 한 협업 성향입니다.",
      habit: realMember.analysis?.habit || "코드 변경 스타일과 커밋 주기를 나타냅니다."
    } : baseMember.analysis,
    
    analysisMetrics: realMember ? {
      expertise: [`총 기여 점수 ${realMember.score || 0}점`, `총 커밋 ${realMember.commits || 0}회`],
      collaboration: [`코드 리뷰 ${realMember.reviews || 0}회 참여`, `PR 생성 ${realMember.pullRequests || 0}건`],
      habit: [`참여 이슈 ${realMember.issues || 0}건`]
    } : baseMember.analysisMetrics,
    
    // 실제 요약 데이터 리스트 매핑
    detailedLogs: realMember ? {
      pullRequests: realMember.prSummaries || [],
      issues: realMember.issueSummaries || [],
      commits: realMember.commitSummaries || []
    } : baseMember.detailedLogs,
    
    // 최근 기여 포인트
    activities: realMember ? [
      ...(realMember.prSummaries || []).map(pr => pr.text).slice(0, 2),
      ...(realMember.commitSummaries || []).map(c => c.text).slice(0, 2)
    ] : baseMember.activities,
    
    // 타임라인 데이터
    timelineData: realMember 
      ? generateTimeline(realMember.rawCommits || []) 
      : (baseMember.timelineData || defaultTimelineData),
      
    // 부가 정보
    skills: realMember ? null : baseMember.skills,
    engagement: realMember ? null : baseMember.engagement,
    
    radarData: realMember ? generateRadarData(realMember, allMembers) : baseMember.radarData,
    
    // 주로 다룬 파일 확장자 (탑 3) 추출
    topFiles: realMember ? (() => {
      const files = realMember.changedFiles || [];
      if (!files.length) return [];
      const counts = {};
      files.forEach(f => {
        const ext = f.includes('.') ? f.split('.').pop() : f.split('/').pop();
        const name = f.includes('.') ? `*.${ext}` : ext;
        counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    })() : ["*.js", "*.jsx", "*.css"],
  };

  return (
    <div className="detail-page" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '40px 20px', fontFamily: '"Inter", sans-serif', color: '#1e293b' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0, color: '#1e293b', fontSize: '1.75rem', fontWeight: '800' }}>Collabalyze</h1>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 18px', backgroundColor: '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
            ← 대시보드로 돌아가기
          </button>
        </header>

        <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, color: '#334155', fontSize: '1.5rem', fontWeight: '700' }}>{member.name} 님의 활동 인사이트</h2>
          {(() => {
            const persona = realMember ? getMemberPersona(realMember) : { label: member.role, color: '#4f46e5', bg: '#eef2ff' };
            return <span style={{ color: persona.color, backgroundColor: persona.bg, padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '700' }}>{persona.label}</span>;
          })()}
        </div>

        <UserInsightCard member={member} />

        {/* 방사형 차트와 텍스트 해석을 좌우 또는 상하로 배치하기 위한 Grid 구조 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px', marginTop: '30px' }}>
          
          {/* 1. 레이더 차트 카드 */}
          <div style={{ padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.1rem', color: '#1e293b' }}>개발자 역량 밸런스</h3>
            <div style={{ flex: 1, minHeight: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={member.radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={member.name} dataKey="A" stroke="#4f46e5" strokeWidth={2} fill="#4f46e5" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. 전문성 분석 텍스트 및 메트릭 칩 카드 */}
          <div className="analysis-card" style={{ padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>전문성 및 협업 패턴 해석</h3>
            
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>🛠 개발 스타일</p>
              <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.95rem' }}>{member.codeAnalysis} {member.analysis?.expertise}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {member.analysisMetrics?.expertise?.map((m, i) => <span key={i} style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>{m}</span>)}
            {!!realMember && (member.score || 0) > 0 && (member.score || 0) === maxStats.score && <span style={{ padding: '4px 10px', backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #fde047' }}>점수 1위</span>}
            {!!realMember && (member.commitsCount || 0) > 0 && (member.commitsCount || 0) === maxStats.commits && <span style={{ padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #bbf7d0' }}>커밋 1위</span>}
                {member.topFiles?.length > 0 && (
                  <span style={{ padding: '4px 10px', backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #c7d2fe' }}>주요 다룬 파일: {member.topFiles.join(', ')}</span>
                )}
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>💬 협업 매너</p>
              <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.95rem' }}>{member.commitAnalysis} {member.analysis?.collaboration}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {member.analysisMetrics?.collaboration?.map((m, i) => <span key={i} style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>{m}</span>)}
            {!!realMember && (member.reviewsCount || 0) > 0 && (member.reviewsCount || 0) === maxStats.reviews && <span style={{ padding: '4px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #bae6fd' }}>리뷰 1위</span>}
            {!!realMember && (member.prCount || 0) > 0 && (member.prCount || 0) === maxStats.pullRequests && <span style={{ padding: '4px 10px', backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #c7d2fe' }}>PR 1위</span>}
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>⏱ 작업 습관</p>
              <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.95rem' }}>{member.analysis?.habit}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {member.analysisMetrics?.habit?.map((m, i) => <span key={i} style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>{m}</span>)}
            {!!realMember && (member.issuesCount || 0) > 0 && (member.issuesCount || 0) === maxStats.issues && <span style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #fecaca' }}>이슈 처리 1위</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="activity-timeline-card" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>개인 활동 타임라인</h3>
          <ActivityTimeline timelineData={member.timelineData || defaultTimelineData} />
        </div>

        <div className="activity-history" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>최근 기여 포인트</h3>
          {member.activities.length > 0 ? (
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {member.activities.map((a, i) => (
                <li key={i} style={{ marginBottom: '10px', color: '#334155', lineHeight: '1.5' }}>{a}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>최근 기여 내역이 없습니다.</p>
          )}
        </div>

        <FilteredActivityList logs={member.detailedLogs} />
      </div>
    </div>
  );
};

export default DetailPage;