import tippy, { Instance as TippyInstance, Placement, Props as TippyProps } from 'tippy.js';

export interface TippyTooltipManagerOptions {
  theme?: string;
  placement?: Placement;
  boundary?: Element | (() => Element);
  maxWidth?: number | string;
  delay?: [number, number];
  fallbackPlacements?: Placement[];
  showPendingSpinner?: boolean;
}

export interface TooltipBinding {
  target: HTMLElement;
  content: string;
  shouldShow?: () => boolean;
  interactive?: boolean;
  delay?: [number, number] | number;
  props?: Partial<TippyProps>;
  showPendingSpinner?: boolean;
}

export class TippyTooltipManager {
  private instances: TippyInstance[] = [];

  private readonly theme?: string;
  private readonly placement: Placement;
  private readonly boundary: Element | (() => Element);
  private readonly maxWidth: number | string;
  private readonly delay: [number, number];
  private readonly fallbackPlacements: Placement[];
  private readonly showPendingSpinner: boolean;

  constructor(options: TippyTooltipManagerOptions = {}) {
    this.theme = options.theme;
    this.placement = options.placement ?? 'auto';
    this.boundary = options.boundary ?? document.body;
    this.maxWidth = options.maxWidth ?? 'none';
    this.delay = options.delay ?? [150, 0];
    this.fallbackPlacements = options.fallbackPlacements ?? ['top-start', 'bottom-end', 'top-end', 'right', 'left'];
    this.showPendingSpinner = options.showPendingSpinner ?? false;
  }

  private ResolveBoundary(): Element {
    return typeof this.boundary === 'function' ? this.boundary() : this.boundary;
  }


  public Attach(binding: TooltipBinding): TippyInstance {
    const { target, content, shouldShow, interactive, delay, props } = binding;
    const activeShowPendingSpinner = binding.showPendingSpinner ?? this.showPendingSpinner;

    let removeMouseMove: (() => void) | null = null;

    const cleanupPending = () => {
      document.body.classList.remove('tooltip-pending');
      if (removeMouseMove) {
        removeMouseMove();
        removeMouseMove = null;
      }
    };

    const instance = tippy(target, {
      content,
      allowHTML: true,
      theme: this.theme,
      arrow: true,
      placement: this.placement,
      appendTo: () => document.body,
      delay: delay ?? this.delay,
      maxWidth: this.maxWidth,
      interactive: interactive ?? false,
      popperOptions: {
        modifiers: [
          {
            name: 'preventOverflow',
            options: { boundary: () => this.ResolveBoundary(), padding: 8 },
          },
          {
            name: 'flip',
            options: { boundary: () => this.ResolveBoundary(), fallbackPlacements: this.fallbackPlacements },
          },
        ],
      },
      onTrigger: (inst, event) => {
        if (activeShowPendingSpinner && event && 'clientX' in event) {
          const mouseEvent = event as MouseEvent;
          cleanupPending();

          const updatePos = (e: MouseEvent) => {
            document.documentElement.style.setProperty('--tooltip-mouse-x', `${e.clientX + 14}px`);
            document.documentElement.style.setProperty('--tooltip-mouse-y', `${e.clientY + 14}px`);
          };

          updatePos(mouseEvent);
          document.body.classList.add('tooltip-pending');

          window.addEventListener('mousemove', updatePos);
          removeMouseMove = () => window.removeEventListener('mousemove', updatePos);
        }
      },
      onShow: (inst) => {
        cleanupPending();
        if (shouldShow && !shouldShow()) return false;
      },
      onUntrigger: () => cleanupPending(),
      onHide: () => cleanupPending(),
      onHidden: (inst) => {
        cleanupPending();
      },
      ...props,
    });

    this.instances.push(instance);
    return instance;
  }

  public AttachAll(bindings: Array<TooltipBinding | null | undefined>): TippyInstance[] {
    return bindings
      .filter((binding): binding is TooltipBinding => !!binding && !!binding.content)
      .map(binding => this.Attach(binding));
  }

  public SetContent(instance: TippyInstance, content: string): void {
    instance.setContent(content);
  }

  public DestroyAll(): void {
    this.instances.forEach(instance => instance.destroy());
    this.instances = [];
  }

  public get Count(): number {
    return this.instances.length;
  }
}