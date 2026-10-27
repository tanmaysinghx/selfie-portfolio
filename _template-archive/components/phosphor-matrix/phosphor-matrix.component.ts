import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

@Component({
  selector: 'app-phosphor-matrix',
  standalone: true,
  template: `
    <div class="relative w-full aspect-[5/4] max-w-[380px] mx-auto flex items-center justify-center overflow-hidden">
      <canvas
        #canvas
        (mousemove)="onMouseMove($event)"
        (mouseleave)="onMouseLeave()"
        class="w-full h-full cursor-crosshair">
      </canvas>
    </div>
  `
})
export class PhosphorMatrixComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private animId: number = 0;
  private time: number = 0;
  private mouse = { x: -1000, y: -1000, isHovering: false };

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.resize();
  };

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  onMouseMove(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.isHovering = true;
  }

  onMouseLeave(): void {
    this.mouse.isHovering = false;
  }

  private animate = () => {
    this.time += 0.04;
    this.render();
    this.animId = requestAnimationFrame(this.animate);
  };

  private render(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    const cols = 22;
    const rows = 14;
    const colStep = width / (cols + 1);
    const rowStep = height / (rows + 1);

    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        const x = c * colStep;
        const y = r * rowStep;

        // Wave formula representing synthetic voice / sound wave
        const wave = Math.sin(this.time + c * 0.35 + r * 0.25) * 0.5 + 0.5;
        
        // Distance to mouse pointer
        let dist = 1000;
        if (this.mouse.isHovering) {
          const dx = this.mouse.x - x;
          const dy = this.mouse.y - y;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        const hoverBoost = Math.max(0, 1 - dist / 90);
        const radius = 1.2 + wave * 2.2 + hoverBoost * 3.5;
        const alpha = Math.min(1, 0.2 + wave * 0.45 + hoverBoost * 0.55);

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        
        // If mouse is near, shift toward accent ink #a44224, else muted ink
        if (hoverBoost > 0.1) {
          this.ctx.fillStyle = `rgba(164, 66, 36, ${alpha})`;
        } else {
          this.ctx.fillStyle = `rgba(107, 99, 90, ${alpha})`;
        }
        this.ctx.fill();
      }
    }
  }
}
