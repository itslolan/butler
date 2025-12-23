'use client';

import { Sankey, Tooltip, ResponsiveContainer, Rectangle, Layer } from 'recharts';
import { formatCurrency, formatCompactCurrency } from '@/lib/chart-utils';
import { ChartConfig } from '@/lib/chart-types';

interface SankeyRendererProps {
  config: ChartConfig;
  height?: number | string;
  className?: string;
}

const MyCustomNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = x + width + 6 > containerWidth;
  const isIn = x < 20;
  const isCenter = !isOut && !isIn;

  // Identify depth based on x position (approximation or pass depth in payload)
  // Our backend passes 'depth' in payload
  const depth = payload.depth;
  
  // Text positioning
  // Depth 0 (Left): Text on Left
  // Depth 1 (Center): Text on Right (or inside/below?)
  // Depth 2 (Right): Text on Right
  
  const textX = depth === 0 ? x - 6 : x + width + 6;
  const textAnchor = depth === 0 ? 'end' : 'start';
  
  // Special case for center node ("Income")
  // If it's the center node, we might want text inside or just to the right
  
  // Calculate percentage
  // We need the total income to calculate percentages.
  // The 'Income' node (depth 1) usually holds the total volume.
  // Ideally we'd have access to the total here. 
  // We can find the max value in the dataset (which should be Total Income) from context, 
  // but simpler to just show what we have.
  
  // Actually, we can just display the value and let the user see the visual proportion.
  // But the requirement asks for percentage "95.39%", "31.06%".
  // We can hack this: The backend knows the totals. 
  // Maybe we can pass percentage in the node payload from backend?
  // Recharts calculates 'value' based on links.
  
  // Let's rely on the value recharts computed.
  // To get percentage, we need the Grand Total.
  // Since we don't have it easily here without traversing, let's look at the "Income" node.
  // But we are rendering one node.
  
  // Alternative: The backend sends 'totalIncome' in the config, or we find the max value node.
  // Let's assume the node with name "Income" is 100%.
  
  return (
    <Layer key={`custom-node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.color || '#8884d8'}
        fillOpacity={0.9}
      />
      <text
        x={textX}
        y={y + height / 2}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        className="text-[10px] sm:text-xs font-medium fill-slate-700 dark:fill-slate-200"
      >
        <tspan x={textX} dy="-0.6em" fontWeight="bold">{payload.name}</tspan>
        <tspan x={textX} dy="1.2em" fillOpacity={0.7}>
          {formatCompactCurrency(payload.value)}
        </tspan>
      </text>
    </Layer>
  );
};

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
    const textX = isLeft ? x - 10 : x + width + 10;
    
    // Check if node is too small to render meaningful text
    if (height < 10) return (
      <Layer key={`custom-node-${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color || '#3b82f6'}
          fillOpacity={1}
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
          fillOpacity={1}
        />
        
        {/* Render text with label and value/percentage */}
        <text
          x={textX}
          y={y + height / 2}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className="text-xs font-sans pointer-events-none"
        >
          {/* Node Name */}
          <tspan x={textX} dy="-0.6em" className="fill-slate-600 dark:fill-slate-400 font-medium">
            {payload.name}
          </tspan>
          
          {/* Value + Percentage */}
          <tspan x={textX} dy="1.4em" className="fill-slate-900 dark:fill-slate-100 font-bold">
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
          strokeOpacity={0.4}
          onMouseEnter={(e) => {
             e.currentTarget.style.strokeOpacity = '0.7';
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.strokeOpacity = '0.4';
          }}
        />
      </Layer>
    );
  };

  return (
    <div className={`w-full ${className || ''}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          node={renderNode}
          link={renderLink}
          nodePadding={10}
          margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
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

