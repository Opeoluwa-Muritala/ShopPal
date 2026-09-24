'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Terminal,
  RefreshCw,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Info,
  Bug,
  Filter,
  Key,
  Clock,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { diagnosticsApi } from '../../../lib/api';
import { getFrontendApiKey, setFrontendApiKey } from '../../../lib/auth';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  route?: string;
  status_code?: number;
  latency_ms?: number;
}

export default function DiagnosticsLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(50);
  const [apiKey, setApiKey] = useState<string>('');
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  useEffect(() => {
    setApiKey(getFrontendApiKey());
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await diagnosticsApi.getHealth();
      if (res.data?.status) {
        setHealthStatus(res.data.status);
      } else {
        setHealthStatus('unreachable');
      }
    } catch {
      setHealthStatus('offline');
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const currentLevel = levelFilter === 'ALL' ? undefined : levelFilter;
      const res = await diagnosticsApi.getRecentLogs(limit, currentLevel, apiKey || undefined);

      if (res.data && Array.isArray(res.data.logs)) {
        const mapped: LogEntry[] = res.data.logs.map((l) => ({
          timestamp: l.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
          level: (l.level || 'INFO').toUpperCase(),
          message: l.message || JSON.stringify(l),
          route: l.route || undefined,
          status_code: l.status_code || 200,
          latency_ms: l.latency_ms || 0,
        }));
        setLogs(mapped);
        setIsLiveConnected(true);
      } else {
        setLogs([]);
        setIsLiveConnected(Boolean(res.data));
      }
    } catch {
      setLogs([]);
      setIsLiveConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchLogs();
  }, [levelFilter, limit]);

  const handleSaveApiKey = () => {
    setFrontendApiKey(apiKey);
    setIsEditingKey(false);
    fetchLogs();
  };

  const filteredLogs = useMemo(() => {
    if (levelFilter === 'ALL') return logs;
    return logs.filter((l) => l.level === levelFilter);
  }, [logs, levelFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Terminal className="w-6 h-6 text-emerald-600" />
              <span>System &amp; Bot Diagnostics</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isLiveConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {isLiveConnected ? 'Connected to /api/logs/recent' : 'Logs Buffer (Offline / Empty)'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time server telemetry, WhatsApp inbound webhook events, and Claude AI conversational commerce latency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Diagnostics Health & Auth Key Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              API Status (`GET /api/health`)
            </span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-base font-bold text-slate-900 capitalize">{healthStatus}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            FastAPI 0.6.0 Backend Gateway
          </span>
        </div>

        {/* API Key Inspector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Security Header (`X-API-Key` / `X-Vendor-API-Key`)
              </span>
            </div>
            {!isEditingKey ? (
              <button
                type="button"
                onClick={() => setIsEditingKey(true)}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Change Key
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Save
              </button>
            )}
          </div>
          {isEditingKey ? (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter custom API key"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
              >
                Apply
              </button>
            </div>
          ) : (
            <div className="mt-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
              <span className="truncate">{apiKey || 'frontend-default-key'}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-sans">
                Active Header
              </span>
            </div>
          )}
          <span className="text-[11px] text-slate-400 mt-1 block">
            Used by client to authenticate diagnostic and vendor requests.
          </span>
        </div>
      </div>

      {/* Filter and Limit Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filter Level:</span>
          {(['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                levelFilter === lvl
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold">Buffer Limit:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-slate-300 rounded-lg p-1 text-xs bg-white font-bold"
          >
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
          </select>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden font-mono text-xs text-slate-200">
        <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-bold text-slate-300">shoppal-core.log</span>
          </div>
          <span>Showing {filteredLogs.length} events</span>
        </div>

        <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto font-mono">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">No log events match filter {levelFilter}</p>
          ) : (
            filteredLogs.map((log, idx) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARNING';
              const isDebug = log.level === 'DEBUG';

              return (
                <div
                  key={idx}
                  className="py-1 px-2 rounded hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-start gap-2 border-b border-slate-900/40"
                >
                  <span className="text-slate-500 text-[11px] shrink-0">{log.timestamp}</span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      isError
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : isWarn
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : isDebug
                        ? 'bg-purple-950 text-purple-400 border border-purple-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {log.level}
                  </span>

                  {log.route && (
                    <span className="text-sky-400 font-semibold text-[11px] shrink-0">
                      {log.route}
                    </span>
                  )}

                  <span className="text-slate-300 flex-1 break-words">{log.message}</span>

                  {log.latency_ms && (
                    <span className="text-slate-500 text-[10px] shrink-0 font-sans">
                      {log.latency_ms}ms
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
