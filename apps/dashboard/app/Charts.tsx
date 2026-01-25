/**
 * @fileoverview Chart components for the price bot dashboard.
 *
 * Provides visualization of scan activity and alert/error trends over time
 * using the Recharts library. Charts automatically adapt to light/dark mode.
 *
 * @module dashboard/Charts
 */

'use client';

import { useTheme } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

/**
 * Simplified run record for chart data.
 */
interface RunRecord {
  runAt: string;
  scanned: number;
  matches: number;
  alerts: number;
  errors?: { message: string }[];
}

/**
 * Renders an area chart showing scan activity over time.
 *
 * Displays two overlapping area series:
 * - Scanned: Total items scanned per run (indigo)
 * - Matches: Items matching criteria per run (green)
 *
 * Shows the last 30 runs and adapts colors for light/dark mode.
 *
 * @param props - Component props
 * @param props.data - Array of run records to visualize
 * @returns Rendered area chart
 */
export function ActivityChart({ data }: { data: RunRecord[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chartData = data.slice(-30).map((r) => ({
    time: new Date(r.runAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    scanned: r.scanned,
    matches: r.matches,
    alerts: r.alerts,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorScanned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
        <XAxis
          dataKey="time"
          stroke={isDark ? '#94a3b8' : '#64748b'}
          fontSize={12}
          tickLine={false}
        />
        <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#fff',
            border: '1px solid ' + (isDark ? '#334155' : '#e2e8f0'),
            borderRadius: 8,
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="scanned"
          stroke="#6366f1"
          fill="url(#colorScanned)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="matches"
          stroke="#22c55e"
          fill="url(#colorMatches)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Renders a bar chart showing alerts and errors per run.
 *
 * Displays two bar series:
 * - Alerts: Discord notifications sent (green)
 * - Errors: Marketplace or API errors (red)
 *
 * Shows the last 20 runs and adapts colors for light/dark mode.
 *
 * @param props - Component props
 * @param props.data - Array of run records to visualize
 * @returns Rendered bar chart
 */
export function AlertsBarChart({ data }: { data: RunRecord[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chartData = data.slice(-20).map((r) => ({
    time: new Date(r.runAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    alerts: r.alerts,
    errors: r.errors?.length || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
        <XAxis
          dataKey="time"
          stroke={isDark ? '#94a3b8' : '#64748b'}
          fontSize={12}
          tickLine={false}
        />
        <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#fff',
            border: '1px solid ' + (isDark ? '#334155' : '#e2e8f0'),
            borderRadius: 8,
          }}
        />
        <Legend />
        <Bar dataKey="alerts" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
