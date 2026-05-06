import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserInsightCard from '../components/UserInsightCard';

const DetailPage = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();

  // 멤버별 데이터 매핑
  const memberData = {
    "1": {
      name: 'Alice',
      role: '메인 컨트리뷰터',
      contributionScore: 95,
      skills: '🛠 개발 역량: 상위 5% (모듈화 전문)',
      engagement: '💬 협업 참여도: 매우 높음',
      codeAnalysis: "클린 코드 원칙을 잘 준수하며, 특히 모듈화 능력이 뛰어납니다.",
      commitAnalysis: "평균 커밋 메시지가 명확하며, 논리적 단위로 분할하여 커밋하는 습관이 있습니다.",
      activities: ["PR #12 리뷰 수행", "Issue #4 해결 리팩토링", "신규 피처 '로그인' 구현"]
    },
    "2": {
      name: 'Bob',
      role: '아키텍트',
      contributionScore: 88,
      skills: '🛠 개발 역량: 상위 10% (시스템 설계)',
      engagement: '💬 협업 참여도: 보통',
      codeAnalysis: "시스템 전반의 구조를 파악하는 안목이 뛰어나며 코드 리뷰에 강점이 있습니다.",
      commitAnalysis: "안정적인 배포를 위해 꼼꼼한 테스트 코드를 동반한 커밋을 지향합니다.",
      activities: ["API 명세 표준화", "CI/CD 파이프라인 최적화", "주니어 코드 리뷰"]
    },
    "3": {
      name: 'Charlie',
      role: '버그 헌터',
      contributionScore: 72,
      skills: '🛠 개발 역량: 성장 중 (디버깅 전문)',
      engagement: '💬 협업 참여도: 안정적',
      codeAnalysis: "복잡한 버그 원인을 파악하고 해결하는 데 탁월한 집중력을 보입니다.",
      commitAnalysis: "빠른 피드백 반영을 위해 잦은 커밋으로 진행 상황을 공유합니다.",
      activities: ["레거시 코드 버그 수정", "문서화 작업 (README)", "UI 스타일 가이드 적용"]
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

        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ margin: 0, color: '#334155', fontSize: '1.5rem', fontWeight: '700' }}>{member.name} 님의 활동 인사이트</h2>
        </div>

        <UserInsightCard member={member} />

        <div className="analysis-card" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>전문성 및 협업 패턴 해석</h3>
          <div style={{ marginBottom: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>개발 스타일</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.codeAnalysis}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>협업 매너</p>
            <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>{member.commitAnalysis}</p>
          </div>
        </div>

        <div className="activity-history" style={{ marginTop: '30px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: '#1e293b' }}>주요 기여 포인트</h3>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {member.activities.map((a, i) => (
              <li key={i} style={{ marginBottom: '10px', color: '#334155', lineHeight: '1.5' }}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DetailPage;
