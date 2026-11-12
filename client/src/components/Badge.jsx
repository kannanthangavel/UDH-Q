import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} ${className}`}>
      {children}
    </span>
  );
}

export function MatchStatusBadge({ status }) {
  switch (status) {
    case 'Exact Match':
      return <Badge variant="success">Exact Match</Badge>;
    case 'Strong Match — Review':
      return <Badge variant="primary">Strong Match — Review</Badge>;
    case 'Multiple Possible Matches':
      return <Badge variant="warning">Multiple Matches</Badge>;
    case 'Missing Price':
      return <Badge variant="danger">Missing Price</Badge>;
    case 'Missing Unit':
      return <Badge variant="warning">Missing Unit</Badge>;
    case 'No Match':
      return <Badge variant="danger">No Match</Badge>;
    default:
      return <Badge variant="default">{status || 'Unresolved'}</Badge>;
  }
}
