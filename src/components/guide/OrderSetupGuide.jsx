import React from "react";

export default function OrderSetupGuide({ blocks }) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.title} className="break-inside-avoid">
          <h3 className="text-base font-semibold text-slate-900 mb-1">{block.title}</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
            {block.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}