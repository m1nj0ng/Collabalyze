import React from 'react';

const CollaborationGraph = () => {
  // 시뮬레이션을 위한 데이터 (누가 누구의 코드를 리뷰했는지 등)
  const relations = [
    { from: 'Alice', to: 'Bob', label: 'Review' },
    { from: 'Bob', to: 'Charlie', label: 'Review' },
    { from: 'Charlie', to: 'Alice', label: 'PR Approved' },
  ];

  return (
    <div style={{ width: '100%', height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', borderRadius: '8px', border: '1px dashed #ccc' }}>
      <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
        {['Alice', 'Bob', 'Charlie'].map(name => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0969da', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 5px', fontSize: '0.8rem' }}>
              {name[0]}
            </div>
            <span style={{ fontSize: '0.8rem', color: '#555' }}>{name}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#666', textAlign: 'left', width: '80%' }}>
        <ul style={{ paddingLeft: '20px', margin: 0 }}>
          {relations.map((rel, i) => (
            <li key={i}>
              <strong>{rel.from}</strong> &rarr; <strong>{rel.to}</strong> ({rel.label})
            </li>
          ))}
        </ul>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '15px' }}>
        * 실제 Git PR/Review 데이터를 기반으로 연결망이 구성됩니다.
      </p>
    </div>
  );
};

export default CollaborationGraph;