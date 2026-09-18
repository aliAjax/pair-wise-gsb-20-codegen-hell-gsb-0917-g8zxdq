import { useState } from "react";
import ObservationForm from "./ObservationForm";
import {
  contentToDraft,
  formatTime,
  ObservationContent,
  ObservationRecord,
  ObservationDraft,
} from "./types";

interface RecordCardProps {
  record: ObservationRecord;
  index: number;
  onToggleReviewFlag: (id: string) => void;
  onSaveReview: (id: string, draft: ObservationDraft) => void;
}

function StructureTag({
  name,
  confirmed,
}: {
  name: string;
  confirmed: boolean;
}) {
  return (
    <span className={confirmed ? "tag tag-confirmed" : "tag tag-unconfirmed"}>
      {confirmed ? "✓ " : "○ "}
      {name}
    </span>
  );
}

function VersionView({ content }: { content: ObservationContent }) {
  return (
    <dl className="version-grid">
      <div>
        <dt>样本类型</dt>
        <dd>{content.sampleType}</dd>
      </div>
      <div>
        <dt>染色方式</dt>
        <dd>{content.stain}</dd>
      </div>
      <div>
        <dt>放大倍数</dt>
        <dd>{content.magnification}x</dd>
      </div>
      <div>
        <dt>重点结构</dt>
        <dd className="tag-row">
          {content.structures.map((s) => (
            <StructureTag key={s.name} name={s.name} confirmed={s.confirmed} />
          ))}
        </dd>
      </div>
      <div className="version-desc">
        <dt>观察描述</dt>
        <dd>{content.description || "（未填写）"}</dd>
      </div>
    </dl>
  );
}

export default function RecordCard({
  record,
  index,
  onToggleReviewFlag,
  onSaveReview,
}: RecordCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const current = record.versions[record.versions.length - 1];
  const revisionCount = record.versions.length;
  const previous =
    record.versions.length > 1
      ? record.versions[record.versions.length - 2]
      : null;

  return (
    <article
      className={
        "record-card" + (reviewing ? " reviewing" : "") + (record.needsReview ? " flagged" : "")
      }
    >
      <div className="record-main">
        <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
        <div className="record-body">
          <div className="record-title-row">
            <h3>{current.sampleName}</h3>
            <div className="record-badges">
              <span className="badge badge-version">
                v{revisionCount}
                {previous ? ` · 复看于 ${formatTime(current.savedAt)}` : ""}
              </span>
              {record.needsReview && (
                <span className="badge badge-review">待复看</span>
              )}
            </div>
          </div>

          {!reviewing && <VersionView content={current} />}
          {!reviewing && (
            <p className="record-saved-at">
              当前结论保存时间：{formatTime(current.savedAt)}
            </p>
          )}

          {reviewing && (
            <div className="review-box">
              <p className="review-tip">
                提交后当前结论将被覆盖；上一版（
                {formatTime(current.savedAt)}）会完整保留在下方变更记录中。
              </p>
              <ObservationForm
                mode="review"
                initialDraft={contentToDraft(current)}
                submitLabel="保存复看结论并覆盖"
                onSubmit={(draft) => {
                  onSaveReview(record.id, draft);
                  setReviewing(false);
                  setShowHistory(true);
                }}
                onCancel={() => setReviewing(false)}
              />
            </div>
          )}

          {!reviewing && (
            <div className="record-actions">
              <button
                type="button"
                className="primary-action"
                onClick={() => setReviewing(true)}
              >
                标记复看并记录
              </button>
              <button
                type="button"
                className={record.needsReview ? "is-active-flag" : ""}
                onClick={() => onToggleReviewFlag(record.id)}
              >
                {record.needsReview ? "取消待复看标记" : "标记待复看"}
              </button>
              {revisionCount > 1 && (
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  {showHistory ? "收起变更记录" : `查看变更记录（${revisionCount} 版）`}
                </button>
              )}
            </div>
          )}

          {!reviewing && showHistory && revisionCount > 1 && (
            <div className="history-panel">
              <h4>完整变更记录</h4>
              <ol className="timeline">
                {[...record.versions].reverse().map((version, reverseIndex) => {
                  const versionNo = revisionCount - reverseIndex;
                  const isCurrent = versionNo === revisionCount;
                  return (
                    <li key={version.savedAt} className={isCurrent ? "timeline-current" : ""}>
                      <div className="timeline-head">
                        <span className="timeline-version">v{versionNo}</span>
                        <span className="timeline-time">
                          {formatTime(version.savedAt)}
                        </span>
                        {isCurrent && (
                          <span className="badge badge-current">当前结论</span>
                        )}
                        {versionNo === revisionCount - 1 && (
                          <span className="badge badge-old">上一版（已保留）</span>
                        )}
                      </div>
                      <VersionView content={version} />
                    </li>
                  );
                })}
              </ol>
              <p className="history-note">
                最近一次复看覆盖了 {formatTime(current.savedAt)} 之前的结论；上一版保存于{" "}
                {previous ? formatTime(previous.savedAt) : "—"}，内容如上可追溯。
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
