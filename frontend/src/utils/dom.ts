export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

export function qsa<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<HTMLElementTagNameMap[K]> & Record<string, string | boolean | number> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') element.className = String(val);
    else if (key === 'innerHTML') element.innerHTML = String(val);
    else if (typeof val === 'boolean') {
      if (val) element.setAttribute(key, '');
      else element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(val));
    }
  }
  for (const child of children) {
    element.append(child);
  }
  return element;
}

export function on<T extends EventTarget>(
  target: T,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): () => void {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

export function delegateEvent(
  parent: Element,
  selector: string,
  event: string,
  handler: (e: Event, target: Element) => void
): () => void {
  const listener = (e: Event) => {
    const target = (e.target as Element).closest(selector);
    if (target && parent.contains(target)) handler(e, target);
  };
  parent.addEventListener(event, listener);
  return () => parent.removeEventListener(event, listener);
}

export function clearChildren(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
