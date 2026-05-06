import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectOverview from '../components/ProjectOverview';
import ActivityTimeline from '../components/ActivityTimeline';
import CollaborationGraph from '../components/CollaborationGraph';
import { ActivityPieChart } from '../components/Charts';

const DashboardPage = () => {
  const navigate = useNavigate();
  
  // Mock Data
  const dashboardData = [
    { id: 1, name: 'Alice', commits: 120, reviews: 15, issues: 5, score: 95 }, 
    { id: 2, name: 'Bob', commits: 80, reviews: 30, issues: 12, score: 88 }, 
    { id: 3, name: 'Charlie', commits: 45, reviews: 10, issues: 20, score: 72 }, 
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
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#1e293b' }}>협업 네트워크</h3>
            <CollaborationGraph />
          </div>
          <div className="chart-container" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', gridColumn: 'span 2' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#1e293b' }}>작업 유형 분포</h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ActivityPieChart data={dashboardData} />
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
                      <span style={{ color: member.score >= 90 ? '#166534' : '#0369a1', backgroundColor: member.score >= 90 ? '#dcfce7' : '#e0f2fe', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600' }}>
                        {member.score >= 90 ? '핵심 기여자' : '안정적 협업자'}
                      </span>
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
