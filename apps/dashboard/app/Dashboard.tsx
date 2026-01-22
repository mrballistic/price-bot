'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
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
  Tabs,
  Tab,
  Button,
  Link,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  Notifications,
  Search,
  Error as ErrorIcon,
  Schedule,
  OpenInNew,
  AttachMoney,
  Storefront,
} from '@mui/icons-material';
import { ActivityChart, AlertsBarChart } from './Charts';

interface Listing {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  price: { amount: number; currency: string };
  shipping?: { amount: number; currency: string; known?: boolean };
  imageUrl?: string;
  condition?: string;
  listedAt?: string;
}

interface Match {
  productId: string;
  productName: string;
  maxPriceUsd: number;
  listing: Listing;
  effectivePriceUsd: number;
  shippingNote?: string;
}

interface ProductByRun {
  productId: string;
  productName: string;
  thresholdUsd: number;
  scanned: number;
  matches: Match[];
}

interface RunRecord {
  runAt: string;
  durationMs: number;
  scanned: number;
  matches: number;
  alerts: number;
  errors?: { marketplace: string; productId: string; message: string }[];
  byProduct: ProductByRun[];
}

interface ProductConfig {
  id: string;
  name: string;
  maxPriceUsd: number;
  marketplaces: string[];
  includeTerms?: string[];
  excludeTerms?: string[];
}

interface DashboardProps {
  history: RunRecord[];
  state: {
    updatedAt?: string;
    seen?: Record<string, Record<string, Record<string, any>>>;
  };
  config: {
    products: ProductConfig[];
    settings: any;
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

function ProductCard({ product }: { product: ProductConfig }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Storefront color="primary" />
          <Typography variant="h6">{product.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AttachMoney sx={{ fontSize: 18, color: 'success.main' }} />
          <Typography variant="body2" color="text.secondary">
            Max: <strong>${product.maxPriceUsd}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          {product.marketplaces.map((m) => (
            <Chip key={m} label={m} size="small" variant="outlined" />
          ))}
        </Box>
        {product.includeTerms && product.includeTerms.length > 0 && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Search: {product.includeTerms.slice(0, 3).join(', ')}
            {product.includeTerms.length > 3 && ` +${product.includeTerms.length - 3} more`}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function HitCard({ match }: { match: Match }) {
  const { listing } = match;
  return (
    <Card sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, overflow: 'hidden' }}>
      {listing.imageUrl && (
        <CardMedia
          component="img"
          sx={{ width: { xs: '100%', sm: 140 }, height: { xs: 140, sm: 'auto' }, objectFit: 'cover' }}
          image={listing.imageUrl}
          alt={listing.title}
        />
      )}
      <CardContent sx={{ flex: 1, py: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {listing.title.length > 80 ? listing.title.slice(0, 80) + '...' : listing.title}
          </Typography>
          <Chip
            label={listing.source}
            size="small"
            color={listing.source === 'reverb' ? 'secondary' : 'primary'}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
          <Typography variant="h6" color="success.main" fontWeight={700}>
            ${match.effectivePriceUsd.toFixed(2)}
          </Typography>
          {match.shippingNote && (
            <Typography variant="caption" color="warning.main">
              {match.shippingNote}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Threshold: ${match.maxPriceUsd}
          </Typography>
          {listing.condition && listing.condition !== '[object Object]' && (
            <>
              <Typography variant="caption" color="text.secondary">•</Typography>
              <Typography variant="caption" color="text.secondary">
                {listing.condition}
              </Typography>
            </>
          )}
        </Box>
        <Button
          size="small"
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNew fontSize="small" />}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          View Listing
        </Button>
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

export default function Dashboard({ history, state, config }: DashboardProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  const last = history.length > 0 ? history[history.length - 1] : null;
  const recent = history.slice(-20).reverse();

  // Get unique products from config or history
  const products = config.products.length > 0
    ? config.products
    : Array.from(
        new Map(
          history.flatMap((r) => r.byProduct).map((p) => [p.productId, { id: p.productId, name: p.productName, maxPriceUsd: p.thresholdUsd, marketplaces: [] }])
        ).values()
      );

  // Collect all matches from history, filtered by selected product
  const allMatches = useMemo(() => {
    const matches: (Match & { runAt: string })[] = [];
    for (const run of history) {
      for (const prod of run.byProduct) {
        if (selectedProduct === 'all' || prod.productId === selectedProduct) {
          for (const m of prod.matches) {
            matches.push({ ...m, runAt: run.runAt });
          }
        }
      }
    }
    // Dedupe by sourceId, keeping most recent
    const seen = new Map<string, Match & { runAt: string }>();
    for (const m of matches) {
      const key = `${m.listing.source}-${m.listing.sourceId}`;
      if (!seen.has(key) || new Date(m.runAt) > new Date(seen.get(key)!.runAt)) {
        seen.set(key, m);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.effectivePriceUsd - b.effectivePriceUsd);
  }, [history, selectedProduct]);

  // Filter history stats by product
  const filteredRecent = useMemo(() => {
    if (selectedProduct === 'all') return recent;
    return recent.map((r) => {
      const prod = r.byProduct.find((p) => p.productId === selectedProduct);
      return {
        ...r,
        scanned: prod?.scanned || 0,
        matches: prod?.matches.length || 0,
        alerts: prod?.matches.length || 0, // approximation
        errors: r.errors?.filter((e) => e.productId === selectedProduct) || [],
      };
    });
  }, [recent, selectedProduct]);

  // Calculate totals
  const totalScanned = filteredRecent.reduce((sum, r) => sum + r.scanned, 0);
  const totalAlerts = filteredRecent.reduce((sum, r) => sum + r.alerts, 0);
  const totalErrors = filteredRecent.reduce((sum, r) => sum + (r.errors?.length || 0), 0);

  // Count tracked items
  const seenCounts: { marketplace: string; product: string; count: number }[] = [];
  if (state.seen) {
    for (const [marketplace, prods] of Object.entries(state.seen)) {
      for (const [product, items] of Object.entries(prods || {})) {
        if (selectedProduct === 'all' || product === selectedProduct) {
          seenCounts.push({
            marketplace,
            product,
            count: Object.keys(items || {}).length,
          });
        }
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

      {/* Products Being Watched */}
      {products.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Products Being Watched
          </Typography>
          <Grid container spacing={2}>
            {products.map((p: any) => (
              <Grid item xs={12} sm={6} md={4} key={p.id}>
                <ProductCard product={p} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Product Filter Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={selectedProduct}
          onChange={(_, v) => setSelectedProduct(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="All Products" value="all" />
          {products.map((p: any) => (
            <Tab key={p.id} label={p.name} value={p.id} />
          ))}
        </Tabs>
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

      {/* Hits Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Hits ({allMatches.length})
          </Typography>
          {allMatches.length === 0 ? (
            <Alert severity="info">
              No matches found yet{selectedProduct !== 'all' ? ' for this product' : ''}. The bot will alert you when listings match your criteria.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {allMatches.slice(0, 12).map((m, i) => (
                <Grid item xs={12} md={6} key={`${m.listing.source}-${m.listing.sourceId}-${i}`}>
                  <HitCard match={m} />
                </Grid>
              ))}
            </Grid>
          )}
          {allMatches.length > 12 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Showing 12 of {allMatches.length} matches
            </Typography>
          )}
        </CardContent>
      </Card>

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
          {filteredRecent.length === 0 ? (
            <Alert severity="info">No runs recorded yet.</Alert>
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
                  {filteredRecent.map((r, idx) => (
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
