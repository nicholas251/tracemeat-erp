import React from "react";

// Highlights a lot/number that matched the current trace search.
export default function Hl({ on, children, className = "" }) {
  return (
    <span className={`font-mono ${on ? "bg-yellow-200 text-yellow-900 px-1 rounded font-bold" : ""} ${className}`}>
      {children}
    </span>
  );
}