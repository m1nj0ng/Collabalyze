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
      
      <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>기여 점수</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4f46e5' }}>{member.score || 0}점</div>
        </div>
        <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Commits</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>{member.commitsCount || 0}</div>
        </div>
        <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>PRs</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>{member.prCount || 0}</div>
        </div>
        <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Reviews</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>{member.reviewsCount || 0}</div>
        </div>
        <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Issues</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>{member.issuesCount || 0}</div>
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