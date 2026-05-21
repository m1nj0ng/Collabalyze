import React, { useState, useRef, useEffect } from 'react';

const CollaborationGraph = ({ data }) => {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([
    { id: 'Alice', x: 200, y: 100, color: '#4f46e5', collaborationScore: 90 },
    { id: 'Bob', x: 300, y: 200, color: '#10b981', collaborationScore: 95 },
    { id: 'Charlie', x: 200, y: 300, color: '#f59e0b', collaborationScore: 80 },
    { id: 'Dave', x: 100, y: 200, color: '#ef4444', collaborationScore: 85 },
    { id: 'Eve', x: 100, y: 320, color: '#8b5cf6', collaborationScore: 92 },
  ]);

  const links = [
    { source: 'Alice', target: 'Bob', sToT: 3, tToS: 1, value: 4, bidirectional: true },
    { source: 'Bob', target: 'Charlie', sToT: 2, tToS: 0, value: 2 },
    { source: 'Charlie', target: 'Alice', sToT: 2, tToS: 0, value: 2 },
    { source: 'Dave', target: 'Alice', sToT: 3, tToS: 2, value: 5, bidirectional: true },
    { source: 'Eve', target: 'Bob', sToT: 3, tToS: 0, value: 3 },
    { source: 'Alice', target: 'Eve', sToT: 1, tToS: 1, value: 2, bidirectional: true },
  ];
  
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 400, h: 400 });
  const [draggingNode, setDraggingNode] = useState(null);

  const findNode = (id) => nodes.find(n => n.id === id);
  // 점수에 따른 노드 반경 계산 (최소 18, 최대 35 내외)
  const getRadius = (score) => (score - 70) * 0.8 + 18;

  // 드래그 핸들러
  const onMouseDown = (id) => (e) => {
    setDraggingNode(id);
    e.stopPropagation();
  };

  const onMouseMove = (e) => {
    if (!draggingNode || !svgRef.current) return;

    e.preventDefault(); // 드래그 중 브라우저 기본 스크롤 및 텍스트 선택 방지

    const svg = svgRef.current;
    const CTM = svg.getScreenCTM();
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;

    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x, y } : n));
  };

  const onMouseUp = () => setDraggingNode(null);

  // 휠 줌 핸들러
  const onWheel = (e) => {
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
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const handleWheel = (e) => {
      e.preventDefault(); // 페이지 스크롤 방지
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
        cursor: draggingNode ? 'grabbing' : 'default',
        touchAction: 'none' // 터치 환경에서 드래그 시 화면 스크롤 방지
      }}
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
        onWheel={onWheel}
      >
        {/* 연결 선 (Links) */}
        <defs>
          <marker 
            id="arrowhead" 
            markerWidth="12" 
            markerHeight="12" 
            refX="10" 
            refY="5" 
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse" // 선 두께에 상관없이 화살표 크기 고정
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="#cbd5e1" />
            <path d="M0,0 L10,5 L0,10 Z" fill="#64748b" />
          </marker>
        </defs>
        
        {links.map((link, i) => {
          const s = findNode(link.source);
          const t = findNode(link.target);
          if (!s || !t) return null;

          // 선의 양 끝점이 노드 테두리에 닿도록 계산
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const sourceR = getRadius(s.collaborationScore) + 3;
          const targetR = getRadius(t.collaborationScore) + 3;
          
          const x1 = s.x + (dx * sourceR) / dist;
          const y1 = s.y + (dy * sourceR) / dist;
          const x2 = t.x - (dx * targetR) / dist;
          const y2 = t.y - (dy * targetR) / dist;

          return (
            <line
              key={`link-${i}`}
              x1={x1} 
              y1={y1}
              x2={x2} 
              y2={y2}
              stroke="#cbd5e1"
              strokeOpacity="0.6"
              strokeWidth={link.value * 4} // 두께 차이를 더 극명하게 조정 (2.5 -> 4)
              markerStart={link.bidirectional ? "url(#arrowhead)" : undefined}
              markerEnd="url(#arrowhead)"
            >
              <title>
                {`${link.source} → ${link.target}: ${link.sToT || link.value}회`}
                {link.tToS ? `\n${link.target} → ${link.source}: ${link.tToS}회` : ''}
              </title>
            </line>
          );
        })}

        {/* 노드 (Nodes) */}
        {nodes.map((node) => (
          <g 
            key={node.id} 
            onMouseDown={onMouseDown(node.id)}
            style={{ cursor: draggingNode === node.id ? 'grabbing' : 'grab' }}
          >
            <title>{`${node.id}: 협업 점수 ${node.collaborationScore}점`}</title>
            <circle
              cx={node.x}
              cy={node.y}
              r={getRadius(node.collaborationScore)} 
              fill="white"
              stroke={node.color}
              strokeWidth={draggingNode === node.id ? "4" : "3"}
              style={{ 
                filter: draggingNode === node.id ? 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))',
                transition: 'filter 0.2s, stroke-width 0.2s'
              }}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dy=".3em"
              fill={node.color}
              style={{ fontSize: '10px', fontWeight: 'bold' }}
            >
              {node.id[0]}
            </text>
            <text
              x={node.x}
              y={node.y + getRadius(node.collaborationScore) + 16}
              textAnchor="middle"
              fill="#475569"
              style={{ fontSize: '11px', fontWeight: '600', pointerEvents: 'none' }}
            >
              {node.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default CollaborationGraph;