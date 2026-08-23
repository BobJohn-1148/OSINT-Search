/**
 * A native chain-of-thought view: the agent runtime already streams reasoning
 * steps (agent:step events with a status), so this renders them as a collapsible
 * timeline instead of pulling in a Tailwind/Radix component. Keeping it on the
 * app's theme tokens is why it can live beside the rest of the console without a
 * second styling system.
 */
import { AlertCircle, CheckCircle2, ChevronDown, Circle, Lightbulb, Loader2 } from "lucide-react";
import { useState, type ReactElement } from "react";

export type ThoughtStatus = "queued" | "running" | "complete" | "error";

export interface ThoughtStep {
  readonly id: string;
  readonly title: string;
  readonly status: ThoughtStatus;
  readonly summary?: string | null;
  readonly sources?: readonly string[];
}

export function ChainOfThought({ steps, defaultOpen = true }: { readonly steps: readonly ThoughtStep[]; readonly defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const completed = steps.filter((step) => step.status === "complete").length;

  return (
    <div className="cot">
      <button className="cot-header" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="cot-header-icon" aria-hidden="true">
          <Lightbulb size={15} />
        </span>
        <span className="cot-header-title">Chain of thought</span>
        <span className="cot-header-count">{steps.length > 0 ? `${completed}/${steps.length}` : "idle"}</span>
        <ChevronDown className={open ? "cot-chevron is-open" : "cot-chevron"} size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="cot-body">
          {steps.map((step, index) => (
            <div className={`cot-step cot-${step.status}`} key={step.id}>
              <div className="cot-rail">
                <span className="cot-step-icon" aria-hidden="true">{statusIcon(step.status)}</span>
                {index < steps.length - 1 ? <span className="cot-line" aria-hidden="true" /> : null}
              </div>
              <div className="cot-step-body">
                <strong>{step.title}</strong>
                {step.summary ? <p className="cot-summary">{step.summary}</p> : null}
                {step.sources && step.sources.length > 0 ? (
                  <div className="cot-sources">
                    {step.sources.slice(0, 4).map((source) => (
                      <span className="cot-source" key={source}>{source}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {steps.length === 0 ? <p className="status-text">No reasoning steps yet — run the agent to watch it think.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function statusIcon(status: ThoughtStatus): ReactElement {
  if (status === "complete") {
    return <CheckCircle2 size={15} />;
  }
  if (status === "running") {
    return <Loader2 className="cot-spin" size={15} />;
  }
  if (status === "error") {
    return <AlertCircle size={15} />;
  }
  return <Circle size={15} />;
}
