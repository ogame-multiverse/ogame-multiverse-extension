/** Ways to cancel a pending confirmation:
 *  - 'escape': Escape key while the button has the focus;
 *  - 'outsideClick': pointer press anywhere outside the button and the CancelElement;
 *  - 'blur': the button loses the focus (click elsewhere, Tab key...);
 *  - 'timeout': TimeoutMs elapsed since the end of the anti double-click delay;
 *  - 'cancelElement': click on the CancelElement. */
export type ConfirmCancelMethod = 'escape' | 'outsideClick' | 'blur' | 'timeout' | 'cancelElement';

export interface ConfirmableButtonOptions {
    /** Label displayed while the button is armed, already translated (ex: "Click again to confirm"). */
    ConfirmLabel: string;
    /** Called when the confirming click happens. */
    OnConfirm: () => void | Promise<void>;
    /** Element whose text is replaced while armed (ex: a <span> next to an icon). When omitted, the button itself is
     *  used only if it has no child element, so an icon inside the button is never wiped out. */
    LabelElement?: HTMLElement | null;
    /** Optional element (ex: a "Cancel" button) tied to the confirmation: it gets the armed class while the button is
     *  armed (so CSS can show it only then), and clicking it cancels the confirmation (needs the 'cancelElement'
     *  cancel method, which is part of the defaults). */
    CancelElement?: HTMLElement | null;
    /** Anti double-click delay: after the first click, clicks are ignored for this long, so a hasty double click can
     *  never confirm. While waiting, the button has the locked class and aria-disabled="true". Default: 0 (no delay). */
    ConfirmDelayMs?: number;
    /** Which ways of canceling are enabled. Default: all of them. Only the listed ones are active, e.g.
     *  ['outsideClick', 'cancelElement'] means no Escape key, no focus loss and no timeout. */
    CancelMethods?: ConfirmCancelMethod[];
    /** Only used with the 'timeout' cancel method: how long the confirming click is accepted once the delay is over;
     *  then the button disarms by itself. Counted from the end of the delay, so it can never be eaten by it.
     *  Default: 5000 ms. */
    TimeoutMs?: number;
    /** CSS class added while armed, to style the "waiting for confirmation" state. Default: "is-armed". */
    ArmedClass?: string;
    /** CSS class added while armed but still inside the anti double-click delay. Default: "is-locked". */
    LockedClass?: string;
}

/**
 * Two-step confirmation on a button, without any modal dialog:
 *  - 1st click: the button is armed (CSS class added, label / aria-label / title replaced by the confirmation label);
 *  - optional anti double-click delay (ConfirmDelayMs) during which clicks are ignored;
 *  - confirming click while armed and unlocked: OnConfirm is called and the button goes back to normal;
 *  - the confirmation can be canceled at any time (even during the delay) by the enabled CancelMethods (all by
 *    default), or programmatically with Disarm().
 *
 * Usage:
 *   new ConfirmableButton(button, {
 *       ConfirmLabel: Localizator.Translate('ClickAgainToConfirm'),
 *       LabelElement: button.querySelector('.my-button-label'),
 *       ConfirmDelayMs: 1000,
 *       OnConfirm: () => DoTheDangerousThing(),
 *   });
 */
export class ConfirmableButton {
    private static readonly DEFAULT_CONFIRM_DELAY_MS = 0;
    private static readonly DEFAULT_TIMEOUT_MS = 5000;
    private static readonly ALL_CANCEL_METHODS: ConfirmCancelMethod[] = ['escape', 'outsideClick', 'blur', 'timeout', 'cancelElement'];
    private static readonly DEFAULT_ARMED_CLASS = 'is-armed';
    private static readonly DEFAULT_LOCKED_CLASS = 'is-locked';

    private readonly labelElement: HTMLElement | null;
    private readonly cancelElement: HTMLElement | null;
    private readonly cancelMethods: ReadonlySet<ConfirmCancelMethod>;
    private readonly confirmDelayMs: number;
    private readonly timeoutMs: number;
    private readonly armedClass: string;
    private readonly lockedClass: string;

    private armed = false;
    private locked = false;
    private unlockTimeoutId: number | undefined;
    private disarmTimeoutId: number | undefined;
    private restorePreviousLabels: (() => void) | undefined;

    constructor(private readonly button: HTMLButtonElement, private readonly options: ConfirmableButtonOptions) {
        this.labelElement = options.LabelElement ?? (button.childElementCount === 0 ? button : null);
        this.cancelElement = options.CancelElement ?? null;
        this.cancelMethods = new Set(options.CancelMethods ?? ConfirmableButton.ALL_CANCEL_METHODS);
        this.confirmDelayMs = Math.max(0, options.ConfirmDelayMs ?? ConfirmableButton.DEFAULT_CONFIRM_DELAY_MS);
        this.timeoutMs = options.TimeoutMs ?? ConfirmableButton.DEFAULT_TIMEOUT_MS;
        this.armedClass = options.ArmedClass ?? ConfirmableButton.DEFAULT_ARMED_CLASS;
        this.lockedClass = options.LockedClass ?? ConfirmableButton.DEFAULT_LOCKED_CLASS;

        button.addEventListener('click', this.OnClick);
        if (this.cancelMethods.has('blur')) button.addEventListener('blur', this.OnBlur);
        if (this.cancelMethods.has('escape')) button.addEventListener('keydown', this.OnKeyDown);
        if (this.cancelMethods.has('cancelElement')) this.cancelElement?.addEventListener('click', this.OnCancelClick);
    }

    public get IsArmed(): boolean {
        return this.armed;
    }

    /** True while armed but still inside the anti double-click delay (confirming clicks are ignored). */
    public get IsLocked(): boolean {
        return this.locked;
    }

    /** Cancels a pending confirmation and restores the button as it was. No-op when not armed. */
    public Disarm(): void {
        if (!this.armed) return;

        window.clearTimeout(this.unlockTimeoutId);
        window.clearTimeout(this.disarmTimeoutId);
        this.unlockTimeoutId = undefined;
        this.disarmTimeoutId = undefined;

        document.removeEventListener('pointerdown', this.OnDocumentPointerDown, true);

        this.armed = false;
        this.SetLocked(false);
        this.button.classList.remove(this.armedClass);
        this.cancelElement?.classList.remove(this.armedClass);
        this.restorePreviousLabels?.();
        this.restorePreviousLabels = undefined;
    }

    /** Removes the listeners and the pending timers. Only needed when the button outlives its owner. */
    public Dispose(): void {
        this.Disarm();
        this.button.removeEventListener('click', this.OnClick);
        this.button.removeEventListener('blur', this.OnBlur);
        this.button.removeEventListener('keydown', this.OnKeyDown);
        this.cancelElement?.removeEventListener('click', this.OnCancelClick);
    }

    private readonly OnClick = (): void => {
        if (!this.armed) {
            this.Arm();
        } else if (!this.locked) {
            this.Disarm();
            void this.options.OnConfirm();
        }
    };

    private readonly OnBlur = (): void => this.Disarm();

    private readonly OnCancelClick = (): void => this.Disarm();

    private readonly OnDocumentPointerDown = (event: Event): void => {
        const target = event.target as Node | null;
        if (target && (this.button.contains(target) || this.cancelElement?.contains(target))) return;
        this.Disarm();
    };

    private readonly OnKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') this.Disarm();
    };

    private Arm(): void {
        const label = this.options.ConfirmLabel;
        const previousText = this.labelElement?.textContent ?? null;
        const previousAriaLabel = this.button.getAttribute('aria-label');
        const previousTitle = this.button.getAttribute('title');

        this.restorePreviousLabels = () => {
            if (this.labelElement && previousText !== null) this.labelElement.textContent = previousText;
            ConfirmableButton.RestoreAttribute(this.button, 'aria-label', previousAriaLabel);
            ConfirmableButton.RestoreAttribute(this.button, 'title', previousTitle);
        };

        if (this.labelElement) this.labelElement.textContent = label;
        this.button.setAttribute('aria-label', label);
        this.button.setAttribute('title', label);
        this.button.classList.add(this.armedClass);
        this.cancelElement?.classList.add(this.armedClass);
        this.armed = true;

        // Only listened to while armed. The pointerdown of the arming click already happened, so it cannot cancel it.
        if (this.cancelMethods.has('outsideClick')) document.addEventListener('pointerdown', this.OnDocumentPointerDown, true);

        if (this.confirmDelayMs > 0) {
            this.SetLocked(true);
            this.unlockTimeoutId = window.setTimeout(() => this.Unlock(), this.confirmDelayMs);
        } else {
            this.StartConfirmationWindow();
        }
    }

    private Unlock(): void {
        this.unlockTimeoutId = undefined;
        this.SetLocked(false);
        this.StartConfirmationWindow();
    }

    private StartConfirmationWindow(): void {
        if (!this.cancelMethods.has('timeout')) return;
        this.disarmTimeoutId = window.setTimeout(() => this.Disarm(), this.timeoutMs);
    }

    private SetLocked(locked: boolean): void {
        this.locked = locked;
        this.button.classList.toggle(this.lockedClass, locked);
        if (locked) this.button.setAttribute('aria-disabled', 'true');
        else this.button.removeAttribute('aria-disabled');
    }

    private static RestoreAttribute(element: HTMLElement, name: string, previousValue: string | null): void {
        if (previousValue === null) element.removeAttribute(name);
        else element.setAttribute(name, previousValue);
    }
}