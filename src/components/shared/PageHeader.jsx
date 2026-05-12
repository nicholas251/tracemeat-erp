import React from "react";

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm md:text-base text-slate-600 mt-2 font-medium">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}