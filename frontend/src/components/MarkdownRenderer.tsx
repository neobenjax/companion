import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  fontSize?: number;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', fontSize }) => {
  return (
    <div
      className={`markdown-content text-zinc-200 leading-relaxed select-text ${className}`}
      style={{ fontSize: fontSize ? `${fontSize}px` : 'inherit' }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-bold text-zinc-100 mt-2.5 mb-1.5 pb-1 border-b border-zinc-800/80" style={{ fontSize: '1.25em' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-bold text-zinc-100 mt-2 mb-1 flex items-center gap-1.5" style={{ fontSize: '1.1em' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold text-purple-300 mt-2 mb-1" style={{ fontSize: '1.0em' }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-zinc-200 leading-relaxed mb-2 last:mb-0" style={{ fontSize: 'inherit', lineHeight: 1.6 }}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-1 mb-2 text-zinc-200 marker:text-purple-400" style={{ fontSize: 'inherit' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1 mb-2 text-zinc-200 marker:text-purple-400" style={{ fontSize: 'inherit' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5" style={{ fontSize: 'inherit' }}>
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-100">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-300">
              {children}
            </em>
          ),
          hr: () => (
            <hr className="border-t border-zinc-800/60 my-2.5" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-500/70 pl-2.5 py-1 my-2 text-zinc-300 italic bg-purple-950/15 rounded-r" style={{ fontSize: '0.95em' }}>
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-zinc-200 overflow-x-auto my-2" style={{ fontSize: '0.9em' }}>
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-purple-300" style={{ fontSize: '0.9em' }}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 hover:text-purple-300 underline font-medium transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
