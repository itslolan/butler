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

  // Calculate total income for percentage calculation
  // Sum all left-stage (depth=0) nodes EXCEPT "Overspend"
  const totalIncome = sankeyData.nodes
    .filter(n => n.depth === 0 && n.name !== 'Overspend')
    .reduce((sum, n) => {
      // If node has explicit value, use it
      if (n.value !== undefined) return sum + n.value;
      // For source nodes (income), sum OUTGOING links (they have no incoming links)
      const nodeIdx = sankeyData.nodes.indexOf(n);
      const outgoingValue = sankeyData.links
        .filter(l => l.source === nodeIdx)
        .reduce((s, l) => s + l.value, 0);
      return sum + outgoingValue;
    }, 0);

  const nodeWidth = 12;

  // Helper to render custom node
  const renderNode = (props: any) => {
    const { x, y, width, height, index, payload } = props;
    const depth = payload.depth;
    const isLeft = depth === 0;
    const isMiddle = depth === 1;
    const isOverspend = payload.name === 'Overspend';
    const isSavings = payload.name === 'Savings';
    const isIncomeSource = isLeft && !isOverspend; // Income sources on the left
    
    // Use the node's value directly (no boosting, so it's the actual value)
    const displayValue = payload.value;
    
    const percent = totalIncome > 0 ? (displayValue / totalIncome) * 100 : 0;
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
    
    // With larger nodePadding (32px), we have ample gap between nodes for labels
    // Show labels for all nodes
    const showText = true;

    // Determine label background color and text color
    // Only Overspend and Savings get colored backgrounds
    let labelBgColor = 'transparent';
    let labelTextColor = '#374151';
    let labelValueColor = '#111827';
    
    if (isOverspend) {
      labelBgColor = '#ef4444'; // Red-500
      labelTextColor = '#ffffff';
      labelValueColor = '#ffffff';
    } else if (isSavings) {
      labelBgColor = '#10b981'; // Emerald-500
      labelTextColor = '#ffffff';
      labelValueColor = '#ffffff';
    }
    // Income sources no longer get blue background - keep them clean

    // Calculate label background dimensions (approximate)
    const labelPadding = 14; // Padding inside the background around text
    const nodeGap = 8; // Gap between node and colored background
    
    // Estimate width based on BOTH lines of text (name and value)
    // Value line format: "$X.XK (XX.X%)" - typically 14-16 chars
    const valueLineLength = 16; // Approximate length of value line
    const longestLineLength = Math.max(payload.name.length, valueLineLength);
    const estimatedLabelWidth = Math.max(
      longestLineLength * 8 + labelPadding * 2, // Use 8px per char for bold text
      120
    );
    const labelHeight = 50; // Height for background
    
    // For colored backgrounds, we need proper positioning:
    // - Gap between node edge and background
    // - Uniform padding inside background around text
    const hasColoredBg = isOverspend || isSavings;
    
    let labelX: number;
    let actualTextX = textX; // Text position (may differ from base textX for colored backgrounds)
    
    if (isLeft) {
      // Left-side: text ends at textX (textAnchor='end')
      // Background ends at node edge - gap, so background ends at x - nodeGap
      // Text should end at (background end - labelPadding) = x - nodeGap - labelPadding
      if (hasColoredBg) {
        actualTextX = x - nodeGap - labelPadding;
        labelX = actualTextX - estimatedLabelWidth + labelPadding; // Background starts further left
      } else {
        labelX = textX - estimatedLabelWidth;
      }
    } else {
      // Right-side: text starts at textX (textAnchor='start')
      // Background starts at node edge + gap, so background starts at x + width + nodeGap
      // Text should start at (background start + labelPadding)
      if (hasColoredBg) {
        labelX = x + width + nodeGap;
        actualTextX = labelX + labelPadding;
      } else {
        labelX = textX;
      }
    }
    
    const labelY = y + height / 2 - labelHeight / 2;

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
          stroke={isOverspend ? '#dc2626' : 'none'}
          strokeWidth={isOverspend ? 2 : 0}
          strokeDasharray={isOverspend ? '4 2' : '0'}
        />
        
        {showText && (
          <>
            {/* Colored background for special node types (Overspend and Savings only) */}
            {(isOverspend || isSavings) && (
              <rect
                x={labelX}
                y={labelY}
                width={estimatedLabelWidth}
                height={labelHeight}
                fill={labelBgColor}
                rx={4}
                opacity={0.95}
              />
            )}
            
            <text
              x={actualTextX}
              y={y + height / 2}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="pointer-events-none"
              style={{ fontSize: '12px', fontFamily: 'system-ui, sans-serif' }}
            >
              <tspan 
                x={actualTextX} 
                dy="-0.6em" 
                style={{ fill: labelTextColor, fontWeight: 600 }}
              >
                {payload.name}
              </tspan>
              <tspan 
                x={actualTextX} 
                dy="1.4em" 
                style={{ fill: labelValueColor, fontWeight: 700, fontSize: '13px' }}
              >
                {currency ? formatCompactCurrency(displayValue) : displayValue} ({percentStr})
              </tspan>
            </text>
          </>
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
          nodePadding={32}
          nodeWidth={nodeWidth}
          iterations={64}
          margin={{ top: 10, right: 180, bottom: 10, left: 180 }}
        >
          <Tooltip 
             content={({ active, payload }) => {
               if (!active || !payload || !payload.length) return null;
               const data = payload[0];
               const isLink = data?.payload?.source !== undefined && data?.payload?.target !== undefined;
               
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
