export default function RootLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Animated Brand Dual Ring Spinner */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[2.5px] border-slate-100" />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-[#024AE5] border-t-transparent animate-spin" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#024AE5]/80 animate-pulse" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-800 font-skoda tracking-tight">
            Sojar Solutions
          </p>
          <p className="text-xs text-slate-400 font-subheading flex items-center justify-center gap-1">
            <span>Loading precision tooling</span>
            <span className="inline-flex">
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
              <span className="animate-bounce delay-300">.</span>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
