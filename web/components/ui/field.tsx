interface Props {
  label?: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}

export function Field({ label, required, error, helper, children }: Props) {
  return (
    <div className="field">
      {label && (
        <label>
          {label}
          {required && <span className="req"> *</span>}
        </label>
      )}
      {children}
      {error && <div className="errmsg">{error}</div>}
      {helper && !error && <div className="helper">{helper}</div>}
    </div>
  );
}
