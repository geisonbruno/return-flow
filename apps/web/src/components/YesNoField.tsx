interface YesNoFieldProps {
  name: string;
  label: string;
  /** `null` means "not answered yet" — distinct from `false`, so Close validation can tell an untouched decision from an explicit No. */
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** An explicit Yes/No radio group for a required warehouse decision — never a checkbox, per `apps/web/CLAUDE.md`'s guidance that a checkbox can't represent "not yet answered." */
export function YesNoField({ name, label, value, onChange, disabled }: YesNoFieldProps) {
  return (
    <fieldset className="yes-no-field">
      <legend>{label}</legend>
      <label className="yes-no-field__option">
        <input type="radio" name={name} checked={value === true} onChange={() => onChange(true)} disabled={disabled} />
        Yes
      </label>
      <label className="yes-no-field__option">
        <input type="radio" name={name} checked={value === false} onChange={() => onChange(false)} disabled={disabled} />
        No
      </label>
    </fieldset>
  );
}
