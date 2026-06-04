import React, { useState, useEffect, useCallback, Suspense } from 'react';

// 라이브러리 로딩 문제로 인한 렌더링 오류 방지를 위해 Dynamic Import 적용
const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));

const CollaborationGraph = ({ data }) => {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);

  // 점수에 따른 노드 반경 계산 (에러 방어 포함)
  const getRadius = (score) => {
    const num = Number(score);
    const safeScore = isNaN(num) ? 70 : num; // score가 "N/A" 등 문자열일 때 NaN이 되는 것을 100% 방어
    return Math.max(15, (safeScore - 70) * 0.8 + 18);
  };

  useEffect(() => {
    if (!data || data.length === 0) return;

    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1'];
    
    // 1. 노드 생성 (x, y 좌표 계산은 라이브러리가 담당하므로 제거)
    const newNodes = data.map((member, index) => ({
      id: member.id,
      name: member.name || member.id,
      color: colors[index % colors.length],
      collaborationScore: member.score || 70, // 점수가 없으면 기본 크기를 위해 70 부여
    }));

    // 2. 링크(연결선) 생성
    const newLinks = [];
    data.forEach(sourceMember => {
      let network = sourceMember.collabNetwork || [];
      // 방어 코드 1: network가 배열이 아니라 { "Bob": 3, "Charlie": 2 } 형태의 객체일 경우 배열로 변환
      if (network && !Array.isArray(network) && typeof network === 'object') {
        network = Object.entries(network).map(([k, v]) => ({ target: k, value: v }));
      }
      
      if (!Array.isArray(network)) network = [];

      const sourceNode = newNodes.find(n => n.id === sourceMember.id);
      if (!sourceNode) return;
      const sourceId = String(sourceMember.id);
      
      network.forEach(edge => {
        if (!edge) return;
        
        let targetId = '';
        let value = 1;

        // 백엔드 응답이 문자열, 배열, 혹은 여러 key를 가진 객체일 경우를 모두 지원하도록 유연하게 추출
        if (typeof edge === 'string') {
          targetId = edge;
        } else if (Array.isArray(edge)) {
          targetId = edge[0];
          value = Number(edge[1]) || 1;
        } else {
          // target_username 필드 매핑 추가
          targetId = edge.target || edge.target_username || edge.target_user || edge.collaborator || edge.username || edge.id || edge.user || edge.name;
          
          // weight 값이 0인 경우를 정확히 인식하기 위해 || 대신 ??(Null 병합 연산자) 사용
          const rawValue = edge.weight ?? edge.value ?? edge.count ?? edge.score;
          value = rawValue !== undefined ? Number(rawValue) : 1;

          // 방어 코드 2: 명시적 key가 없고 { "Bob": 3 } 처럼 이름이 Key인 경우 추출
          if (!targetId && Object.keys(edge).length > 0) {
            const firstKey = Object.keys(edge)[0];
            targetId = firstKey;
            value = Number(edge[firstKey]) || 1;
          }
        }
        
        // 가중치(weight)가 0인 경우 서로 교류가 없는 것이므로 선을 연결하지 않음
        if (value <= 0) return;
        
        if (targetId) {
          targetId = String(targetId);
          const targetNode = newNodes.find(n => String(n.id).toLowerCase() === targetId.toLowerCase());

          if (targetNode && sourceId.toLowerCase() !== targetId.toLowerCase()) {
            // 단방향(A->B) 기준으로만 링크를 병합 (양방향은 별도의 선으로 분리)
            const existingLink = newLinks.find(l => 
              l.source.toLowerCase() === sourceId.toLowerCase() && l.target.toLowerCase() === targetId.toLowerCase()
            );
          
            if (existingLink) {
              existingLink.value += value;
            } else {
              newLinks.push({
                source: sourceId,
                target: targetId,
                value: value
              });
            }
          }
        }
      });
    });
    
    // 양방향 통신이 있는 경우, 선이 서로 겹치지 않도록 곡률(curvature)을 줍니다.
    newLinks.forEach(link => {
      const hasReverse = newLinks.find(l => 
        l.source.toLowerCase() === link.target.toLowerCase() && 
        l.target.toLowerCase() === link.source.toLowerCase()
      );
      link.curvature = hasReverse ? 0.15 : 0;
    });
    
    setNodes(newNodes);
    setLinks(newLinks);
  }, [data]);

  // 노드 커스텀 렌더링 (Canvas 기반)
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    // 방어 코드: 좌표가 아직 없거나 NaN일 경우 캔버스 렌더링 크래시 완전 차단
    if (!node || typeof node.x !== 'number' || isNaN(node.x) || typeof node.y !== 'number' || isNaN(node.y)) return;

    const label = node.name || node.id;
    const radius = getRadius(node.collaborationScore);
    const scale = globalScale > 0 ? globalScale : 1; // 0으로 나누기 오류 방지
    
    // 노드 원 그리기
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 3 / scale; // 줌 레벨에 따라 선 두께 보정
    ctx.stroke();

    // 원 안에 이니셜 텍스트
    const initialFontSize = radius * 0.9; // 원 크기에 비례하는 폰트 크기
    ctx.font = `bold ${initialFontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = node.color;
    ctx.fillText(String(label).charAt(0).toUpperCase(), node.x, node.y);
    
    // 노드 아래 이름 텍스트
    const labelFontSize = 12 / scale;
    ctx.font = `600 ${labelFontSize}px Inter, sans-serif`;
    ctx.fillStyle = '#475569';
    ctx.fillText(label, node.x, node.y + radius + (16 / globalScale));
  }, []);

  // 링크 위에 마우스 올렸을 때 툴팁 내용
  const linkLabel = useCallback(link => {
    // 라이브러리 내부 동작에 의해 link.source가 ID(문자열) 또는 노드(객체)일 수 있음을 모두 처리
    const srcName = typeof link.source === 'object' ? (link.source.name || link.source.id) : link.source;
    const tgtName = typeof link.target === 'object' ? (link.target.name || link.target.id) : link.target;

    return `
      <div style="padding: 5px; background-color: rgba(0,0,0,0.7); color: white; border-radius: 4px; font-size: 0.8rem;">
        ${srcName} → ${tgtName}: ${link.value}회
      </div>
    `;
  }, []);

  return (
    <Suspense fallback={<div style={{ color: '#64748b' }}>그래프를 로딩 중입니다...</div>}>
      <ForceGraph2D
        graphData={{ nodes, links }}
        // 노드 설정
        nodeId="id"
        nodeVal={node => getRadius(node.collaborationScore) * 1.5} // 충돌 반경
        nodeCanvasObject={nodeCanvasObject}
        nodeLabel={node => `${node.name}: 협업 점수 ${node.collaborationScore}점`}
        // 링크 설정
        linkWidth={link => Math.max(1, (link.value || 1) * 1.5)}
        linkColor={() => 'rgba(100, 116, 139, 0.5)'}
        linkCurvature={link => link.curvature || 0}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        // 툴팁 설정
        linkLabel={linkLabel}
        // 상호작용 설정
        onNodeDragEnd={node => {
          node.fx = node.x; // 드래그가 끝나면 노드 위치 고정
          node.fy = node.y;
        }}
        // 물리 엔진 설정
        cooldownTicks={200} // 시뮬레이션 안정화 시간
        d3AlphaDecay={0.05} // 시뮬레이션 감쇠율
      />
    </Suspense>
  );
};

export default CollaborationGraph;