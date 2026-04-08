import React, { useRef, useEffect, useState, forwardRef } from 'react';
import type { GraphData, MemoryNode, GraphViewport, FocusMode } from './types';
import { getTopicDisplay } from './topicDisplay';

interface GraphCanvasProps {
  data: GraphData;
  viewport: GraphViewport;
  focusMode: FocusMode;
  highlightQuery?: string;
  onNodeClick: (node: MemoryNode) => void;
  onNodeHover: (node: MemoryNode | null) => void;
  onViewportChange: (viewport: GraphViewport) => void;
  onFocusMode: (nodeId: string) => void;
}

const GraphCanvas = forwardRef<HTMLCanvasElement, GraphCanvasProps>(({
  data,
  viewport,
  focusMode,
  highlightQuery,
  onNodeClick,
  onNodeHover,
  onViewportChange,
  onFocusMode,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<MemoryNode | null>(null);

  const nodeColors = {
    meeting: '#3B82F6',
    topic: '#8B5CF6',
    decision: '#10B981',
    action: '#F59E0B',
    member: '#F97316',
  };

  const nodeGlowColors = {
    meeting: '#3B82F6',
    topic: '#8B5CF6',
    decision: '#10B981',
    action: '#F59E0B',
    member: '#F97316',
  };

  // Check if a node should be highlighted based on query
  const isNodeHighlighted = (node: MemoryNode, query: string): boolean => {
    if (!query) return false;
    
    const queryLower = query.toLowerCase();
    const nodeLabel = node.label.toLowerCase();
    const nodeSummary = node.summary?.toLowerCase() || '';
    
    // Check if query matches node label or summary
    return nodeLabel.includes(queryLower) || nodeSummary.includes(queryLower);
  };

  const drawNode = (ctx: CanvasRenderingContext2D, node: MemoryNode, isHovered: boolean = false) => {
    const { x, y } = node.position;
    const size = node.size * viewport.zoom;
    const color = nodeColors[node.type];
    const glowColor = nodeGlowColors[node.type];
    
    // Check if node should be highlighted based on query
    const isHighlighted = highlightQuery ? isNodeHighlighted(node, highlightQuery) : false;
    
    // Check if node is directly connected to hovered node in focus mode
    const isDirectlyConnected = focusMode.enabled && hoveredNode && 
      data.edges.some(edge => 
        (edge.source === node.id && edge.target === hoveredNode.id) ||
        (edge.target === node.id && edge.source === hoveredNode.id)
      );
    
    // Apply focus mode opacity and highlighting
    let opacity = 1;
    let shouldGlow = isHovered || isHighlighted;
    
    if (focusMode.enabled) {
      if (hoveredNode) {
        // In focus mode with hover: highlight hovered node and directly connected nodes
        if (node.id === hoveredNode.id) {
          opacity = 1;
          shouldGlow = true;
        } else if (isDirectlyConnected) {
          opacity = 1;
          shouldGlow = true;
        } else {
          opacity = 0.2; // Dim all other nodes
        }
      } else {
        // In focus mode without hover: use original focus mode logic
        if (focusMode.dimmedNodes.includes(node.id)) {
          opacity = 0.3;
        } else {
          opacity = 1;
          shouldGlow = focusMode.relatedNodes.includes(node.id);
        }
      }
    }
    
    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw glow effect
    if (shouldGlow) {
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
      glowGradient.addColorStop(0, `${glowColor}40`);
      glowGradient.addColorStop(1, `${glowColor}00`);
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw node
    const gradient = ctx.createRadialGradient(x - size/4, y - size/4, 0, x, y, size);
    gradient.addColorStop(0, `${color}CC`);
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isHovered ? '#FFFFFF' : `${color}80`;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.stroke();

    // Draw node type icon
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
    ctx.font = `${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const iconMap = {
      meeting: '📅',
      topic: '💡',
      decision: '✅',
      action: '📋',
      member: '👤',
    };
    
    ctx.fillText(iconMap[node.type], x, y);

    // Draw label (topic labels may be stored as JSON strings — show title only)
    if (viewport.zoom > 0.5) {
      const labelText =
        node.type === 'topic' ? getTopicDisplay(node).title : node.label;
      ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
      ctx.font = `${size * 0.3}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, x, y + size + 5);
    }

    ctx.restore();
  };

  const drawEdge = (ctx: CanvasRenderingContext2D, edge: any, sourceNode: MemoryNode, targetNode: MemoryNode) => {
    const sourceX = sourceNode.position.x;
    const sourceY = sourceNode.position.y;
    const targetX = targetNode.position.x;
    const targetY = targetNode.position.y;
    
    // Check if edge connects hovered node to directly connected node in focus mode
    const isDirectlyConnectedEdge = focusMode.enabled && hoveredNode && 
      ((edge.source === hoveredNode.id && edge.target !== hoveredNode.id) ||
       (edge.target === hoveredNode.id && edge.source !== hoveredNode.id));
    
    let opacity = 0.6;
    
    if (focusMode.enabled) {
      if (hoveredNode) {
        // In focus mode with hover: highlight edges connected to hovered node
        if (isDirectlyConnectedEdge) {
          opacity = 1;
        } else {
          opacity = 0.1; // Dim all other edges
        }
      } else {
        // In focus mode without hover: use original logic
        if (focusMode.dimmedNodes.includes(edge.source) || focusMode.dimmedNodes.includes(edge.target)) {
          opacity = 0.3;
        }
      }
    }
    
    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw curved edge
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const controlX = midX + (Math.random() - 0.5) * 100;
    const controlY = midY + (Math.random() - 0.5) * 100;

    ctx.strokeStyle = edge.color || '#64748B';
    ctx.lineWidth = edge.weight * 2;
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.quadraticCurveTo(controlX, controlY, targetX, targetY);
    ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(targetY - controlY, targetX - controlX);
    const arrowLength = 10;
    const arrowX = targetX - Math.cos(angle) * (targetNode.size + 5);
    const arrowY = targetY - Math.sin(angle) * (targetNode.size + 5);

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - arrowLength * Math.cos(angle - Math.PI / 6), arrowY - arrowLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - arrowLength * Math.cos(angle + Math.PI / 6), arrowY - arrowLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();

    ctx.restore();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const gridSize = 20;
    // Use CSS custom properties for theme-aware colors
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas has proper dimensions
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas);

    // Apply viewport transformation
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw edges
    data.edges.forEach(edge => {
      const sourceNode = data.nodes.find(n => n.id === edge.source);
      const targetNode = data.nodes.find(n => n.id === edge.target);
      if (sourceNode && targetNode) {
        drawEdge(ctx, edge, sourceNode, targetNode);
      }
    });

    // Draw nodes
    data.nodes.forEach(node => {
      const isHovered = hoveredNode?.id === node.id;
      drawNode(ctx, node, isHovered);
    });

    ctx.restore();
  };

  const getNodeAtPosition = (x: number, y: number): MemoryNode | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const canvasX = (x - rect.left - viewport.x) / viewport.zoom;
    const canvasY = (y - rect.top - viewport.y) / viewport.zoom;

    for (let i = data.nodes.length - 1; i >= 0; i--) {
      const node = data.nodes[i];
      const distance = Math.sqrt(
        Math.pow(canvasX - node.position.x, 2) + Math.pow(canvasY - node.position.y, 2)
      );
      if (distance <= node.size) {
        return node;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      onViewportChange({
        ...viewport,
        x: viewport.x + deltaX,
        y: viewport.y + deltaY,
      });
      
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node !== hoveredNode) {
        setHoveredNode(node);
        onNodeHover(node);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node) {
        if (e.shiftKey) {
          onFocusMode(node.id);
        } else {
          onNodeClick(node);
        }
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, viewport.zoom * zoomFactor));
    
    onViewportChange({
      ...viewport,
      zoom: newZoom,
    });
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
  };

  useEffect(() => {
    draw();
  }, [data, viewport, focusMode, hoveredNode, highlightQuery]);

  useEffect(() => {
    // Initial setup
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    }
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Theme changed, redraw the graph
          setTimeout(() => draw(), 100); // Small delay to ensure theme is fully applied
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={(node) => {
        if (ref) {
          if (typeof ref === 'function') {
            ref(node);
          } else {
            ref.current = node;
          }
        }
        if (canvasRef) {
          canvasRef.current = node;
        }
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onMouseLeave={() => {
        setHoveredNode(null);
        onNodeHover(null);
      }}
    />
  );
});

GraphCanvas.displayName = 'GraphCanvas';

export default GraphCanvas;
