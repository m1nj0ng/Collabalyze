import React from 'react';

const IssueStatisticsTable = ({ data }) => {
  // 상단 열 헤더 (Column Headers)
  const statuses = ['OPEN', 'HOLDING', 'DONE', '개발', '요구사항정의', '기술검토', '검증', '계획', '모니터링'];
  
  // 멤버별 임시 통계 데이터 생성 (백엔드 세부 상태 연동 전까지 이슈 수를 분산 매핑)
  const memberStats = data.map(member => {
    const stats = {};
    statuses.forEach(status => {
      stats[status] = 0;
    });
    
    // Mock: 예시를 위해 임의의 상태에 이슈 수를 배치합니다. (실제 데이터 연동 시 수정)
    const issues = member.issues || 0;
    if (member.name === 'Alice') {
      stats['OPEN'] = 4; stats['HOLDING'] = 1; stats['DONE'] = 8; stats['개발'] = 5; stats['요구사항정의'] = 3; stats['기술검토'] = 1; stats['검증'] = 1; stats['계획'] = 1; stats['모니터링'] = 0;
    } else if (member.name === 'Bob') {
      stats['OPEN'] = 2; stats['HOLDING'] = 0; stats['DONE'] = 5; stats['개발'] = 2; stats['요구사항정의'] = 2; stats['기술검토'] = 3; stats['검증'] = 0; stats['계획'] = 1; stats['모니터링'] = 0;
    } else if (member.name === 'Charlie') {
      stats['OPEN'] = 5; stats['HOLDING'] = 2; stats['DONE'] = 10; stats['개발'] = 6; stats['요구사항정의'] = 0; stats['기술검토'] = 1; stats['검증'] = 7; stats['계획'] = 0; stats['모니터링'] = 0;
    } else if (member.name === 'Dave') {
      stats['OPEN'] = 1; stats['HOLDING'] = 1; stats['DONE'] = 2; stats['개발'] = 1; stats['요구사항정의'] = 0; stats['기술검토'] = 1; stats['검증'] = 0; stats['계획'] = 0; stats['모니터링'] = 2;
    } else if (member.name === 'Eve') {
      stats['OPEN'] = 2; stats['HOLDING'] = 0; stats['DONE'] = 4; stats['개발'] = 3; stats['요구사항정의'] = 2; stats['기술검토'] = 0; stats['검증'] = 1; stats['계획'] = 0; stats['모니터링'] = 0;
    } else if (issues > 0) {
      stats['OPEN'] = Math.ceil(issues * 0.2);
      stats['DONE'] = Math.floor(issues * 0.3);
      stats['개발'] = Math.floor(issues * 0.2);
      stats['검증'] = Math.floor(issues * 0.1);
      stats['요구사항정의'] = issues - stats['OPEN'] - stats['DONE'] - stats['개발'] - stats['검증'];
    }
    
    return {
      name: member.name,
      stats,
      total: issues
    };
  });

  // 하단 열별 총합 계산
  const columnTotals = {};
  statuses.forEach(status => {
    columnTotals[status] = memberStats.reduce((sum, member) => sum + (member.stats[status] || 0), 0);
  });
  const grandTotal = memberStats.reduce((sum, member) => sum + member.total, 0);

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto', border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem', minWidth: '800px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#334155', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Assignee</th>
            {statuses.map(status => <th key={status} style={{ padding: '14px 10px', fontWeight: '600', color: '#475569' }}>{status}</th>)}
            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#1e293b', borderLeft: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>T</th>
          </tr>
        </thead>
        <tbody>
          {memberStats.map((member, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>{member.name}</td>
              {statuses.map(status => <td key={status} style={{ padding: '12px 10px', color: '#64748b' }}>{member.stats[status] > 0 ? <span style={{ color: '#3b82f6', fontWeight: '600', cursor: 'pointer' }}>{member.stats[status]}</span> : <span style={{ color: '#cbd5e1' }}>0</span>}</td>)}
              <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1e293b', borderLeft: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>{member.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
            <td style={{ padding: '14px 16px', fontWeight: '700', color: '#1e293b', textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>Total Unique Issues:</td>
            {statuses.map(status => <td key={status} style={{ padding: '14px 10px', fontWeight: '700', color: '#3b82f6' }}>{columnTotals[status] > 0 ? columnTotals[status] : <span style={{ color: '#cbd5e1' }}>0</span>}</td>)}
            <td style={{ padding: '14px 16px', fontWeight: '900', color: '#0f172a', borderLeft: '2px solid #e2e8f0', backgroundColor: '#e2e8f0' }}>{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default IssueStatisticsTable;