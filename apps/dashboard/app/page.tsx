import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import Dashboard from './Dashboard';

function readFile(rel: string) {
  const base = process.env.DATA_DIR || path.join(process.cwd(), '..', '..');
  const p = path.join(base, rel);
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function readJson(rel: string, fallback: any = null) {
  const raw = readFile(rel);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readYaml(rel: string, fallback: any = null) {
  const raw = readFile(rel);
  if (!raw) return fallback;
  try {
    return parseYaml(raw);
  } catch {
    return fallback;
  }
}

export default function Page() {
  const history = (readJson('data/history.json', []) as any[]) || [];
  const state = readJson('data/state.json', { seen: {} }) as any;
  const config = readYaml('config/watchlist.yml', { products: [], settings: {} }) as any;

  return <Dashboard history={history} state={state} config={config} />;
}
