import {
  cloneElement,
  useId,
  type ReactElement,
} from "react";

export default function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const tooltipId = useId();
  const trigger = cloneElement(children, {
    "aria-describedby": [children.props["aria-describedby"], tooltipId]
      .filter(Boolean)
      .join(" "),
  });

  return (
    <span className="ui-tooltip">
      {trigger}
      <span id={tooltipId} role="tooltip" className="ui-tooltip-content">
        {content}
      </span>
    </span>
  );
}
