import { useState, useEffect } from 'react'
import { ContributionBarChart, ActivityPieChart } from './components/Charts'
// import { fetchProjectStats } from './api/client' // 백엔드 연동 시 주석 해제
import './App.css'

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 데이터 로딩 시뮬레이션 (API 연동 전 테스트용)
  useEffect(() => {
    const loadData = async () => {
      try {
        // 실제 API 호출 시:
        // const response = await fetchProjectStats('github-repo-url');
        // setDashboardData(response.data);
        
        // 테스트용 모의 데이터 (Mock Data)
        const mockData = [
          { name: 'Alice', commits: 120, reviews: 15, issues: 5 },
          { name: 'Bob', commits: 80, reviews: 30, issues: 12 },
          { name: 'Charlie', commits: 45, reviews: 10, issues: 20 },
          { name: 'Dave', commits: 90, reviews: 5, issues: 8 },
        ];
        
        setTimeout(() => {
          setDashboardData(mockData);
          setLoading(false);
        }, 1000); // 1초 뒤 로딩 완료
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="loading-container">데이터 분석 중...</div>;
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Collabalyze Dashboard</h1>
        <p>AI 기반 팀 프로젝트 기여도 및 협업 분석</p>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        {/* Summary Cards */}
        <section className="stats-cards">
          <div className="card">
            <h3>총 커밋 수</h3>
            <p className="big-number">{dashboardData.reduce((a, b) => a + b.commits, 0)}</p>
          </div>
          <div className="card">
            <h3>총 리뷰 활동</h3>
            <p className="big-number">{dashboardData.reduce((a, b) => a + b.reviews, 0)}</p>
          </div>
          <div className="card">
            <h3>활성 팀원</h3>
            <p className="big-number">{dashboardData.length}명</p>
          </div>
        </section>

        {/* Charts Section */}
        <section className="charts-container">
          <div className="chart-wrapper">
            <h2>팀원별 기여도 분석</h2>
            <ContributionBarChart data={dashboardData} />
          </div>
          <div className="chart-wrapper">
            <h2>협업 활동 비율</h2>
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
              <ActivityPieChart data={dashboardData} />
            </div>
          </div>
        </section>

        {/* Collaboration List */}
        <section className="collaboration-list">
          <h2>최근 협업 활동</h2>
          <ul>
            {/* 추후 API에서 받아온 리스트를 map으로 렌더링 */}
            <li>Alice님이 Bob님의 PR #12에 리뷰를 남겼습니다.</li>
            <li>Charlie님이 Issue #4에 댓글을 작성했습니다.</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
