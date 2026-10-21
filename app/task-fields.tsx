import { useEffect, useId, useRef, useState } from "react";
import { findGroup, firstFreeColor } from "@/lib/group";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Group } from "@/lib/task";
import { GROUP_LIMIT_MESSAGE } from "@/lib/task-schema";
import { ColorGrid, colorName } from "./color-grid";

/** What the fields hold when the form opens. Add starts empty, and Edit starts with a task. */
export type TaskFieldValues = {
  name: string;
  group: string;
  dueDate: string;
  difficulty: string;
  description: string;
};

/**
 * The state of the task fields, which are controlled, and what follows from the group that is typed.
 * `groups` is every group in use, for the suggestions and for the colors that are taken, and it is
 * given back so the fields and what follows from them read the same list. The form is mounted each
 * time its dialog opens, and the first field takes the focus then.
 */
export function useTaskFields(initial: TaskFieldValues, groups: Group[]) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [group, setGroup] = useState(initial.group);
  const [picked, setPicked] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [description, setDescription] = useState(initial.description);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // The color follows from the group that is typed, with no state of its own to get out of step:
  // no group has no color, a group that exists keeps its own, and a new group picks one.
  const typedGroup = group.trim();
  const existing = typedGroup === "" ? undefined : findGroup(groups, typedGroup);
  const isNew = typedGroup !== "" && existing === undefined;
  const takenColors = new Set(groups.map((g) => g.color));
  const firstFree = firstFreeColor(takenColors);
  // A color the person picked that has been taken since is not kept, the first free one is used.
  const chosenColor = picked !== null && !takenColors.has(picked) ? picked : firstFree;
  const limitReached = isNew && firstFree === null;

  return {
    groups,
    nameRef,
    name,
    setName,
    group,
    setGroup,
    setPicked,
    dueDate,
    setDueDate,
    difficulty,
    setDifficulty,
    description,
    setDescription,
    existing,
    isNew,
    chosenColor,
    limitReached,
  };
}

export type TaskFieldsState = ReturnType<typeof useTaskFields>;

/** The fields of a task: name, group with its color, due date, difficulty and description. */
export function TaskFields({ fields }: { fields: TaskFieldsState }) {
  const ids = useId();
  const { groups, existing, isNew, limitReached } = fields;
  return (
    <>
      <div className="form-field">
        <label htmlFor={`${ids}-name`}>Name</label>
        <input
          ref={fields.nameRef}
          id={`${ids}-name`}
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          value={fields.name}
          onChange={(event) => fields.setName(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${ids}-group`}>Group (optional)</label>
        <input
          id={`${ids}-group`}
          name="group"
          type="text"
          list={`${ids}-groups`}
          maxLength={100}
          autoComplete="off"
          value={fields.group}
          onChange={(event) => fields.setGroup(event.target.value)}
        />
        <datalist id={`${ids}-groups`}>
          {groups.map((g) => (
            <option key={g.name} value={g.name} />
          ))}
        </datalist>
      </div>

      {existing && (
        <p className="form-note">
          Group color:{" "}
          <span className="swatch-chip" data-slot={existing.color}>
            {colorName(existing.color)}
          </span>
        </p>
      )}
      {isNew && !limitReached && (
        <ColorGrid groups={groups} value={fields.chosenColor} onChange={fields.setPicked} />
      )}
      {limitReached && (
        // Guidance, not a refusal: the person has not done anything wrong yet.
        <p className="form-notice" role="status">
          {GROUP_LIMIT_MESSAGE}
        </p>
      )}

      <div className="form-field">
        <label htmlFor={`${ids}-due`}>Due date</label>
        <input
          id={`${ids}-due`}
          name="dueDate"
          type="date"
          required
          value={fields.dueDate}
          onChange={(event) => fields.setDueDate(event.target.value)}
        />
      </div>

      <fieldset className="form-field">
        <legend>Difficulty</legend>
        <div className="choices">
          {DIFFICULTIES.map((value) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="difficulty"
                value={value}
                required
                checked={fields.difficulty === value}
                onChange={() => fields.setDifficulty(value)}
              />
              {DIFFICULTY_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${ids}-description`}>Description (optional)</label>
        <textarea
          id={`${ids}-description`}
          name="description"
          rows={3}
          maxLength={2000}
          value={fields.description}
          onChange={(event) => fields.setDescription(event.target.value)}
        />
      </div>
    </>
  );
}
