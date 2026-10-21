import { useId, type KeyboardEvent, type ReactNode, type Ref } from "react";

type Props = {
  className: string;
  /** The question, which names the group for a screen reader. */
  label: ReactNode;
  /** Escape from either answer, from `useAsk`. */
  onKeyDown: (event: KeyboardEvent) => void;
  ref?: Ref<HTMLDivElement>;
  /** The two answers. */
  children: ReactNode;
};

/** The question that a button turns into: its words, and the answers under them. */
export function Question({ className, label, onKeyDown, ref, children }: Props) {
  const id = useId();
  return (
    // Escape closes the question from either button, so the one handler is on the group. The
    // group itself takes no focus and is not operated, only its buttons are.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div ref={ref} className={className} role="group" aria-labelledby={id} onKeyDown={onKeyDown}>
      <p id={id}>{label}</p>
      {children}
    </div>
  );
}
