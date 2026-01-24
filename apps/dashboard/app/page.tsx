/**
 * @fileoverview Server-side page component for the dashboard.
 *
 * This is a Next.js server component that reads data files at build/request
 * time and passes them to the client-side Dashboard component. It handles:
 * - Reading run history from data/history.json
 * - Reading current state from data/state.json
 * - Reading product configuration from config/watchlist.yml
 *
 * The DATA_DIR environment variable can override the default data location.
 *
 * @module dashboard/page
 */

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import Dashboard from './Dashboard';

/**
 * Reads a file from the data directory.
 *
 * Uses DATA_DIR environment variable if set, otherwise defaults to
 * the project root (two directories up from apps/dashboard/app).
 *
 * @param rel - Relative path from the data directory
 * @returns File contents as string, or null if file doesn't exist
 */
function readFile(rel: string) {
  const base = process.env.DATA_DIR || path.join(process.cwd(), '..', '..');
  const p = path.join(base, rel);
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Reads and parses a JSON file from the data directory.
 *
 * @param rel - Relative path from the data directory
 * @param fallback - Value to return if file doesn't exist or is invalid JSON
 * @returns Parsed JSON object or fallback value
 */
function readJson(rel: string, fallback: any = null) {
  const raw = readFile(rel);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Reads and parses a YAML file from the data directory.
 *
 * @param rel - Relative path from the data directory
 * @param fallback - Value to return if file doesn't exist or is invalid YAML
 * @returns Parsed YAML object or fallback value
 */
function readYaml(rel: string, fallback: any = null) {
  const raw = readFile(rel);
  if (!raw) return fallback;
  try {
    return parseYaml(raw);
  } catch {
    return fallback;
  }
}

/**
 * Main page component (server-side).
 *
 * Loads all required data files and renders the Dashboard component.
 * This runs on the server at build time (for static export) or on
 * each request (for server rendering).
 *
 * @returns Rendered Dashboard with loaded data
 */
export default function Page() {
  const history = (readJson('data/history.json', []) as any[]) || [];
  const state = readJson('data/state.json', { seen: {} }) as any;
  const config = readYaml('config/watchlist.yml', { products: [], settings: {} }) as any;

  return <Dashboard history={history} state={state} config={config} />;
}
