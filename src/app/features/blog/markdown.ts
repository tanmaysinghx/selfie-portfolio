import { Marked, Tokens } from 'marked';

export interface TocEntry {
  id: string;
  text: string;
  depth: number;
}

export interface RenderedPost {
  html: string;
  toc: TocEntry[];
}

const CALLOUTS: Record<string, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution'
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Accepts a bare video id or any youtube.com / youtu.be URL. */
function youtubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Renders a post's markdown to HTML. Beyond standard markdown it understands:
 * ```mermaid``` flowcharts, ```chart``` Chart.js configs, ```youtube``` embeds,
 * GitHub-style `> [!NOTE]` callouts and image captions from the image title.
 */
export function renderMarkdown(markdown: string, slug: string): RenderedPost {
  const toc: TocEntry[] = [];
  const usedIds = new Map<string, number>();
  const resolve = (href: string) =>
    /^([a-z]+:|\/|#)/i.test(href) ? href : `/posts/${slug}/${href.replace(/^\.\//, '')}`;

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const base = slugify(inner) || 'section';
        const seen = usedIds.get(base) ?? 0;
        usedIds.set(base, seen + 1);
        const id = seen ? `${base}-${seen}` : base;
        if (depth === 2 || depth === 3) {
          toc.push({ id, depth, text: inner.replace(/<[^>]+>/g, '') });
        }
        return `<h${depth} id="${id}"><a class="blog-anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },

      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? '').trim().split(/\s+/)[0];

        if (language === 'mermaid') {
          return `<figure class="blog-diagram" data-mermaid="${encodeURIComponent(text)}"><div class="blog-loading">Drawing diagram…</div></figure>\n`;
        }

        if (language === 'chart') {
          return `<figure class="blog-chart" data-chart="${encodeURIComponent(text)}"><div class="blog-loading">Loading chart…</div></figure>\n`;
        }

        if (language === 'youtube') {
          const [source, ...captionLines] = text.split('\n');
          const id = youtubeId(source);
          if (!id) return `<p class="blog-error">Couldn't read a YouTube video id from “${escapeHtml(source)}”.</p>`;
          const caption = captionLines.join(' ').trim();
          return `<figure class="blog-video">
  <button type="button" class="blog-video-poster" data-youtube="${id}" aria-label="Play video${caption ? `: ${escapeHtml(caption)}` : ''}">
    <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" />
    <span class="blog-video-play" aria-hidden="true">▶</span>
  </button>
  ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
</figure>\n`;
        }

        const className = language === 'java' ? text.match(/public\s+(?:final\s+)?class\s+(\w+)/)?.[1] : null;
        const languageLabels: Record<string, string> = { java: 'Java', bash: 'Shell commands', shell: 'Shell commands', text: 'Output', json: 'JSON' };
        const label = (lang ?? '').trim().split(/\s+/).slice(1).join(' ') ||
          (className ? `${className}.java` : (languageLabels[language] ?? (language || 'Code')));
        const lines = text.split('\n');
        const numbers = lines.length > 3
          ? `<span class="blog-code-numbers" aria-hidden="true">${lines.map((_, i) => i + 1).join('\n')}</span>`
          : '';
        return `<div class="blog-code" data-code="${encodeURIComponent(text)}">
  <div class="blog-code-bar">
    <span class="blog-code-file"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 2H4v12h8V5L9 2Z"/><path d="M9 2v4h3"/></svg>${escapeHtml(label)}</span>
    <button type="button" data-copy aria-label="Copy ${escapeHtml(label)}" aria-live="polite"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1"/><path d="M10 5V2H2v9h3"/></svg><span data-copy-label>Copy</span></button>
  </div>
  <pre tabindex="0" aria-label="${escapeHtml(label)} code, scroll to see more">${numbers}<code class="${language ? `language-${escapeHtml(language)}` : 'nohighlight'}">${escapeHtml(text)}</code></pre>
</div>\n`;
      },

      image({ href, title, text }: Tokens.Image) {
        const caption = title || '';
        return `<figure class="blog-figure"><img src="${escapeHtml(resolve(href))}" alt="${escapeHtml(text)}" loading="lazy" data-zoom />${
          caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
        }</figure>`;
      },

      paragraph({ tokens }: Tokens.Paragraph) {
        // A lone image becomes a <figure>, which can't sit inside a <p>.
        if (tokens.length === 1 && tokens[0].type === 'image') {
          return this.parser.parseInline(tokens) + '\n';
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
      },

      blockquote({ tokens }: Tokens.Blockquote) {
        const body = this.parser.parse(tokens);
        const callout = body.match(/^<p>\[!(\w+)\]\s*/);
        if (callout && CALLOUTS[callout[1].toUpperCase()]) {
          const kind = callout[1].toUpperCase();
          const rest = body.replace(callout[0], '<p>').replace(/<p><\/p>\n?/, '');
          return `<aside class="blog-callout" data-kind="${kind.toLowerCase()}"><p class="blog-callout-title">${CALLOUTS[kind]}</p>${rest}</aside>\n`;
        }
        return `<blockquote>${body}</blockquote>\n`;
      },

      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        const reference = /^Sources?:/i.test(inner);
        return `<a${reference ? ' class="blog-reference"' : ''} href="${escapeHtml(resolve(href))}"${title ? ` title="${escapeHtml(title)}"` : ''}${
          external ? ' target="_blank" rel="noopener noreferrer"' : ''
        }>${inner}</a>`;
      }
    }
  });

  return { html: marked.parse(markdown, { async: false }), toc };
}
