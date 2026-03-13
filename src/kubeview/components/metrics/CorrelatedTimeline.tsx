/**
 * CorrelatedTimeline - Synchronized time ruler for the Correlation View
 *
 * Features:
 * - Horizontal time axis with event markers
 * - Drag-to-select time range (brush)
 * - Hover synchronization across charts
 * - Event markers with tooltips
 */

import React, { useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface TimelineEvent {
  timestamp: number;
  label: string;
  type: 'event' | 'alert' | 'change';
  color: string;
}

export interface CorrelatedTimelineProps {
  timeRange: [number, number];        // [start, end] unix seconds
  onTimeRangeChange: (range: [number, number]) => void;
  onHoverTime: (timestamp: number | null) => void;
  hoverTime: number | null;
  events?: TimelineEvent[];
}

const EVENT_MARKERS = {
  event: '●',
  alert: '▲',
  change: '■',
} as const;

export function CorrelatedTimeline({
  timeRange,
  onTimeRangeChange,
  onHoverTime,
  hoverTime,
  events = [],
}: CorrelatedTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  const [minTime, maxTime] = timeRange;
  const height = 60;
  const padding = { left: 60, right: 60, top: 10, bottom: 20 };
  const timelineWidth = containerWidth - padding.left - padding.right;

  // Scale function: timestamp -> x position
  const xScale = (timestamp: number): number => {
    return padding.left + ((timestamp - minTime) / (maxTime - minTime)) * timelineWidth;
  };

  // Inverse scale: x position -> timestamp
  const xScaleInverse = (x: number): number => {
    return minTime + ((x - padding.left) / timelineWidth) * (maxTime - minTime);
  };

  // Format time label
  const formatTimeLabel = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const range = maxTime - minTime;

    if (range < 3600) {
      // Less than 1 hour: HH:MM
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (range < 86400) {
      // Less than 1 day: HH:MM
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // More than 1 day: MMM DD HH:MM
      return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  // Generate time ticks
  const timeTicks = useMemo(() => {
    const tickCount = Math.min(8, Math.floor(timelineWidth / 100));
    const ticks: number[] = [];
    const step = (maxTime - minTime) / (tickCount - 1);

    for (let i = 0; i < tickCount; i++) {
      ticks.push(minTime + step * i);
    }

    return ticks;
  }, [minTime, maxTime, timelineWidth]);

  // Track container size
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Mouse event handlers
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timestamp = xScaleInverse(x);

    if (timestamp >= minTime && timestamp <= maxTime) {
      onHoverTime(timestamp);
    }

    // Update brush if active
    if (brushStart !== null) {
      setBrushEnd(timestamp);
    }
  };

  const handleMouseLeave = () => {
    onHoverTime(null);
    setHoveredEvent(null);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timestamp = xScaleInverse(x);
    setBrushStart(timestamp);
    setBrushEnd(timestamp);
  };

  const handleMouseUp = () => {
    if (brushStart !== null && brushEnd !== null) {
      const start = Math.min(brushStart, brushEnd);
      const end = Math.max(brushStart, brushEnd);
      if (end - start > 60) { // Minimum 1 minute selection
        onTimeRangeChange([start, end]);
      }
    }
    setBrushStart(null);
    setBrushEnd(null);
  };

  const handleEventHover = (event: TimelineEvent | null) => {
    setHoveredEvent(event);
  };

  return (
    <div ref={containerRef} className="w-full relative">
      <svg
        width={containerWidth}
        height={height}
        className="select-none cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Timeline axis */}
        <line
          x1={padding.left}
          y1={height / 2}
          x2={padding.left + timelineWidth}
          y2={height / 2}
          className="stroke-slate-600"
          strokeWidth="2"
        />

        {/* Time tick marks */}
        {timeTicks.map((tick, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={xScale(tick)}
              y1={height / 2 - 5}
              x2={xScale(tick)}
              y2={height / 2 + 5}
              className="stroke-slate-500"
              strokeWidth="1.5"
            />
            <text
              x={xScale(tick)}
              y={height / 2 + 18}
              className="text-xs fill-slate-400"
              textAnchor="middle"
            >
              {formatTimeLabel(tick)}
            </text>
          </g>
        ))}

        {/* Event markers */}
        {events.map((event, i) => {
          const x = xScale(event.timestamp);
          const marker = EVENT_MARKERS[event.type];

          return (
            <g
              key={`event-${i}`}
              onMouseEnter={() => handleEventHover(event)}
              onMouseLeave={() => handleEventHover(null)}
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={height / 2}
                r={6}
                fill={event.color}
                opacity={hoveredEvent === event ? 1 : 0.8}
              />
              <text
                x={x}
                y={height / 2}
                className="text-xs fill-white pointer-events-none"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
              >
                {marker}
              </text>
            </g>
          );
        })}

        {/* Hover cursor line */}
        {hoverTime !== null && (
          <line
            x1={xScale(hoverTime)}
            y1={padding.top}
            x2={xScale(hoverTime)}
            y2={height - padding.bottom}
            className="stroke-blue-500 stroke-opacity-60"
            strokeWidth="2"
            pointerEvents="none"
          />
        )}

        {/* Brush selection */}
        {brushStart !== null && brushEnd !== null && (
          <rect
            x={Math.min(xScale(brushStart), xScale(brushEnd))}
            y={padding.top}
            width={Math.abs(xScale(brushEnd) - xScale(brushStart))}
            height={height - padding.top - padding.bottom}
            className="fill-blue-500 fill-opacity-20 stroke-blue-500"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}

        {/* Transparent overlay for mouse tracking */}
        <rect
          x={padding.left}
          y={padding.top}
          width={timelineWidth}
          height={height - padding.top - padding.bottom}
          fill="transparent"
        />
      </svg>

      {/* Event tooltip */}
      {hoveredEvent && (
        <div
          className="absolute bg-slate-800 text-white text-xs rounded px-2 py-1.5 shadow-lg pointer-events-none z-10"
          style={{
            left: Math.min(xScale(hoveredEvent.timestamp) + 10, containerWidth - 200),
            top: 0,
          }}
        >
          <div className="font-medium">{hoveredEvent.label}</div>
          <div className="text-slate-400 text-xs mt-0.5">
            {formatTimeLabel(hoveredEvent.timestamp)}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-500">●</span> Event
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-red-500">▲</span> Alert
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500">■</span> Change
        </div>
        <div className="ml-auto text-slate-500">
          Click and drag to select time range
        </div>
      </div>
    </div>
  );
}
