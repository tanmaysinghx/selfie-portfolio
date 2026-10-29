import { renderMarkdown } from './markdown';

describe('blog code editor panels', () => {
  it('preserves exact source for copying without line numbers or HTML interpretation', () => {
    const source = 'public class Sample {\n    // <button> & "quotes"\n    int count = 2;\n}\n';
    const { html } = renderMarkdown('```java\n' + source + '```', 'test');
    const root = document.createElement('div');
    root.innerHTML = html;
    const panel = root.querySelector<HTMLElement>('.blog-code')!;
    expect(decodeURIComponent(panel.dataset['code']!)).toBe(source.trimEnd());
    expect(root.querySelector('code')?.textContent).toBe(source.trimEnd());
    expect(root.querySelector('code button')).toBeNull();
    expect(root.querySelector('.blog-code-numbers')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('[data-copy]')?.getAttribute('aria-label')).toBe('Copy Sample.java');
  });

  it('accepts explicit filenames and leaves short snippets uncluttered', () => {
    const { html } = renderMarkdown('```java Example.java\nint answer = 42;\n```', 'test');
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('.blog-code-file')?.textContent).toBe('Example.java');
    expect(root.querySelector('.blog-code-numbers')).toBeNull();
    expect(root.querySelector('pre')?.getAttribute('tabindex')).toBe('0');
  });
});
