import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the element has more content than fits, so it scrolls. It is checked again when the
 * element is resized and when `key` changes, which is when its content changes.
 */
export function useOverflows(ref: RefObject<HTMLElement | null>, key: unknown): boolean {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflows(false);
      return;
    }
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
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
