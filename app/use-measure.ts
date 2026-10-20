import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether the element has more content than fits, so it scrolls. It is checked again when the
 * element is resized and when `key` changes, which is when its content changes.
 */
export function useOverflows(ref: RefObject<HTMLElement | null>, key: unknown): boolean {
  const [overflows, setOverflows] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);

  // One observer for as long as the component lives. The element it watches can change, because
  // the focus card is a new element on every move, so the effect below points it at the current one.
  useEffect(() => {
    const watcher = new ResizeObserver((entries) => {
      for (const { target } of entries) setOverflows(target.scrollHeight > target.clientHeight);
    });
    observer.current = watcher;
    return () => {
      watcher.disconnect();
      observer.current = null;
    };
  }, []);

  // Measures when the content changes, and watches the element it is now measuring.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflows(false);
      return;
    }
    setOverflows(element.scrollHeight > element.clientHeight);
    const watcher = observer.current;
    watcher?.observe(element);
    return () => watcher?.unobserve(element);
  }, [ref, key]);

  return overflows;
}

/**
 * Whether the target is inside a box that has more text than fits, so the box scrolls itself.
 * The wheel and Home and End are left to such a box. The boxes are named by class: the
 * description box in info-card.tsx and the focus card in name-card.tsx.
 */
export function scrollsItself(target: Element): boolean {
  const box = target.closest<HTMLElement>(".info-description, .name-card");
  return box !== null && box.scrollHeight > box.clientHeight;
}
