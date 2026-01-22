'use client';

import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Notifications,
  Search,
  Error as ErrorIcon,
  Schedule,
} from '@mui/icons-material';
import { ActivityChart, AlertsBarChart } from './Charts';

interface RunRecord {
  runAt: string;
  durationMs: number;
  scanned: number;
  matches: number;
  alerts: number;
  errors?: { marketplace: string; productId: string; message: string }[];
}

interface DashboardProps {
  history: RunRecord[];
  state: {
    updatedAt?: string;
    seen?: Record<string, Record<string, Record<string, any>>>;
  };
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: color + '20',
              color: color,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number) {
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

export default function Dashboard({ history, state }: DashboardProps) {
  const last = history.length > 0 ? history[history.length - 1] : null;
  const recent = history.slice(-20).reverse();

  // Calculate totals from recent runs
  const totalScanned = recent.reduce((sum, r) => sum + r.scanned, 0);
  const totalAlerts = recent.reduce((sum, r) => sum + r.alerts, 0);
  const totalErrors = recent.reduce((sum, r) => sum + (r.errors?.length || 0), 0);

  // Count tracked items
  const seenCounts: { marketplace: string; product: string; count: number }[] = [];
  if (state.seen) {
    for (const [marketplace, products] of Object.entries(state.seen)) {
      for (const [product, items] of Object.entries(products || {})) {
        seenCounts.push({
          marketplace,
          product,
          count: Object.keys(items || {}).length,
        });
      }
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Price Bot Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitoring marketplace prices for your watchlist
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Last Run"
            value={last ? formatTime(last.runAt) : '—'}
            icon={<Schedule />}
            color="#6366f1"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Items Scanned (20 runs)"
            value={totalScanned.toLocaleString()}
            icon={<Search />}
            color="#0ea5e9"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Alerts Sent (20 runs)"
            value={totalAlerts}
            icon={<Notifications />}
            color="#22c55e"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Errors (20 runs)"
            value={totalErrors}
            icon={<ErrorIcon />}
            color={totalErrors > 0 ? '#ef4444' : '#94a3b8'}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      {history.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Scan Activity
                </Typography>
                <ActivityChart data={history} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Alerts & Errors
                </Typography>
                <AlertsBarChart data={history} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tracked Items */}
      {seenCounts.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tracked Listings
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {seenCounts.map((s, i) => (
                <Chip
                  key={i}
                  label={`${s.marketplace}/${s.product}: ${s.count}`}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Recent Runs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Runs
          </Typography>
          {recent.length === 0 ? (
            <Alert severity="info">No runs recorded yet. The bot will update this after each scheduled run.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell align="right">Duration</TableCell>
                    <TableCell align="right">Scanned</TableCell>
                    <TableCell align="right">Matches</TableCell>
                    <TableCell align="right">Alerts</TableCell>
                    <TableCell align="right">Errors</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recent.map((r, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{formatTime(r.runAt)}</TableCell>
                      <TableCell align="right">{formatDuration(r.durationMs)}</TableCell>
                      <TableCell align="right">{r.scanned}</TableCell>
                      <TableCell align="right">{r.matches}</TableCell>
                      <TableCell align="right">
                        {r.alerts > 0 ? (
                          <Chip label={r.alerts} color="success" size="small" />
                        ) : (
                          r.alerts
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {(r.errors?.length || 0) > 0 ? (
                          <Chip label={r.errors?.length} color="error" size="small" />
                        ) : (
                          0
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Last updated: {state.updatedAt ? formatTime(state.updatedAt) : '—'}
        </Typography>
      </Box>
    </Container>
  );
}
