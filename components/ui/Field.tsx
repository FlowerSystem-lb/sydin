import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/components/ui/utils";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  optional?: boolean;
  children: ReactElement<{
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  optional = false,
  children,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const messageId = `${generatedId}-${error ? "error" : "description"}`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby":
          error || description
            ? [children.props["aria-describedby"], messageId]
                .filter(Boolean)
                .join(" ")
            : children.props["aria-describedby"],
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cx("ui-form-field", className)}>
      <div className="ui-form-field-heading">
        <label htmlFor={htmlFor} className="ui-form-label">
          {label}
        </label>
        {optional && <span className="ui-form-optional">Optional</span>}
      </div>
      {control}
      {(error || description) && (
        <p
          id={messageId}
          className={error ? "ui-form-error" : "ui-form-description"}
          role={error ? "alert" : undefined}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx("ui-input", className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cx("ui-input ui-textarea", className)} {...props} />
  );
});
