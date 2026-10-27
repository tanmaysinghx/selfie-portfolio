import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StackConfig } from '../../../../core/models/portfolio.model';

interface TerminalLine {
  kind: 'input' | 'output' | 'error';
  text: string;
}

@Component({
  selector: 'app-stack',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section id="stack" class="py-20 scroll-mt-20" aria-labelledby="home-stack-title">
      <div class="container">
        <div class="mb-10 max-w-[640px]">
          <h2 id="home-stack-title" class="m-0 font-medium text-[clamp(28px,3.5vw,44px)] tracking-[-0.02em] leading-[1.15]">
            {{ stack?.heading }}
            <span class="heading-highlight">{{ stack?.highlight }}</span>
          </h2>
          <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed">{{ stack?.intro }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-8 lg:gap-12 items-start">
          <!-- Skill groups -->
          <dl class="m-0 flex flex-col divide-y divide-hair border-y border-hair">
            <div *ngFor="let g of stack?.groups" class="grid grid-cols-[130px_1fr] sm:grid-cols-[160px_1fr] gap-4 py-3.5">
              <dt class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted pt-1">{{ g.label }}</dt>
              <dd class="m-0 flex flex-wrap gap-x-3 gap-y-1">
                <span *ngFor="let item of g.items; let last = last" class="text-[15px] text-fg">
                  {{ item }}<span *ngIf="!last" class="text-hair-2 pl-3" aria-hidden="true">/</span>
                </span>
              </dd>
            </div>
          </dl>

          <!-- Terminal -->
          <div class="bg-fg text-bg shadow-[0_24px_60px_-30px_rgba(26,24,22,0.6)] lg:sticky lg:top-24">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <span class="w-2.5 h-2.5 rounded-full bg-accent"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-white/25"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-white/25"></span>
              <span class="ml-3 font-mono text-[11px] tracking-[0.06em] text-white/50">~/tanmay · zsh</span>
            </div>

            <div
              #screen
              class="font-mono text-[12.5px] leading-[1.7] px-4 sm:px-5 py-4 h-[340px] overflow-y-auto cursor-text"
              (click)="focusInput()"
              role="log"
              aria-live="polite">
              <div *ngFor="let line of lines()" class="whitespace-pre-wrap break-words"
                   [ngClass]="{
                     'text-white/90': line.kind === 'input',
                     'text-white/60': line.kind === 'output',
                     'text-[#e8906f]': line.kind === 'error'
                   }"><span *ngIf="line.kind === 'input'" class="text-[#e8906f]">{{ stack?.terminal?.prompt }} </span>{{ line.text }}</div>

              <form (submit)="submit($event)" class="flex items-center gap-2">
                <label for="term-input" class="text-[#e8906f] shrink-0">{{ stack?.terminal?.prompt }}</label>
                <input
                  #input
                  id="term-input"
                  name="command"
                  [(ngModel)]="draft"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  (keydown)="onKeydown($event)"
                  class="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-white caret-[#e8906f] p-0 font-mono text-[12.5px]"
                  aria-label="Terminal command" />
              </form>
            </div>

            <div class="flex flex-wrap gap-2 px-4 sm:px-5 py-3 border-t border-white/10">
              <button
                *ngFor="let c of stack?.terminal?.commands"
                type="button"
                (click)="run(c.command)"
                [title]="c.description"
                class="font-mono text-[11px] text-white/70 hover:text-white border border-white/15 hover:border-[#e8906f] bg-transparent px-2 py-1 cursor-pointer transition-colors">
                {{ c.command }}
              </button>
            </div>
          </div>
        </div>

        <!-- Certifications -->
        <div id="certifications" class="mt-16 scroll-mt-24">
          <h3 class="m-0 mb-5 text-[clamp(22px,2.4vw,28px)] font-medium tracking-[-0.02em]">{{ stack?.certificationsTitle }}</h3>
          <ul class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <li
              *ngFor="let cert of stack?.certifications; let i = index"
              class="cert relative bg-bg-2 border border-hair p-5 pt-6 flex flex-col gap-2 transition-transform duration-300"
              [style.--tilt]="(i % 2 === 0 ? -1 : 1) * 0.8 + 'deg'">
              <span
                class="absolute -top-3 right-4 w-12 h-12 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-mono text-[9px] tracking-[0.06em] uppercase rotate-[-12deg] bg-bg"
                aria-hidden="true">{{ cert.issuer === 'AWS' ? 'AWS' : 'MSFT' }}</span>
              <span class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted">{{ cert.issuer }} Certified</span>
              <span class="text-[17px] font-medium leading-snug pr-10">{{ cert.name }}</span>
              <span class="text-[12px] text-muted mt-auto">{{ cert.valid }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  `,
  styles: `
    .cert { transform: rotate(var(--tilt)); }
    .cert:hover { transform: rotate(0deg) translateY(-2px); }
  `
})
export class StackComponent {
  @Input() set stack(value: StackConfig | null) {
    this._stack = value;
    if (value && this.lines().length === 0) {
      this.lines.set(value.terminal.greeting.map(text => ({ kind: 'output' as const, text })));
    }
  }
  get stack(): StackConfig | null {
    return this._stack;
  }
  private _stack: StackConfig | null = null;

  @ViewChild('screen') screen?: ElementRef<HTMLDivElement>;
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;

  readonly lines = signal<TerminalLine[]>([]);
  draft = '';
  private history: string[] = [];
  private historyIndex = -1;

  focusInput(): void {
    this.input?.nativeElement.focus({ preventScroll: true });
  }

  submit(event: Event): void {
    event.preventDefault();
    this.run(this.draft);
    this.draft = '';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' && this.history.length) {
      event.preventDefault();
      this.historyIndex = Math.min(this.historyIndex + 1, this.history.length - 1);
      this.draft = this.history[this.history.length - 1 - this.historyIndex];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.historyIndex = Math.max(this.historyIndex - 1, -1);
      this.draft = this.historyIndex === -1 ? '' : this.history[this.history.length - 1 - this.historyIndex];
    }
  }

  run(raw: string): void {
    const command = raw.trim();
    if (!command) {
      return;
    }
    this.history.push(command);
    this.historyIndex = -1;

    if (command === 'clear') {
      this.lines.set([]);
      return;
    }

    const out: TerminalLine[] = [{ kind: 'input', text: command }];
    const known = this.stack?.terminal.commands.find(c => c.command === command.toLowerCase());

    if (command === 'help') {
      for (const c of this.stack?.terminal.commands ?? []) {
        out.push({ kind: 'output', text: `${c.command.padEnd(22)}${c.description}` });
      }
      out.push({ kind: 'output', text: `${'clear'.padEnd(22)}wipe the screen` });
    } else if (known) {
      out.push(...known.output.map(text => ({ kind: 'output' as const, text })));
      if (known.command === 'sudo hire tanmay') {
        setTimeout(() => (window.location.href = 'mailto:tanmaysinghx@gmail.com'), 900);
      }
    } else if (command.startsWith('rm ')) {
      out.push({ kind: 'error', text: 'Nice try. This shell is read-only, like a good audit log.' });
    } else {
      out.push({ kind: 'error', text: `command not found: ${command}. Try 'help'.` });
    }

    this.lines.update(lines => [...lines, ...out]);
    setTimeout(() => {
      const el = this.screen?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
