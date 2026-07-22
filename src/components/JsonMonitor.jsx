import React from 'react';
import { Database } from 'lucide-react';

export default function JsonMonitor({ responses, docId }) {
  const currentPayload = {
    documentId: docId || 'Empty / Not configured yet',
    responses: responses,
    agent: "Agente Verde"
  };

  return (
    <div className="bg-slate-900 text-slate-200 rounded-2xl shadow-md p-6 border border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <h3 className="font-bold flex items-center gap-2 text-white">
          <Database className="w-5 h-5 text-emerald-400" /> Server Logs & Live Payload
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
          LIVE CLIENT MONITOR
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Below is the real JSON structure currently bound for the server-side processor:
      </p>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto max-h-[160px]">
        <pre>{JSON.stringify(currentPayload, null, 2)}</pre>
      </div>
    </div>
  );
}
