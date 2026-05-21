import React from 'react';

const ProjectOverview = ({ data }) => {
  const totalCommits = data.reduce((a, b) => a + b.commits, 0);
  const totalReviews = data.reduce((a, b) => a + b.reviews, 0);

  return (
    <section 
      className="project-overview" 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', // 4분할 그리드로 유연한 레이아웃 구성
        gap: '30px', 
        padding: '30px', 
        backgroundColor: '#ffffff', 
        borderRadius: '16px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        alignItems: 'center'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>프로젝트 활성도</h4>
        <p style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
          {totalCommits} 
          <span style={{ fontSize: '1rem', fontWeight: '500', color: '#475569' }}>Commits</span>
        </p>
        <p style={{ color: '#16a34a', fontSize: '0.9rem', fontWeight: '500', margin: '8px 0 0 0' }}>지난 주 대비 12% 증가</p>
      </div>
      <div style={{ borderLeft: '1px solid #e2e8f0', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>협업 밀도</h4>
        <p style={{ fontSize: '2rem', fontWeight: '700', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
          {totalReviews} 
          <span style={{ fontSize: '1rem', fontWeight: '500', color: '#475569' }}>Reviews</span>
        </p>
        <p style={{ color: '#4f46e5', fontSize: '0.9rem', fontWeight: '500', margin: '8px 0 0 0' }}>PR당 평균 피드백 2.5회</p>
      </div>
      <div style={{ gridColumn: 'span 2', borderLeft: '1px solid #e2e8f0', paddingLeft: '30px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>데이터 해석</h4>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#334155' }}>
          현재 프로젝트는 <strong>코드 리뷰 중심의 안정적인 협업</strong> 구조를 보이고 있습니다. 특정 인원에게 작업이 쏠리지 않고 고르게 분포되어 있어 병목 현상이 적습니다.
        </p>
      </div>
    </section>
  );
};
export default ProjectOverview;