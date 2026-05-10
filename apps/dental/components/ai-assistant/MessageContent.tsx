/**
 * Message Content Renderer
 *
 * Renders message text with appropriate formatting:
 * - User messages: plain text
 * - Assistant messages: markdown with GitHub Flavored Markdown support
 */

'use client'

import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MessageContentProps {
  text: string
  role: 'user' | 'assistant'
}

export function MessageContent({ text, role }: MessageContentProps) {
  // User messages render as plain text
  if (role === 'user') {
    return <p className="text-sm whitespace-pre-wrap">{text}</p>
  }

  // Custom components for markdown rendering
  const components: Components = {
    // Headings
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-lg font-semibold mt-4 mb-2 text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-base font-semibold mt-3 mb-2 text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">
        {children}
      </h3>
    ),

    // Paragraphs - improved line height for better readability
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-sm mb-3 text-foreground leading-7">
        {children}
      </p>
    ),

    // Strong/Bold
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-foreground">
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-foreground">
        {children}
      </em>
    ),

    // Lists - improved spacing for better readability
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-outside ml-5 space-y-2 mb-4 text-sm text-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-outside ml-5 space-y-2 mb-4 text-sm text-foreground">
        {children}
      </ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-sm text-foreground leading-7 pl-1">
        {children}
      </li>
    ),

    // Code
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const isInline = !className

      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-muted text-foreground rounded font-mono text-xs">
            {children}
          </code>
        )
      }

      return (
        <code className="block p-3 bg-muted text-foreground rounded-lg font-mono text-xs overflow-x-auto mb-2">
          {children}
        </code>
      )
    },

    // Pre (code blocks)
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="mb-2 overflow-hidden">
        {children}
      </pre>
    ),

    // Blockquote
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-primary/40 pl-4 py-2 mb-2 text-sm text-muted-foreground italic">
        {children}
      </blockquote>
    ),

    // Horizontal Rule
    hr: () => (
      <hr className="my-4 border-border" />
    ),

    // Links
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
      >
        {children}
      </a>
    ),

    // Tables (GFM)
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto mb-2">
        <table className="min-w-full border-collapse border border-border rounded-lg">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-muted">
        {children}
      </thead>
    ),
    tbody: ({ children }: { children?: React.ReactNode }) => (
      <tbody>
        {children}
      </tbody>
    ),
    tr: ({ children }: { children?: React.ReactNode }) => (
      <tr className="border-b border-border">
        {children}
      </tr>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-3 py-2 text-sm text-foreground">
        {children}
      </td>
    ),

    // Strikethrough (GFM)
    del: ({ children }: { children?: React.ReactNode }) => (
      <del className="line-through text-muted-foreground">
        {children}
      </del>
    ),
  }

  // Assistant messages render markdown
  // Note: Using type assertion due to react-markdown v10 types issue
  const MarkdownComponent = Markdown as React.ComponentType<{
    children: string
    remarkPlugins?: unknown[]
    className?: string
    components?: Components
  }>

  return (
    <MarkdownComponent
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none"
      components={components}
    >
      {text}
    </MarkdownComponent>
  )
}
