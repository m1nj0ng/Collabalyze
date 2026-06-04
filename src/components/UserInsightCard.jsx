import React from 'react';

const UserInsightCard = ({ member }) => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '30px', 
    padding: '30px', 
    backgroundColor: '#ffffff', 
    borderRadius: '16px', 
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }}>
    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
      {member.name[0]}
    </div>
    <div>
      <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {member.name}
        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e0e7ff' }}>
          {member.role || '팀원'}
        </span>
      </h2>
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#eef2ff', borderRadius: '10px', border: '1px solid #c7d2fe', flex: '1 1 auto', minWidth: '110px' }}>
          <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: '700', marginBottom: '4px' }}>종합 기여</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#312e81' }}>{member.score || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: '1 1 auto', minWidth: '110px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>활동 정량</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.quantitativeScore || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: '1 1 auto', minWidth: '110px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>협업 소통</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.collaborationScore || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: '1 1 auto', minWidth: '110px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>코드 품질</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.backendCodeScore !== null && member.backendCodeScore !== undefined ? member.backendCodeScore : 'N/A'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', flex: '1 1 auto', minWidth: '110px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Commits</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.commitsCount || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', flex: '1 1 auto', minWidth: '110px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>PRs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.prCount || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', flex: '1 1 auto', minWidth: '110px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Reviews</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.reviewsCount || 0}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', flex: '1 1 auto', minWidth: '110px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>Issues</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>{member.issuesCount || 0}</div>
        </div>
      </div>
      
      {member.skills && member.engagement && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '15px' }}>
          <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: '500' }}>{member.skills}</span>
          <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: '500' }}>{member.engagement}</span>
        </div>
      )}
    </div>
  </div>
);
export default UserInsightCard;