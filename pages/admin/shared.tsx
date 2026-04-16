import React from "react";

export const StatCard: React.FC<{
  title: string;
  value: string;
  note: string;
}> = ({ title, value, note }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold text-slate-900 mt-3">{value}</p>
      <p className="text-sm text-slate-400 mt-2">{note}</p>
    </div>
  );
};

export const Th: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "" }) => {
  return (
    <th
      className={`px-4 py-3 text-sm font-semibold text-slate-600 border-b border-slate-200 bg-slate-50 ${className}`}
    >
      {children}
    </th>
  );
};

export const Td: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "" }) => {
  return (
    <td
      className={`px-4 py-4 text-sm text-slate-700 border-b border-slate-100 align-middle ${className}`}
    >
      {children}
    </td>
  );
};

export const Badge: React.FC<{
  text: string;
  tone: "green" | "amber" | "red";
}> = ({ text, tone }) => {
  const toneClass =
    tone === "green"
      ? "bg-green-100 text-green-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {text}
    </span>
  );
};
