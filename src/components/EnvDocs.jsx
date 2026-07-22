import React from 'react';
import { Info } from 'lucide-react';

export default function EnvDocs() {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Info className="w-5 h-5 text-emerald-600" /> Server Environment Keys
      </h3>

      <p className="text-xs text-slate-500 mb-3">
        In production, the backend server must be configured with the following key environment variables to integrate with Gemini-flash and Google Docs:
      </p>

      <div className="space-y-3">
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-xs font-bold text-slate-700">GEMINI_API_KEY</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">Required</span>
          </div>
          <p className="text-[10px] text-slate-500">
            API key to access Google AI Studio Gemini-flash models for structural summarization and cleansing.
          </p>
        </div>

        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-xs font-bold text-slate-700">GOOGLE_SERVICE_ACCOUNT_EMAIL</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">Required</span>
          </div>
          <p className="text-[10px] text-slate-500">
            The service account email configured in your Google Cloud Project with the Google Docs API enabled.
          </p>
        </div>

        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-xs font-bold text-slate-700">GOOGLE_PRIVATE_KEY</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">Required</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Private key associated with the Google service account. Format it accurately (handling \n escape characters properly).
          </p>
        </div>
      </div>
    </div>
  );
}
