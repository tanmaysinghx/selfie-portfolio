import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  AfterViewInit,
  SimpleChanges,
  inject
} from '@angular/core';

@Directive({
  selector: '[appHairlineArt]',
  standalone: true
})
export class HairlineArtDirective implements AfterViewInit, OnChanges {
  private el = inject(ElementRef<HTMLElement>);

  @Input('appHairlineArt') figureName: string = 'laptop';
  @Input() controlElement?: HTMLElement;
  @Input() isActive: boolean = false;

  private handle: any = null;

  ngAfterViewInit(): void {
    this.mountFigure();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isActive'] && this.handle) {
      this.handle.activate(this.isActive);
    }
  }

  private mountFigure(): void {
    const win = window as any;
    if (win && win.HomeIdentityFigures && this.el.nativeElement) {
      try {
        const control = this.controlElement || this.el.nativeElement;
        this.handle = win.HomeIdentityFigures.mount(
          this.figureName,
          this.el.nativeElement,
          control
        );
        if (this.handle && this.isActive) {
          this.handle.activate(true);
        }
      } catch (e) {
        console.warn('Hairline figure mount warning:', e);
      }
    } else {
      // Retry in 100ms if script is deferred
      setTimeout(() => this.mountFigure(), 100);
    }
  }
}
