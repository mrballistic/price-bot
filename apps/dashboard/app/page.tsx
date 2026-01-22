import fs from 'fs';
import path from 'path';

function readJson(rel: string) {
  const p = path.join(process.cwd(), '..', '..', rel);
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw);
}

export default function Page() {
  const history = readJson('data/history.json') as any[];
  const state = readJson('data/state.json') as any;

  const last = history.length > 0 ? history[history.length - 1] : null;
  const lastRunAt = last?.runAt ?? '—';
  const lastSummary = last
    ? `scanned=${last.scanned} matches=${last.matches} alerts=${last.alerts} errors=${last.errors?.length ?? 0}`
    : 'No runs yet';

  const recent = history.slice(-20).reverse();

  return (
    <div>
      <div
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.75 }}>Last run</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{lastRunAt}</div>
        <div style={{ marginTop: 8 }}>{lastSummary}</div>
      </div>

      <h2>Recent runs</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>runAt</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
              scanned
            </th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
              matches
            </th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
              alerts
            </th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
              errors
            </th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r, idx) => (
            <tr key={idx}>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.runAt}</td>
              <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                {r.scanned}
              </td>
              <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                {r.matches}
              </td>
              <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                {r.alerts}
              </td>
              <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                {(r.errors || []).length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Seen counts</h2>
      <pre
        style={{
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 12,
          overflowX: 'auto',
          background: '#fafafa',
        }}
      >
        {JSON.stringify(state?.seen, null, 2)}
      </pre>
    </div>
  );
}
