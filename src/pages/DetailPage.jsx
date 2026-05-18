import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserInsightCard from '../components/UserInsightCard';

// 활동 세부 내역을 보여주는 서브 컴포넌트
const ActivitySection = ({ title, items, icon }) => (
  <div style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
    <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span> {title}
    </h3>
    <ul style={{ paddingLeft: '20px', margin: 0 }}>
      {items && items.length > 0 ? (
        items.map((item, i) => (
          <li key={i} style={{ marginBottom: '8px', color: '#475569', fontSize: '0.9rem', lineHeight: '1.4' }}>{item}</li>
        ))
      ) : (
        <li style={{ color: '#94a3b8', fontSize: '0.9rem', listStyle: 'none', marginLeft: '-20px' }}>기록이 없습니다.</li>
      )}
    </ul>
  </div>
);

const DetailPage = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();

  // 멤버별 데이터 매핑
  const getMemberPersona = (name) => {
    const personaMap = {
      "Alice": { label: '핵심 아키텍트', color: '#4F46E5', bg: '#EEF2FF' },
      "Bob": { label: '전문 리뷰어', color: '#D97706', bg: '#FFFBEB' },
      "Charlie": { label: '버그 헌터', color: '#DC2626', bg: '#FEF2F2' },
      "Dave": { label: '인프라 마스터', color: '#059669', bg: '#ECFDF5' },
      "Eve": { label: 'UI/UX 디자이너', color: '#0891B2', bg: '#ECFEFF' }
    };
    return personaMap[name] || { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
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
      activities: ["PR #12 리뷰 수행", "Issue #4 해결 리팩토링", "신규 피처 '로그인' 구현"],
      metrics: { testCoverage: "85%", reviewCount: 42, avgResponseTime: "1.5h" },
      detailedLogs: {
        pullRequests: ["PR #12: 로그인 기능 모듈화", "PR #8: API 공통 핸들러 구현", "PR #5: 프로젝트 초기 설정"],
        issues: ["Issue #4: 인증 토큰 만료 버그 수정", "Issue #1: 프로젝트 구조 설계"],
        commits: ["feat: auth module 리팩토링", "docs: API 명세서 업데이트", "refactor: 인터페이스 분리"]
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
      metrics: { testCoverage: "92%", reviewCount: 65, avgResponseTime: "4.2h" },
      detailedLogs: {
        pullRequests: ["PR #15: CI/CD 파이프라인 최적화", "PR #11: API 표준 가이드라인"],
        issues: ["Issue #21: 인프라 보안 취약점 점검"],
        commits: ["chore: github actions 워크플로우 수정", "test: 빌드 스크립트 안정화"]
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
      activities: ["레거시 코드 버그 수정", "문서화 작업 (README)", "UI 스타일 가이드 적용"],
      metrics: { testCoverage: "65%", reviewCount: 12, avgResponseTime: "3.5h" },
      detailedLogs: {
        pullRequests: ["PR #10: README.md 한글 번역", "PR #4: UI 컴포넌트 라이브러리 도입"],
        issues: ["Issue #7: UI 레이아웃 깨짐 현상 수정", "Issue #9: 모바일 반응형 대응"],
        commits: ["fix: z-index 이슈 해결", "style: 버튼 색상 통일", "docs: 설치 가이드 보완"]
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
      activities: ["K8s 클러스터 업그레이드", "보안 취약점 0건 달성", "로그 시스템 구축"],
      metrics: { testCoverage: "45%", reviewCount: 120, avgResponseTime: "1.2h" },
      detailedLogs: {
        pullRequests: ["PR #40: 테라폼 코드 리팩토링", "PR #35: Helm 차트 업데이트"],
        issues: ["Issue #50: 스테이징 환경 네트워크 지연"],
        commits: ["chore: docker 이미지 최적화", "security: 의존성 보안 패치"]
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
      activities: ["공통 컴포넌트 라이브러리 제작", "접근성 검사 수행", "메인 대시보드 UI 구현"],
      metrics: { testCoverage: "88%", reviewCount: 95, avgResponseTime: "2.5h" },
      detailedLogs: {
        pullRequests: ["PR #22: 다크모드 테마 적용", "PR #18: 차트 라이브러리 교체"],
        issues: ["Issue #12: 폰트 렌더링 최적화"],
        commits: ["feat: 디자인 시스템 1.0 배포", "refactor: 컬러 변수 정리"]
      }
    }
  };

  // 해당 ID가 없으면 기본값으로 Alice 데이터를 보여줌
  const member = memberData[memberId] || memberData["1"];

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
            const persona = getMemberPersona(member.name);
            return <span style={{ color: persona.color, backgroundColor: persona.bg, padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '700' }}>{persona.label}</span>;
          })()}
        </div>

        <UserInsightCard member={member} />

        <div className="analysis-card" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>전문성 및 협업 패턴 해석</h3>
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>개발 스타일</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.codeAnalysis}</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.analysis?.expertise}</p>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>협업 매너</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.commitAnalysis}</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.analysis?.collaboration}</p>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>작업 습관</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.analysis?.habit}</p>
          </div>
        </div>

        <div className="activity-history" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>최근 기여 포인트</h3>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {member.activities.map((a, i) => (
              <li key={i} style={{ marginBottom: '10px', color: '#334155', lineHeight: '1.5' }}>{a}</li>
            ))}
          </ul>
        </div>

        <div className="detailed-activity-section" style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <ActivitySection title="Pull Requests" items={member.detailedLogs?.pullRequests} icon="🔀" />
          <ActivitySection title="Issues" items={member.detailedLogs?.issues} icon="🎫" />
          <ActivitySection title="Commits" items={member.detailedLogs?.commits} icon="📝" />
        </div>
      </div>
    </div>
  );
};

export default DetailPage;
