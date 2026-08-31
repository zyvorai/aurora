'use client';

import type { ChainStage } from '@/lib/chain';
import { chainStatusLabel } from '@/lib/chain';
import { SourceLink } from '@/components/sources/SourceLink';
import forgeStyles from './forge.module.css';

export function ForgeHeader({
  name,
  websiteUrl,
  stages,
}: {
  name: string;
  websiteUrl?: string | null;
  stages: ChainStage[];
}) {
  const doneCount = stages.filter((s) => s.status === 'done').length;
  const pct = stages.length ? Math.round((doneCount / stages.length) * 100) : 0;
  const label = chainStatusLabel(stages);

  return (
    <header className={forgeStyles.workspaceHero}>
      <div className="min-w-0 flex-1">
        <p className={forgeStyles.workspaceEyebrow}>Workspace</p>
        <h1 className={forgeStyles.workspaceTitle}>{name}</h1>
        {websiteUrl ? (
          <SourceLink urlOrKey={websiteUrl} variant="header" />
        ) : (
          <p className={forgeStyles.workspaceMeta}>{label}</p>
        )}
      </div>
      <div className={forgeStyles.progressSummary}>
        <p className={forgeStyles.progressSummaryValue}>
          {doneCount}
          <span className={forgeStyles.progressSummaryOf}>/{stages.length}</span>
        </p>
        <p className={forgeStyles.progressSummaryLabel}>stages complete</p>
        <div className={forgeStyles.progressSummaryBar} aria-hidden>
          <div className={forgeStyles.progressSummaryFill} style={{ width: `${pct}%` }} />
        </div>
        <p className={forgeStyles.progressSummaryStatus}>{label}</p>
      </div>
    </header>
  );
}

export function ForgeProgressRail({
  stages,
  activeId,
  onSelect,
}: {
  stages: ChainStage[];
  activeId?: string;
  onSelect?: (id: ChainStage['id']) => void;
}) {
  return (
    <div className={forgeStyles.progressCard}>
      <div className={forgeStyles.progressRail} aria-label="Pipeline progress">
        {stages.map((stage, i) => {
          const isActive = activeId === stage.id;
          const dotClass = [
            forgeStyles.progressDot,
            stage.status === 'done' && forgeStyles.progressDotDone,
            stage.status === 'need' && forgeStyles.progressDotNeed,
            (stage.status === 'run' || isActive) && forgeStyles.progressDotRun,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={stage.id} className={forgeStyles.progressStepCol}>
              <div className={forgeStyles.progressStep}>
                <button
                  type="button"
                  title={`${stage.label} — ${stage.status}`}
                  onClick={() => onSelect?.(stage.id)}
                  className={forgeStyles.progressStepBtn}
                  aria-label={stage.label}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className={dotClass} />
                </button>
                {i < stages.length - 1 ? (
                  <span
                    className={[
                      forgeStyles.progressLine,
                      stage.status === 'done' && forgeStyles.progressLineDone,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-hidden
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onSelect?.(stage.id)}
                className={[
                  forgeStyles.progressLabel,
                  isActive && forgeStyles.progressLabelActive,
                  stage.status === 'done' && forgeStyles.progressLabelDone,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {stage.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
