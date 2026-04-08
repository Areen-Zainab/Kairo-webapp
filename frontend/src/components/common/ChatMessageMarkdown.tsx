import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-4 [li]:mt-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-4 [li]:mt-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 underline underline-offset-2 break-all dark:text-blue-400"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || '');
    if (isBlock) {
      return (
        <code className={`${className ?? ''} block font-mono text-xs leading-relaxed`}>{children}</code>
      );
    }
    return (
      <code className="rounded bg-slate-200/90 px-1 py-0.5 font-mono text-[0.8125rem] dark:bg-slate-600/80">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-slate-200/80 p-2 text-xs dark:bg-slate-900/80">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-2 italic text-slate-600 dark:border-slate-500 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-slate-200 dark:border-slate-600" />,
};

type ChatMessageMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Renders assistant / bot chat text as Markdown (bold, lists, links, fenced code).
 * Plain user messages should stay as escaped text — use this for model replies only.
 */
export function ChatMessageMarkdown({ content, className = '' }: ChatMessageMarkdownProps) {
  return (
    <div
      className={`min-w-0 break-words text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}
    >
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}

export default ChatMessageMarkdown;
