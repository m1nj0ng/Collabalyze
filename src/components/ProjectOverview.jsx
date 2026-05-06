import React from 'react';

const ProjectOverview = ({ data }) => {
  const totalCommits = data.reduce((a, b) => a + b.commits, 0);
  const totalReviews = data.reduce((a, b) => a + b.reviews, 0);

  return (
    <section className="project-overview" style={{ display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#f0f4f8', borderRadius: '12px', margin: '20px' }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>프로젝트 활성도</h4>
        <p style={{ fontSize: '1.8em', fontWeight: 'bold', margin: 0 }}>{totalCommits} <span style={{ fontSize: '0.5em', fontWeight: 'normal' }}>Commits</span></p>
        <p style={{ color: '#2ea44f', fontSize: '0.9rem' }}>지난 주 대비 12% 증가</p>
      </div>
      <div style={{ flex: 1, borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>협업 밀도</h4>
        <p style={{ fontSize: '1.8em', fontWeight: 'bold', margin: 0 }}>{totalReviews} <span style={{ fontSize: '0.5em', fontWeight: 'normal' }}>Reviews</span></p>
        <p style={{ color: '#0969da', fontSize: '0.9rem' }}>평균 코드 리뷰 참여율 높음</p>
      </div>
      <div style={{ flex: 2, borderLeft: '1px solid #ccc', paddingLeft: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>데이터 해석</h4>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>현재 프로젝트는 <strong>코드 리뷰 중심의 안정적인 협업</strong> 구조를 보이고 있습니다. 특정 인원에게 작업이 쏠리지 않고 고르게 분포되어 있어 병목 현상이 적습니다.</p>
      </div>
    </section>
  );
};
export default ProjectOverview;