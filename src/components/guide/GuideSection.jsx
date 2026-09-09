import React from "react";

export default function GuideSection({ section }) {
  return (
    <section className="break-inside-avoid mb-8">
      <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mb-2">{section.title}</h2>
      <p className="text-sm text-slate-700 mb-3">{section.intro}</p>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-800">
        {section.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {section.tips?.length > 0 && (
        <div className="mt-3 border-l-4 border-slate-400 pl-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Good to know</p>
          <ul className="list-disc pl-4 space-y-1 text-sm text-slate-700">
            {section.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}