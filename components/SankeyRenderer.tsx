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
    // Fallback: sum of level 0 links if Income node value isn't pre-calculated/populated
    sankeyData.links.filter(l => l.target === sankeyData.nodes.findIndex(n => n.name === 'Income'))
      .reduce((sum, l) => sum + l.value, 0);

  // Helper to render custom node with closure access to totalIncome
  const renderNode = (props: any) => {
    const { x, y, width, height, index, payload } = props;
    const depth = payload.depth;
    const isLeft = depth === 0;
    
    // Calculate percentage
    // For Income node, it's 100%
    // For others, value / totalIncome
    const value = payload.value;
    const percent = totalIncome > 0 ? (value / totalIncome) * 100 : 0;
    const percentStr = `${percent.toFixed(1)}%`;

    const textAnchor = isLeft ? 'end' : 'start';
    const textX = isLeft ? x - 15 : x + width + 15;
    
    // Check if node is too small to render meaningful text
    if (height < 8) return (
      <Layer key={`custom-node-${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color || '#3b82f6'}
          fillOpacity={0.95}
          rx={2}
        />
      </Layer>
    );

    return (
      <Layer key={`custom-node-${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color || '#3b82f6'}
          fillOpacity={0.95}
          rx={2}
        />
        
        {/* Render text with label and value/percentage */}
        <text
          x={textX}
          y={y + height / 2}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className="text-sm font-sans pointer-events-none"
        >
          {/* Node Name */}
          <tspan x={textX} dy="-0.7em" className="fill-slate-700 dark:fill-slate-300 font-semibold">
            {payload.name}
          </tspan>
          
          {/* Value + Percentage */}
          <tspan x={textX} dy="1.5em" className="fill-slate-900 dark:fill-slate-100 font-bold text-base">
            {currency ? formatCompactCurrency(value) : value} ({percentStr})
          </tspan>
        </text>
      </Layer>
    );
  };

  // Helper to render custom link with color from payload
  const renderLink = (props: any) => {
    const { sourceX, sourceY, targetX, targetY, linkWidth, payload } = props;
    const color = payload.color || '#e2e8f0';
    
    // Calculate curvature
    // Recharts doesn't pass 'd' directly to custom link component in all versions, 
    // but usually does if we don't override it? 
    // Actually, Recharts passes 'd' if we wrap the default link, but we can't easily import DefaultLink.
    // Let's implement a standard Sankey link path (horizontal bezier).
    
    const curvature = 0.5;
    const x0 = sourceX + props.sourceControlX; // props usually has sourceControlX?
    // Let's rely on standard SVG path for Sankey
    // M sourceX,sourceY C (sourceX + w*k),sourceY (targetX - w*k),targetY targetX,targetY
    // linkWidth is the stroke width.
    
    // Actually, let's just inspect if `d` is passed.
    // If not, we might be safer using `stroke` prop on the Sankey component if it supports function... it doesn't.
    // Recharts 2.x `Sankey` `link` prop function receives standard props including `d`? 
    // Let's assume yes, or we can use a simple curve.
    
    // Note: Recharts calculates the path 'd' for us if we don't provide it? 
    // If we provide a component, we must render the path.
    // Fortunately, the props usually contain everything needed.
    
    // Let's try to access `d` from props.
    // If `d` is not present, we can compute a simple cubic bezier:
    // M sourceX,sourceY C (sourceX + (targetX-sourceX)/2),sourceY (sourceX + (targetX-sourceX)/2),targetY targetX,targetY
    
    const sx = sourceX;
    const sy = sourceY + linkWidth / 2;
    const tx = targetX;
    const ty = targetY + linkWidth / 2;
    const midX = (sx + tx) / 2;
    
    const d = `M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`;
    
    return (
      <Layer key={`custom-link-${props.index}`}>
        <path
          d={d}
          stroke={color}
          strokeWidth={Math.max(1, linkWidth)}
          fill="none"
          strokeOpacity={0.3}
          onMouseEnter={(e) => {
             e.currentTarget.style.strokeOpacity = '0.6';
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.strokeOpacity = '0.3';
          }}
        />
      </Layer>
    );
  };

  return (
    <div className={`w-full ${className || ''} overflow-visible`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          node={renderNode}
          link={renderLink}
          nodePadding={60}
          nodeWidth={20}
          iterations={64}
          margin={{ top: 50, right: 220, bottom: 50, left: 220 }}
        >
          <Tooltip 
             content={({ active, payload }) => {
               if (!active || !payload || !payload.length) return null;
               const data = payload[0];
               // Sankey tooltip payload is a bit different
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
               
               // Node Tooltip
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

