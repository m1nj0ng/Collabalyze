import React, { useState, useRef, useEffect } from 'react';

const CollaborationGraph = ({ data }) => {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 400, h: 400 });
  const [draggingNode, setDraggingNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

  // 점수에 따른 노드 반경 계산 (에러 방어 포함)
  const getRadius = (score) => {
    const num = Number(score);
    const safeScore = isNaN(num) ? 70 : num;
    return Math.max(15, (safeScore - 70) * 0.8 + 18);
  };

  const findNode = (id) => nodes.find(n => String(n.id).toLowerCase() === String(id).toLowerCase());

  useEffect(() => {
    if (!data || data.length === 0) return;

    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1'];
    
    // 1. 노드 생성 (원형으로 균등 배치)
    const radius = Math.min(120, data.length * 25);
    const centerX = 200;
    const centerY = 200;
    
    const newNodes = data.map((member, index) => {
      const angle = (index / data.length) * 2 * Math.PI;
      return {
        id: member.id,
        name: member.name || member.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        color: colors[index % colors.length],
        collaborationScore: member.score || 70, 
      };
    });

    // 2. 링크(연결선) 생성
    const newLinks = [];
    data.forEach(sourceMember => {
      let network = sourceMember.collabNetwork || [];
      if (network && !Array.isArray(network) && typeof network === 'object') {
        network = Object.entries(network).map(([k, v]) => ({ target: k, value: v }));
      }
      if (!Array.isArray(network)) network = [];

      const sourceId = String(sourceMember.id);
      
      network.forEach(edge => {
        if (!edge) return;
        
        let targetId = '';
        let value = 1;

        if (typeof edge === 'string') {
          targetId = edge;
        } else if (Array.isArray(edge)) {
          targetId = edge[0];
          value = Number(edge[1]) || 1;
        } else {
          targetId = edge.target || edge.target_user || edge.collaborator || edge.username || edge.id || edge.user || edge.name;
          value = Number(edge.value || edge.weight || edge.count || edge.score) || 1;

          if (!targetId && Object.keys(edge).length > 0) {
            const firstKey = Object.keys(edge)[0];
            targetId = firstKey;
            value = Number(edge[firstKey]) || 1;
          }
        }
        
        if (targetId) {
          targetId = String(targetId);
          if (sourceId.toLowerCase() !== targetId.toLowerCase()) {
            const existingLink = newLinks.find(l => 
              (l.source.toLowerCase() === sourceId.toLowerCase() && l.target.toLowerCase() === targetId.toLowerCase()) ||
              (l.source.toLowerCase() === targetId.toLowerCase() && l.target.toLowerCase() === sourceId.toLowerCase())
            );
          
            if (existingLink) {
              if (existingLink.source.toLowerCase() === sourceId.toLowerCase()) {
                existingLink.sToT = (existingLink.sToT || 0) + value;
              } else {
                existingLink.tToS = (existingLink.tToS || 0) + value;
              }
              existingLink.value = (existingLink.sToT || 0) + (existingLink.tToS || 0);
              existingLink.bidirectional = existingLink.sToT > 0 && existingLink.tToS > 0;
            } else {
              newLinks.push({
                source: sourceId,
                target: targetId,
                sToT: value,
                tToS: 0,
                value: value,
                bidirectional: false
              });
            }
          }
        }
      });
    });
    
    setNodes(newNodes);
    setLinks(newLinks);

    // 인원수에 맞춰 초기 뷰포트(ViewBox) 동적 조절
    const maxRange = radius * 2 + 100;
    setViewBox({ x: centerX - maxRange / 2, y: centerY - maxRange / 2, w: maxRange, h: maxRange });
  }, [data]);

  // 드래그 핸들러
  const onMouseDown = (id) => (e) => {
    setDraggingNode(id);
    e.stopPropagation();
  };

  const onBackgroundMouseDown = (e) => {
    if (e.button !== 0) return; // 왼쪽 마우스 클릭만 허용
    setIsPanning(true);
    setLastPanPos({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e) => {
    if (!svgRef.current) return;
    if (!draggingNode && !isPanning) return;

    e.preventDefault(); 

    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    if (!CTM) return;

    if (draggingNode) {
      const x = (e.clientX - CTM.e) / CTM.a;
      const y = (e.clientY - CTM.f) / CTM.d;
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x, y } : n));
    } else if (isPanning) {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      
      setViewBox(prev => ({ ...prev, x: prev.x - dx / CTM.a, y: prev.y - dy / CTM.d }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
    }
  };

  const onMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const handleWheel = (e) => {
      e.preventDefault(); 
      const scale = e.deltaY > 0 ? 1.1 : 0.9;
      
      setViewBox(prev => ({
        ...prev,
        x: prev.x + (prev.w - prev.w * scale) / 2,
        y: prev.y + (prev.h - prev.h * scale) / 2,
        w: prev.w * scale,
        h: prev.h * scale
      }));
    };

    svgElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => svgElement.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        cursor: draggingNode || isPanning ? 'grabbing' : 'grab',
        touchAction: 'none' 
      }}
      onMouseDown={onBackgroundMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg 
        ref={svgRef}
        width="100%" 
        height="400" 
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} 
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#cbd5e1" />
          </marker>
        </defs>
        
        {links.map((link, i) => {
          const s = findNode(link.source);
          const t = findNode(link.target);
          if (!s || !t) return null;

          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist === 0) return null;

          const sourceR = getRadius(s.collaborationScore) + 3;
          const targetR = getRadius(t.collaborationScore) + 3;
          
          const x1 = s.x + (dx * sourceR) / dist;
          const y1 = s.y + (dy * sourceR) / dist;
          const x2 = t.x - (dx * targetR) / dist;
          const y2 = t.y - (dy * targetR) / dist;

          return (
            <line
              key={`link-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeOpacity="0.6" strokeWidth={Math.max(2, (link.value || 1) * 4)}
              markerStart={link.bidirectional ? "url(#arrowhead)" : undefined} markerEnd="url(#arrowhead)"
            >
              <title>
                {`${link.source} → ${link.target}: ${link.sToT !== undefined ? link.sToT : link.value}회`}
                {link.tToS ? `\n${link.target} → ${link.source}: ${link.tToS}회` : ''}
              </title>
            </line>
          );
        })}

        {nodes.map((node) => (
          <g key={node.id} onMouseDown={onMouseDown(node.id)} style={{ cursor: draggingNode === node.id ? 'grabbing' : 'grab' }}>
            <title>{`${node.id}: 협업 점수 ${node.collaborationScore}점`}</title>
            <circle cx={node.x} cy={node.y} r={getRadius(node.collaborationScore)} fill="white" stroke={node.color} strokeWidth={draggingNode === node.id ? "4" : "3"} style={{ filter: draggingNode === node.id ? 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))', transition: 'filter 0.2s, stroke-width 0.2s' }} />
            <text x={node.x} y={node.y} textAnchor="middle" dy=".3em" fill={node.color} style={{ fontSize: '10px', fontWeight: 'bold' }}>{String(node.name || node.id).charAt(0).toUpperCase()}</text>
            <text x={node.x} y={node.y + getRadius(node.collaborationScore) + 16} textAnchor="middle" fill="#475569" style={{ fontSize: '11px', fontWeight: '600', pointerEvents: 'none' }}>{node.name || node.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default CollaborationGraph;