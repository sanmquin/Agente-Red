import { Leaf } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-emerald-600 text-white shadow-lg py-5 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-full shadow text-emerald-600 animate-pulse">
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight m-0 text-white leading-none">Agente Verde</h1>
            <p className="text-emerald-100 text-sm mt-1">Your Voice Assistant for Documenting in Google Docs (es-MX)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-emerald-700/50 p-2.5 rounded-lg border border-emerald-500/30 text-white font-semibold text-xs">
          NON-PROFIT SUPPORTIVE SYSTEM
        </div>
      </div>
    </header>
  );
}
