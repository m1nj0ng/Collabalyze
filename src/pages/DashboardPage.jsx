import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectOverview from '../components/ProjectOverview';
import ActivityTimeline from '../components/ActivityTimeline';
import CollaborationGraph from '../components/CollaborationGraph';
import { ActivityPieChart } from '../components/Charts';

const DashboardPage = () => {
  const navigate = useNavigate();
  
  // 역할 판별 로직 (Persona Logic)
  const getMemberPersona = (member) => {
    if (member.score >= 95) return { label: '핵심 아키텍트', color: '#4f46e5', bg: '#eef2ff' };
    if (member.score >= 90) return { label: '핵심 기여자', color: '#166534', bg: '#dcfce7' };
    if (member.issues >= 15) return { label: '버그 헌터', color: '#991b1b', bg: '#fee2e2' };
    if (member.reviews >= 25) return { label: '전문 리뷰어', color: '#075985', bg: '#e0f2fe' };
    if (member.commits >= 100) return { label: '코드 머신', color: '#854d0e', bg: '#fef9c3' };
    if (member.name === 'Charlie') return { label: '성장하는 동료', color: '#7c3aed', bg: '#f5f3ff' };
    return { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
  };

  // Mock Data
  const dashboardData = [
    { id: 1, name: 'Alice', commits: 120, reviews: 15, issues: 5, score: 95, collaborationScore: 90 }, 
    { id: 2, name: 'Bob', commits: 80, reviews: 30, issues: 12, score: 88, collaborationScore: 95 }, 
    { id: 3, name: 'Charlie', commits: 45, reviews: 10, issues: 20, score: 72, collaborationScore: 80 },
    { id: 4, name: 'Dave', commits: 110, reviews: 40, issues: 8, score: 92, collaborationScore: 85 },
    { id: 5, name: 'Eve', commits: 65, reviews: 55, issues: 3, score: 89, collaborationScore: 92 },
  ];

  return (
    <div className="dashboard" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: '800' }}>Collabalyze</h1>
        <h2 style={{ margin: 0, color: '#64748b', fontSize: '1.1rem', fontWeight: '500' }}>프로젝트 인사이트 대시보드</h2>
      </header>

      <main style={{ padding: '30px 40px' }}>
        <ProjectOverview data={dashboardData} />

        <section className="insight-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '30px' }}>
          <div className="chart-container" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#1e293b' }}>활동 타임라인</h3>
            <ActivityTimeline />
          </div>

          <div className="chart-container" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#1e293b' }}>기여도 분포</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityPieChart data={dashboardData} />
              <p style={{ margin: '15px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>* 커밋, 리뷰, 이슈 데이터 기준</p>
            </div>
          </div>

          <div className="chart-container" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', gridColumn: 'span 2', minHeight: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>상세 협업 네트워크 분석</h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <span style={{ marginRight: '15px' }}>● 노드 크기: 협업 점수</span>
                <span>━ 선 두께: 리뷰 빈도</span>
              </div>
            </div>
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd', borderRadius: '8px', border: '1px solid #f1f5f9', position: 'relative', overflow: 'hidden' }}>
              {/* 인원 증가 시 D3.js나 React-force-graph 라이브러리가 이 영역을 캔버스로 활용하게 됩니다. */}
              <CollaborationGraph data={dashboardData} />
              <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '0.75rem', color: '#94a3b8' }}>
                💡 노드를 드래그하여 위치를 조정하거나 휠로 확대/축소할 수 있습니다.
              </div>
            </div>
          </div>
        </section>

        <section className="member-list" style={{ marginTop: '40px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '20px', fontWeight: '700' }}>팀원별 상세 지표</h2>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>이름</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>Commits</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>Reviews</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>활동 인사이트</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>상세보기</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: '#1e293b' }}>{member.name}</td>
                    <td style={{ padding: '16px 24px' }}>{member.commits}</td>
                    <td style={{ padding: '16px 24px' }}>{member.reviews}</td>
                    <td style={{ padding: '16px 24px' }}>
                      {(() => {
                        const persona = getMemberPersona(member);
                        return (
                          <span style={{ color: persona.color, backgroundColor: persona.bg, padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>
                            {persona.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button onClick={() => navigate(`/detail/${member.id}`)} style={{ padding: '8px 14px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'background 0.2s' }}>인사이트 보기</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
