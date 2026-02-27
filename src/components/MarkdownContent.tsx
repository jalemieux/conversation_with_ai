import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const PROSE_CLASSES = "prose prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-blockquote:my-2 prose-headings:text-ink prose-p:text-ink-light prose-li:text-ink-light prose-strong:text-ink prose-a:text-amber prose-blockquote:text-ink-muted prose-blockquote:border-border prose-code:text-amber prose-code:bg-cream-dark prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-cream-dark prose-pre:border prose-pre:border-border"

const REMARK_PLUGINS = [remarkGfm]

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{content}</ReactMarkdown>
    </div>
  )
}
