import type { Group } from "@/lib/task";
import { DEFAULT_THEME, GROUP_COLOR_COUNT, GROUP_COLOR_NAMES } from "@/lib/theme";

const SLOTS = Array.from({ length: GROUP_COLOR_COUNT }, (_, i) => i + 1);
const NAMES = GROUP_COLOR_NAMES[DEFAULT_THEME];

/** The name of a color slot, for text that says which color it is. */
export function colorName(slot: number): string {
  return NAMES[slot - 1] ?? "";
}

type Props = {
  /** Every group in use. A color that one of them has is taken. */
  groups: Group[];
  /** The selected color slot, or null when none is selected. */
  value: number | null;
  onChange: (slot: number) => void;
};

/**
 * The 8 group colors as a grid of squares, two columns by four rows. Each square is a radio
 * button with its color's name in it, so color is never the only cue. A color that another group
 * has stays in the grid but cannot be chosen, and says so. The chosen slot is sent as groupColor.
 * The base card colors are never in it.
 */
export function ColorGrid({ groups, value, onChange }: Props) {
  const taken = new Set(groups.map((group) => group.color));
  return (
    <fieldset className="color-grid">
      <legend>Group color</legend>
      <div className="swatches">
        {SLOTS.map((slot) => {
          const isTaken = taken.has(slot);
          return (
            <label
              key={slot}
              className="swatch"
              data-slot={slot}
              data-taken={isTaken ? "" : undefined}
            >
              <input
                type="radio"
                name="groupColor"
                value={slot}
                checked={value === slot}
                disabled={isTaken}
                onChange={() => onChange(slot)}
              />
              <span>{isTaken ? `${colorName(slot)}, taken` : colorName(slot)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
