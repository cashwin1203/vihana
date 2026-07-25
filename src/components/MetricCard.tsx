'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  badgeText?: string;
  badgeVariant?: 'active' | 'at-risk' | 'pending' | 'completed' | 'absent' | 'backup' | 'cancelled';
}

interface ParsedValue {
  prefix: string;
  target: number;
  suffix: string;
  decimals: number;
  hasCommas: boolean;
}

function parseValue(value: string | number): ParsedValue | null {
  if (typeof value === 'number') {
    return {
      prefix: '',
      target: value,
      suffix: '',
      decimals: value % 1 !== 0 ? 1 : 0,
      hasCommas: false,
    };
  }

  const str = String(value).trim();
  const match = str.match(/^([^\d.-]*)([\d,]+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return null;
  }

  const [, prefix, numStr, suffix] = match;
  const hasCommas = numStr.includes(',');
  const cleanNumStr = numStr.replace(/,/g, '');
  const target = parseFloat(cleanNumStr);

  if (isNaN(target)) {
    return null;
  }

  const decimals = cleanNumStr.includes('.') ? cleanNumStr.split('.')[1].length : 0;

  return {
    prefix,
    target,
    suffix,
    decimals,
    hasCommas,
  };
}

function formatValue(current: number, parsed: ParsedValue): string {
  const { prefix, suffix, decimals, hasCommas } = parsed;
  let formattedNum = current.toFixed(decimals);

  if (hasCommas) {
    const parts = formattedNum.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formattedNum = parts.join('.');
  }

  return `${prefix}${formattedNum}${suffix}`;
}

function useAnimatedCounter(value: string | number, duration: number = 800) {
  const parsed = parseValue(value);
  const [displayVal, setDisplayVal] = useState<string>(() => {
    if (!parsed) return String(value);
    return formatValue(0, parsed);
  });

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!parsed) {
      setDisplayVal(String(value));
      return;
    }

    const startVal = 0;
    const endVal = parsed.target;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out cubic curve (cubic-bezier(0.16, 1, 0.3, 1) style)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentNum = startVal + (endVal - startVal) * easeProgress;

      setDisplayVal(formatValue(currentNum, parsed));

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayVal(formatValue(endVal, parsed));
      }
    };

    startTimeRef.current = null;
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [value, duration]);

  return displayVal;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = '#CC1100',
  badgeText,
  badgeVariant = 'active',
}: MetricCardProps) {
  const animatedValue = useAnimatedCounter(value);

  const isRedVariant = (['at-risk', 'absent', 'cancelled'] as string[]).includes(badgeVariant ?? '');

  return (
    <div className="card-elevated" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header row: title + icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <div
          role="img"
          aria-label={title}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: `${color}1a`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={19} color={color} strokeWidth={2} />
        </div>
      </div>

      {/* Stat value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span
          className="stat-value"
          aria-label={`${title}: ${animatedValue}`}
          style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}
        >
          {animatedValue}
        </span>
        {badgeText && (
          <span className={`badge badge-${badgeVariant}`} style={{ fontSize: '0.68rem' }}>
            <span className={isRedVariant ? 'pulse-dot-red' : 'pulse-dot-green'} />
            {badgeText}
          </span>
        )}
      </div>

      {/* Subtle bottom border accent */}
      {subtitle && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

