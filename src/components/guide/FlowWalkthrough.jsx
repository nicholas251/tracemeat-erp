import React from "react";

export default function FlowWalkthrough({ flow }) {
  return (
    <div className="break-inside-avoid mb-6">
      <h3 className="text-base font-semibold text-slate-900">{flow.name}</h3>
      <p className="text-sm italic text-slate-600 mb-2">{flow.summary}</p>
      <div className="space-y-2">
        {flow.stages.map((stage, i) => (
          <div key={i} className="flex gap-3 text-sm break-inside-avoid">
            <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div>
              <span className="font-semibold text-slate-900">{stage.name} — </span>
              <span className="text-slate-700">{stage.what}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}