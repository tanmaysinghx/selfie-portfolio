// Post-render upgrades for a blog article. Each heavy library is imported on demand,
// so a post without diagrams never downloads Mermaid and one without charts never loads Chart.js.

/** Validated categorical order (fixed, never cycled) against the #f5f1ea page surface. */
export const CHART_PALETTE = ['#a44224', '#1767b0', '#a87800', '#8a3fb8', '#23864a', '#0087b8'];

const INK = '#1a1816';
const MUTED = '#6b635a';
const HAIR = '#e1dacb';
const SURFACE = '#f5f1ea';
const SURFACE_ALT = '#efeae0';

export async function highlightCode(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>('pre code:not(.nohighlight)');
  if (!blocks.length) return;
  const { default: hljs } = await import('highlight.js/lib/common');
  blocks.forEach(block => {
    const lang = block.className.match(/language-([\w-]+)/)?.[1];
    if (lang && !hljs.getLanguage(lang)) return;
    hljs.highlightElement(block);
  });
}

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  mermaidReady ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'Geist, -apple-system, sans-serif',
      themeVariables: {
        background: SURFACE,
        primaryColor: SURFACE_ALT,
        primaryBorderColor: INK,
        primaryTextColor: INK,
        secondaryColor: '#f3e3dc',
        secondaryBorderColor: '#a44224',
        tertiaryColor: SURFACE,
        tertiaryBorderColor: HAIR,
        lineColor: MUTED,
        textColor: INK,
        noteBkgColor: '#fbf3e0',
        noteBorderColor: '#a87800',
        fontSize: '15px'
      }
    });
    return mermaid;
  });
  return mermaidReady;
}

export async function renderDiagrams(root: HTMLElement): Promise<void> {
  const figures = root.querySelectorAll<HTMLElement>('[data-mermaid]');
  if (!figures.length) return;
  const mermaid = await loadMermaid();

  for (const [index, figure] of Array.from(figures).entries()) {
    const source = decodeURIComponent(figure.dataset['mermaid'] ?? '');
    try {
      const { svg } = await mermaid.render(`blog-mermaid-${Date.now()}-${index}`, source);
      figure.innerHTML = svg;
    } catch (err) {
      figure.innerHTML = `<p class="blog-error">Diagram failed to render: ${String((err as Error).message ?? err)
        .replace(/</g, '&lt;')}</p>`;
    }
  }
}

interface ChartFence {
  type: string;
  data: { labels?: unknown[]; datasets: Record<string, unknown>[] };
  options?: Record<string, unknown>;
  /** Shown under the chart. */
  caption?: string;
  /** Plot height in px (default 320). */
  height?: number;
}

type ChartInstance = { destroy(): void };

export async function renderCharts(root: HTMLElement): Promise<ChartInstance[]> {
  const figures = root.querySelectorAll<HTMLElement>('[data-chart]');
  if (!figures.length) return [];
  const { default: Chart } = await import('chart.js/auto');

  Chart.defaults.font.family = 'Geist, -apple-system, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = MUTED;
  Chart.defaults.borderColor = HAIR;

  const charts: ChartInstance[] = [];
  figures.forEach(figure => {
    let spec: ChartFence;
    try {
      spec = JSON.parse(decodeURIComponent(figure.dataset['chart'] ?? ''));
    } catch (err) {
      figure.innerHTML = `<p class="blog-error">Chart config isn't valid JSON: ${(err as Error).message}</p>`;
      return;
    }

    const { caption, height = 320, ...config } = spec;
    const isRadial = ['pie', 'doughnut', 'polarArea'].includes(config.type);
    applyPalette(config, isRadial);

    figure.innerHTML = `<div class="blog-chart-plot" style="height:${Number(height)}px"><canvas role="img"></canvas></div>`;
    const canvas = figure.querySelector('canvas')!;
    canvas.setAttribute('aria-label', caption ?? 'Chart');

    const multiSeries = config.data.datasets.length > 1;
    charts.push(
      new Chart(canvas, {
        ...config,
        options: deepMerge(
          {
            responsive: true,
            maintainAspectRatio: false,
            interaction: isRadial ? undefined : { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display: multiSeries || isRadial,
                position: 'top',
                align: 'start',
                labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: INK }
              },
              tooltip: {
                backgroundColor: INK,
                titleColor: SURFACE,
                bodyColor: SURFACE,
                padding: 10,
                cornerRadius: 4,
                boxPadding: 4,
                usePointStyle: true
              }
            },
            scales: isRadial
              ? undefined
              : {
                  x: { grid: { display: false }, border: { color: HAIR } },
                  y: { grid: { color: HAIR }, border: { display: false }, beginAtZero: true }
                }
          },
          config.options ?? {}
        )
      } as never)
    );

    figure.insertAdjacentHTML('beforeend', dataTable(config) + (caption ? `<figcaption>${escape(caption)}</figcaption>` : ''));
  });
  return charts;
}

function applyPalette(config: ChartFence, isRadial: boolean): void {
  config.data.datasets.forEach((dataset, i) => {
    if (isRadial) {
      const count = (dataset['data'] as unknown[]).length;
      dataset['backgroundColor'] ??= CHART_PALETTE.slice(0, count);
      dataset['borderColor'] ??= SURFACE;
      dataset['borderWidth'] ??= 2;
      return;
    }
    // Series beyond the sixth fold into neutral ink rather than reusing a hue.
    const color = CHART_PALETTE[i] ?? MUTED;
    const kind = (dataset['type'] as string) ?? config.type;
    if (kind === 'line') {
      dataset['borderColor'] ??= color;
      dataset['backgroundColor'] ??= dataset['fill'] ? `${color}1f` : color;
      dataset['borderWidth'] ??= 2;
      dataset['pointRadius'] ??= 4;
      dataset['pointHoverRadius'] ??= 6;
      dataset['pointBorderColor'] ??= SURFACE;
      dataset['pointBorderWidth'] ??= 2;
      dataset['tension'] ??= 0.3;
    } else {
      dataset['backgroundColor'] ??= color;
      dataset['borderRadius'] ??= 4;
      dataset['borderSkipped'] ??= 'start';
      dataset['borderColor'] ??= SURFACE;
      dataset['borderWidth'] ??= { top: 0, left: 1, right: 1, bottom: 0 };
    }
  });
}

/** Collapsible table of the chart's numbers, so the data is never colour-only or canvas-only. */
function dataTable(config: ChartFence): string {
  const labels = config.data.labels ?? [];
  if (!labels.length) return '';
  const head = config.data.datasets.map((d, i) => `<th>${escape(String(d['label'] ?? `Series ${i + 1}`))}</th>`).join('');
  const rows = labels
    .map((label, r) => {
      const cells = config.data.datasets.map(d => `<td>${escape(String((d['data'] as unknown[])[r] ?? ''))}</td>`).join('');
      return `<tr><th scope="row">${escape(String(label))}</th>${cells}</tr>`;
    })
    .join('');
  return `<details class="blog-chart-data"><summary>View data</summary><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></details>`;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object'
        ? deepMerge(current as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return out as T;
}
