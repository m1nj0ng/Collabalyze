import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ProjectOverview from '../components/ProjectOverview';
import ActivityTimeline from '../components/ActivityTimeline';
import CollaborationGraph from '../components/CollaborationGraph';
import { ActivityPieChart } from '../components/Charts';

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 이전 페이지(LoadingPage)에서 전달받은 projectId
  const projectId = location.state?.projectId;

  const [dashboardData, setDashboardData] = useState([]);
  const [timelineData, setTimelineData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  // 역할 판별 로직 (Persona Logic)
  const getMemberPersona = (member) => {
    if (member.score >= 95) return { label: '핵심 아키텍트', color: '#4f46e5', bg: '#eef2ff' };
    if (member.score >= 90) return { label: '핵심 기여자', color: '#166534', bg: '#dcfce7' };
    if (member.issues >= 15) return { label: '버그 헌터', color: '#991b1b', bg: '#fee2e2' };
    if (member.reviews >= 25) return { label: '전문 리뷰어', color: '#075985', bg: '#e0f2fe' };
    if (member.commits >= 100) return { label: '코드 머신', color: '#854d0e', bg: '#fef9c3' };
    if (!member.score) return { label: '분석 대기 중', color: '#64748b', bg: '#f1f5f9' }; // 분석 완료 전 처리
    return { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
  };

  useEffect(() => {
    if (!projectId) {
      setError('유효한 프로젝트 ID가 없습니다. 분석을 다시 진행해주세요.');
      setIsLoading(false);
      return;
    }

    const fetchContributions = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`http://3.39.190.222:5000/api/projects/${projectId}/contributions`);
        
        // 응답 데이터가 배열 형태(data)로 온다고 가정
        let apiData = response.data?.data || response.data;
        if (!Array.isArray(apiData)) apiData = []; // 배열이 아닌 객체(에러 등)가 왔을 때 map 에러가 발생하여 화면이 멈추는 현상 방지
        
        const mappedData = apiData.map((item, index) => {
          const quant = item['1_quantitative_data'] || {};
          const nlp = item['2_nlp_data'] || {};
          const staticCode = item['3_static_code_analysis_data'] || {};

          return {
            id: item.username || `User ${index + 1}`,
            name: item.username || `User ${index + 1}`,
            profileImage: item.profile_image || null,
            
            // 1. 정량적 데이터 매핑
            commits: Number(quant.commits) || 0,
            pullRequests: Number(quant.pull_requests) || 0,
            reviews: Number(quant.code_reviews) || 0,
            issues: Number(quant.issues) || 0,
            locAdded: Number(quant.loc_added) || 0,
            locDeleted: Number(quant.loc_deleted) || 0,
            
            // 2. 점수 데이터 (분석 전 null 대비)
            score: Number(item.final_score) || 0,
            backendCodeScore: staticCode.backend_code_score || null,
            
            // 3. NLP 및 요약 데이터 (null 필터링 적용)
            collabNetwork: nlp.collab_network || [],
            commitSummaries: (nlp.commits || []).map(c => c.commit_summary).filter(Boolean),
            changedFiles: (nlp.commits || []).flatMap(c => c.changed_files || []),
            prSummaries: (nlp.pull_requests || []).map(pr => pr.pr_summary).filter(Boolean),
            issueSummaries: (nlp.issues || []).map(i => i.issue_summary).filter(Boolean),
            rawCommits: nlp.commits || [],
          };
        });

        // 커밋 날짜(date) 데이터를 활용하여 실제 타임라인 데이터 동적 생성
        const allCommits = apiData.flatMap(user => user['2_nlp_data']?.commits || []);
        if (allCommits.length > 0) {
          const monthlyCounts = {};
          const weeklyCounts = {};
          const dailyCounts = {};
          
          allCommits.forEach(c => {
            // 백엔드 데이터 키값이 date가 아닐 수 있는 상황 대비 (created_at, timestamp 등)
            const targetDate = c.date || c.created_at || c.timestamp;
            if (!targetDate) return;
            
            // 날짜 파싱 안정성 강화
            let d = new Date(targetDate);
            if (isNaN(d.getTime()) && typeof targetDate === 'string') {
              d = new Date(targetDate.replace(' ', 'T'));
            }
            if (isNaN(d.getTime())) return; // 유효하지 않은 날짜 필터링

            // 1. 월별 (YYYY-MM)
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
            
            // 2. 일별 (YYYY-MM-DD)
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
            
            // 3. 주별 (해당 주의 월요일 기준 YYYY-MM-DD)
            const dCopy = new Date(d.getTime());
            const day = dCopy.getDay();
            const diffToMonday = dCopy.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(dCopy.setDate(diffToMonday));
            const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
            weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
          });
          
          const monthlyTimeline = Object.keys(monthlyCounts).sort().map(key => ({
            date: `${key.split('-')[0].substring(2)}년 ${key.split('-')[1]}월`, // 예: "26년 05월"
            commits: monthlyCounts[key]
          }));
          
          const weeklyTimeline = Object.keys(weeklyCounts).sort().map(key => ({
            date: `${key.split('-')[1]}/${key.split('-')[2]} 주`, // 예: "05/19 주"
            commits: weeklyCounts[key]
          }));

          const dailyTimeline = Object.keys(dailyCounts).sort().map(key => ({
            date: `${key.split('-')[1]}/${key.split('-')[2]}`, // 예: "05/19"
            commits: dailyCounts[key]
          }));
          
          setTimelineData({ monthly: monthlyTimeline, weekly: weeklyTimeline, daily: dailyTimeline });
        } else {
          // 실제 타임라인 데이터가 없을 경우 빈 상태 표시
          setTimelineData({ monthly: [], weekly: [], daily: [] });
        }
      
        setDashboardData(mappedData);
      } catch (err) {
        console.error('API Fetch Error:', err);
        setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContributions();
  }, [projectId]);

  const handleCompareSelect = (member) => {
    setSelectedForCompare(prev => {
      const isSelected = prev.some(m => m.id === member.id);
      if (isSelected) return prev.filter(m => m.id !== member.id);
      if (prev.length >= 2) {
        alert('비교 모드는 최대 2명까지만 선택할 수 있습니다.');
        return prev;
      }
      return [...prev, member];
    });
  };

  const goToCompare = () => {
    if (selectedForCompare.length !== 2) {
      alert('비교할 팀원 2명을 선택해주세요.');
      return;
    }
    navigate('/compare', { state: { members: selectedForCompare } });
  };

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1.2rem', color: '#475569', backgroundColor: '#f8fafc' }}>데이터를 분석하여 대시보드를 구성 중입니다...</div>;
  if (error) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1.2rem', color: '#ef4444', backgroundColor: '#f8fafc' }}>{error}</div>;

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
            <ActivityTimeline timelineData={timelineData} />
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
                💡 빈 공간을 드래그하여 화면을 이동하거나, 휠로 확대/축소할 수 있습니다.
              </div>
            </div>
          </div>
        </section>

        <section className="member-list" style={{ marginTop: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#1e293b', margin: 0, fontWeight: '700' }}>팀원별 상세 지표</h2>
            {selectedForCompare.length > 0 && (
              <button
                onClick={goToCompare}
                style={{
                  padding: '8px 16px',
                  backgroundColor: selectedForCompare.length === 2 ? '#10b981' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedForCompare.length === 2 ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
              >
                {selectedForCompare.length}명 선택됨 (비교하기)
              </button>
            )}
          </div>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>이름</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>Commits</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>Reviews</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>활동 인사이트</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#64748b' }}>비교</th>
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
                      <input 
                        type="checkbox" 
                        checked={selectedForCompare.some(m => m.id === member.id)}
                        onChange={() => handleCompareSelect(member)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4f46e5' }}
                      />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button onClick={() => navigate(`/detail/${member.id}`, { state: { member } })} style={{ padding: '8px 14px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'background 0.2s' }}>인사이트 보기</button>
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
