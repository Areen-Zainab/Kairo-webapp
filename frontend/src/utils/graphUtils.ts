import type { MemoryNode, MemoryEdge, GraphViewport } from '../components/workspace/memory/types';

export const calculateNodePosition = (
  node: MemoryNode,
  viewport: GraphViewport
): { x: number; y: number } => {
  return {
    x: (node.position.x + viewport.x) * viewport.zoom,
    y: (node.position.y + viewport.y) * viewport.zoom,
  };
};

export const getNodeAtPosition = (
  x: number,
  y: number,
  nodes: MemoryNode[],
  viewport: GraphViewport
): MemoryNode | null => {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const { x: nodeX, y: nodeY } = calculateNodePosition(node, viewport);
    const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
    
    if (distance <= node.size * viewport.zoom) {
      return node;
    }
  }
  return null;
};

export const calculateEdgePath = (
  sourceNode: MemoryNode,
  targetNode: MemoryNode,
  curved: boolean = true
): string => {
  const sourceX = sourceNode.position.x;
  const sourceY = sourceNode.position.y;
  const targetX = targetNode.position.x;
  const targetY = targetNode.position.y;

  if (!curved) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  // Calculate control point for curved edge
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  // Add some randomness for visual appeal
  const controlX = midX + (Math.random() - 0.5) * 100;
  const controlY = midY + (Math.random() - 0.5) * 100;

  return `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
};

export const calculateGraphBounds = (nodes: MemoryNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} => {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach(node => {
    const size = node.size;
    minX = Math.min(minX, node.position.x - size);
    minY = Math.min(minY, node.position.y - size);
    maxX = Math.max(maxX, node.position.x + size);
    maxY = Math.max(maxY, node.position.y + size);
  });

  return { minX, minY, maxX, maxY };
};

export const fitGraphToViewport = (
  nodes: MemoryNode[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 50
): GraphViewport => {
  const bounds = calculateGraphBounds(nodes);
  
  if (bounds.minX === Infinity) {
    return { x: 0, y: 0, zoom: 1, minZoom: 0.1, maxZoom: 3 };
  }

  const graphWidth = bounds.maxX - bounds.minX;
  const graphHeight = bounds.maxY - bounds.minY;
  
  const scaleX = (viewportWidth - padding * 2) / graphWidth;
  const scaleY = (viewportHeight - padding * 2) / graphHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  return {
    x: viewportWidth / 2 - centerX * scale,
    y: viewportHeight / 2 - centerY * scale,
    zoom: scale,
    minZoom: 0.1,
    maxZoom: 3
  };
};

export const animateToNode = (
  nodeId: string,
  nodes: MemoryNode[],
  currentViewport: GraphViewport,
  viewportWidth: number,
  viewportHeight: number
): GraphViewport => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return currentViewport;

  const targetX = viewportWidth / 2 - node.position.x;
  const targetY = viewportHeight / 2 - node.position.y;

  return {
    ...currentViewport,
    x: targetX,
    y: targetY,
    zoom: Math.max(0.5, currentViewport.zoom) // Ensure minimum zoom for visibility
  };
};

export const exportGraphAsPNG = (
  canvas: HTMLCanvasElement,
  filename: string = 'memory-graph.png'
): void => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

export const exportGraphAsSVG = (
  nodes: MemoryNode[],
  edges: MemoryEdge[],
  filename: string = 'memory-graph.svg'
): void => {
  const bounds = calculateGraphBounds(nodes);
  const width = bounds.maxX - bounds.minX + 100;
  const height = bounds.maxY - bounds.minY + 100;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add edges
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (sourceNode && targetNode) {
      const path = calculateEdgePath(sourceNode, targetNode, edge.curved);
      svg += `<path d="${path}" stroke="${edge.color}" stroke-width="${edge.weight}" fill="none" opacity="${edge.opacity}"/>`;
    }
  });
  
  // Add nodes
  nodes.forEach(node => {
    const { x, y } = node.position;
    svg += `<circle cx="${x}" cy="${y}" r="${node.size}" fill="${node.color}" opacity="${node.opacity}"/>`;
    svg += `<text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="12">${node.label}</text>`;
  });
  
  svg += '</svg>';

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportGraphAsJSON = (
  nodes: MemoryNode[],
  edges: MemoryEdge[],
  filename: string = 'memory-graph.json'
): void => {
  const data = { nodes, edges, timestamp: new Date().toISOString() };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};
