export default function AdminLoading() {
  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-2 border-[#024AE5] border-t-transparent animate-spin" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-800 uppercase tracking-wider font-skoda">
            Admin Portal
          </p>
          <p className="text-[11px] text-slate-400">Loading management data...</p>
        </div>
      </div>
    </div>
  );
}
