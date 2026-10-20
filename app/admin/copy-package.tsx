'use client';

import { useState } from 'react';

// "Copy package" on a client card: the text Mario sends a new client (from the demo's copyPkg()).
export function CopyPackage({ text, className }: { text: string; className: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied' : 'Copy package'}
    </button>
  );
}
