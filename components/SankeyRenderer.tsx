'use client';

import { Sankey, Tooltip, ResponsiveContainer, Rectangle, Layer } from 'recharts';
import { formatCurrency, formatCompactCurrency } from '@/lib/chart-utils';
import { ChartConfig } from '@/lib/chart-types';

interface SankeyRendererProps {
  config: ChartConfig;
  height?: number | string;
  className?: string;
}

export default function SankeyRenderer({ config, height = 400, className }: SankeyRendererProps) {
  const { sankeyData, currency } = config;

  if (!sankeyData || !sankeyData.nodes || !sankeyData.links) {
    return <div className="flex items-center justify-center h-full">No data</div>;
  }

  // Find total income for percentage calculation
  const incomeNode = sankeyData.nodes.find(n => n.name === 'Income');
  const totalIncome = incomeNode?.value || 
    sankeyData.links.filter(l => l.target === sankeyData.nodes.findIndex(n => n.name === 'Income'))
      .reduce((sum, l) => sum + l.value, 0);

  const nodeWidth = 12;

  // Helper to render custom node
  const renderNode = (props: any) => {
    const { x, y, width, height, index, payload } = props;
    const depth = payload.depth;
    const isLeft = depth === 0;
    const isMiddle = depth === 1;
    
    const value = payload.value;
    const percent = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
    const percentStr = `${percent.toFixed(1)}%`;

    // Position text based on node depth
    let textAnchor: 'start' | 'end' | 'middle' = 'start';
    let textX = x + width + 8;
    
    if (isLeft) {
      textAnchor = 'end';
      textX = x - 8;
    } else if (isMiddle) {
      textAnchor = 'start';
      textX = x + width + 8;
    }
    
    // Skip text for very small nodes
    const showText = height >= 20;

    return (
      <Layer key={`custom-node-${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color || '#3b82f6'}
          fillOpacity={1}
          rx={1}
        />
        
        {showText && (
          <text
            x={textX}
            y={y + height / 2}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            className="pointer-events-none"
            style={{ fontSize: '12px', fontFamily: 'system-ui, sans-serif' }}
          >
            <tspan 
              x={textX} 
              dy="-0.6em" 
              style={{ fill: '#374151', fontWeight: 600 }}
            >
              {payload.name}
            </tspan>
            <tspan 
              x={textX} 
              dy="1.4em" 
              style={{ fill: '#111827', fontWeight: 700, fontSize: '13px' }}
            >
              {currency ? formatCompactCurrency(value) : value} ({percentStr})
            </tspan>
          </text>
        )}
      </Layer>
    );
  };

  // Helper to render filled ribbon links
  const renderLink = (props: any) => {
    const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload, index } = props;
    const color = payload.color || '#94a3b8';
    
    // Recharts provides sourceY/targetY as the CENTER of the link band
    // We need to calculate top and bottom edges
    const halfWidth = linkWidth / 2;
    const sy0 = sourceY - halfWidth;  // Top edge at source
    const sy1 = sourceY + halfWidth;  // Bottom edge at source
    const ty0 = targetY - halfWidth;  // Top edge at target
    const ty1 = targetY + halfWidth;  // Bottom edge at target
    
    // Use control points if available, otherwise calculate midpoint
    const scx = sourceControlX !== undefined ? sourceControlX : sourceX + (targetX - sourceX) * 0.4;
    const tcx = targetControlX !== undefined ? targetControlX : targetX - (targetX - sourceX) * 0.4;
    
    // Create smooth filled ribbon path
    const d = `
      M${sourceX},${sy0}
      C${scx},${sy0} ${tcx},${ty0} ${targetX},${ty0}
      L${targetX},${ty1}
      C${tcx},${ty1} ${scx},${sy1} ${sourceX},${sy1}
      Z
    `;
    
    return (
      <Layer key={`custom-link-${index}`}>
        <path
          d={d}
          fill={color}
          fillOpacity={0.35}
          stroke="none"
          style={{ transition: 'fill-opacity 0.15s ease-out' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.fillOpacity = '0.55';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.fillOpacity = '0.35';
          }}
        />
      </Layer>
    );
  };

  return (
    <div className={`w-full h-full ${className || ''}`} style={typeof height === 'number' ? { height: `${height}px` } : { height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          node={renderNode}
          link={renderLink}
          nodePadding={12}
          nodeWidth={nodeWidth}
          iterations={64}
          margin={{ top: 10, right: 140, bottom: 10, left: 140 }}
        >
          <Tooltip 
             content={({ active, payload }) => {
               if (!active || !payload || !payload.length) return null;
               const data = payload[0];
               const isLink = data.payload.source && data.payload.target;
               
               if (isLink) {
                 const sourceName = data.payload.source.name;
                 const targetName = data.payload.target.name;
                 const val = data.value;
                 return (
                   <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50 text-xs">
                     <p className="font-medium text-gray-900 dark:text-white mb-1">
                       {sourceName} → {targetName}
                     </p>
                     <p className="text-blue-600 dark:text-blue-400 font-bold">
                       {currency ? formatCurrency(val) : val}
                     </p>
                   </div>
                 );
               }
               
               return (
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50 text-xs">
                     <p className="font-medium text-gray-900 dark:text-white mb-1">
                       {data.payload.name}
                     </p>
                     <p className="text-blue-600 dark:text-blue-400 font-bold">
                       {currency ? formatCurrency(data.value) : data.value}
                     </p>
                   </div>
               );
             }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
