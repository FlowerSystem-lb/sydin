import { cx } from "@/components/ui/utils";

export interface DocumentTimelineStep {
  label: string;
  /** A date or short note under the label, when the step has happened. */
  detail?: string | null;
  state: "done" | "current" | "upcoming" | "stopped";
}

/**
 * The life of a document as one row of steps: Created → Ordered → Received,
 * Draft → Issued → Paid. Answers "where is this in the process" without a
 * legend. A cancelled document ends in a stopped step so the row does not
 * pretend it is still moving.
 */
export default function DocumentTimeline({
  steps,
  className,
}: {
  steps: DocumentTimelineStep[];
  className?: string;
}) {
  return (
    <ol className={cx("doc-timeline", className)} aria-label="Progress">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={cx("doc-timeline-step", `doc-timeline-step-${step.state}`)}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="doc-timeline-marker" aria-hidden="true">
            {step.state === "done" ? "✓" : step.state === "stopped" ? "×" : index + 1}
          </span>
          <span className="doc-timeline-copy">
            <strong>{step.label}</strong>
            {step.detail && <small>{step.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}
