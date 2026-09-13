import { cx } from "@/components/ui/utils";
import { formatExactPrice } from "@/app/lib/currency";

/**
 * The document as it is being built, updating on every keystroke -- brief
 * point 16, "edit left, preview right". Not the PDF itself (that would mean
 * re-rendering a jsPDF document on every keystroke); a lighter mimic of the
 * same shape -- header, from/to, lines, total -- so what will be printed is
 * never a surprise once Save is pressed.
 */
export interface DocumentPreviewLine {
  key: string;
  name: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
}

export interface DocumentPreviewProps {
  kind: string;
  number: string;
  meta?: string | null;
  businessName: string;
  businessLogoUrl?: string | null;
  partyLabel: string;
  partyName?: string | null;
  partyContact?: string | null;
  /** Right-hand small column under the header: date, depot, terms. */
  detailRows: string[];
  lines: DocumentPreviewLine[];
  emptyMessage: string;
  currency: string;
  total: number;
  notes?: string | null;
  className?: string;
}

export default function DocumentPreview({
  kind,
  number,
  meta,
  businessName,
  businessLogoUrl,
  partyLabel,
  partyName,
  partyContact,
  detailRows,
  lines,
  emptyMessage,
  currency,
  total,
  notes,
  className,
}: DocumentPreviewProps) {
  return (
    <aside className={cx("doc-preview", className)} aria-label={`${kind} preview`}>
      <div className="doc-preview-card">
        <div className="doc-preview-head">
          <div className="doc-preview-brand">
            {businessLogoUrl ? (
              // A tiny header thumbnail from a user-supplied URL; next/image's
              // optimizer gains nothing here and cannot run on all hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={businessLogoUrl} alt="" className="doc-preview-logo" />
            ) : (
              <span className="doc-preview-logo doc-preview-logo-placeholder" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="doc-preview-business">{businessName || "Your business"}</span>
              <span className="doc-preview-kind">{kind}</span>
            </span>
          </div>
          <div className="doc-preview-number">
            <span>{number || "—"}</span>
            {meta && <small>{meta}</small>}
          </div>
        </div>

        <div className="doc-preview-body">
          <div className="doc-preview-parties">
            <div>
              <p className="doc-preview-label">{partyLabel}</p>
              <p className="doc-preview-value">{partyName || "Not set"}</p>
              {partyContact && <p className="doc-preview-muted">{partyContact}</p>}
            </div>
            {detailRows.length > 0 && (
              <div className="text-right">
                {detailRows.map((row) => (
                  <p key={row} className="doc-preview-muted">
                    {row}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="doc-preview-lines">
            {lines.length === 0 ? (
              <p className="doc-preview-empty">{emptyMessage}</p>
            ) : (
              <ul>
                {lines.map((line) => (
                  <li key={line.key}>
                    <span className="min-w-0">
                      <span className="doc-preview-line-name">
                        {line.name || "Untitled line"}
                      </span>
                      <span className="doc-preview-muted">
                        {line.quantity} {line.detail || ""}
                        {line.unitPrice !== null
                          ? ` × ${formatExactPrice(line.unitPrice, currency) || "--"}`
                          : ""}
                      </span>
                    </span>
                    <span className="doc-preview-line-total">
                      {formatExactPrice(line.lineTotal, currency) || "--"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="doc-preview-total">
            <span>Total</span>
            <strong>{formatExactPrice(total, currency) || "--"}</strong>
          </div>

          {notes?.trim() && (
            <div className="doc-preview-notes">
              <p className="doc-preview-label">Notes</p>
              <p>{notes}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
