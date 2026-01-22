import fs from 'fs';
import path from 'path';
import Dashboard from './Dashboard';

function readJson(rel: string, fallback: any = null) {
  const base = process.env.DATA_DIR || path.join(process.cwd(), '..', '..');
  const p = path.join(base, rel);
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export default function Page() {
  const history = (readJson('data/history.json', []) as any[]) || [];
  const state = readJson('data/state.json', { seen: {} }) as any;

  return <Dashboard history={history} state={state} />;
}
