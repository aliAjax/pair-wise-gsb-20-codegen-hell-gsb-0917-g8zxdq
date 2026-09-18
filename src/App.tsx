import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import ObservationForm from "./ObservationForm";
import RecordCard from "./RecordCard";
import {
  createId,
  createSeedRecords,
  emptyDraft,
  ObservationDraft,
  ObservationRecord,
  ObservationVersion,
  SAMPLE_TYPES,
  STORAGE_KEY,
} from "./types";

type TypeFilter = "全部" | (typeof SAMPLE_TYPES)[number];
type ReviewFilter = "全部" | "待复看" | "已复看";

function loadRecords(): ObservationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ObservationRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 存储不可用时退回内置示例
  }
  return createSeedRecords();
}

function draftToVersion(draft: ObservationDraft): Omit<ObservationVersion, "savedAt"> {
  return {
    sampleName: draft.sampleName.trim(),
    sampleType: draft.sampleType as ObservationVersion["sampleType"],
    stain: draft.stain as ObservationVersion["stain"],
    magnification: draft.magnification as ObservationVersion["magnification"],
    structures: draft.structures
      .map((s) => ({ name: s.name.trim(), confirmed: s.confirmed }))
      .filter((s) => s.name),
    description: draft.description.trim(),
  };
}

function MetricCard({
  label,
  value,
  hint,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  index: number;
}) {
  const statusColors = ["status-ok", "status-watch", "status-danger", ""];
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [records, setRecords] = useState<ObservationRecord[]>(loadRecords);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("全部");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("全部");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // 忽略写入失败，内存中仍可继续使用
    }
  }, [records]);

  const addRecord = (draft: ObservationDraft) => {
    const record: ObservationRecord = {
      id: createId(),
      needsReview: false,
      versions: [{ ...draftToVersion(draft), savedAt: new Date().toISOString() }],
    };
    setRecords((prev) => [record, ...prev]);
  };

  const toggleReviewFlag = (id: string) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.id === id
          ? { ...record, needsReview: !record.needsReview }
          : record
      )
    );
  };

  const saveReview = (id: string, draft: ObservationDraft) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.id === id
          ? {
              ...record,
              needsReview: false,
              versions: [
                ...record.versions,
                { ...draftToVersion(draft), savedAt: new Date().toISOString() },
              ],
            }
          : record
      )
    );
  };

  const resetToSeeds = () => {
    if (
      window.confirm(
        "确定清空当前所有记录并恢复为洋葱表皮、人血涂片、草履虫三个示例吗？该操作不可撤销。"
      )
    ) {
      setRecords(createSeedRecords());
    }
  };

  const metrics = useMemo(() => {
    const current = records.map((r) => r.versions[r.versions.length - 1]);
    const stainSet = new Set(current.map((v) => v.stain));
    const confirmedSet = new Set(
      current.flatMap((v) =>
        v.structures.filter((s) => s.confirmed).map((s) => s.name)
      )
    );
    const reviewCount = records.filter(
      (r) => r.needsReview || r.versions.length > 1
    ).length;
    return [
      { label: "样本记录", value: String(records.length), hint: "含内置 3 个示例" },
      { label: "染色方法", value: String(stainSet.size), hint: "当前记录使用的染色方式" },
      { label: "已确认结构", value: String(confirmedSet.size), hint: "去重后的结构种类" },
      { label: "复看/待复看", value: String(reviewCount), hint: "每次复看均保留历史版本" },
    ];
  }, [records]);

  const visibleRecords = useMemo(() => {
    return records.filter((record) => {
      const current = record.versions[record.versions.length - 1];
      if (typeFilter !== "全部" && current.sampleType !== typeFilter) return false;
      if (reviewFilter === "待复看" && !record.needsReview) return false;
      if (reviewFilter === "已复看" && record.versions.length === 1) return false;
      return true;
    });
  }, [records, typeFilter, reviewFilter]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-06 · port 5106</p>
          <h1>显微镜玻片观察记录库</h1>
          <p className="subtitle">
            样本、多倍率视野与染色观察的可追溯记录：新建需填写样本类型、染色方式、放大倍数和重点结构；
            复看结论覆盖当前版本，历史版本完整保留，刷新后仍可追溯。
          </p>
        </div>
        <div className="stack-card">
          <span>数据保存</span>
          <strong>浏览器本地存储（localStorage）</strong>
          <small>首次打开内置洋葱表皮、人血涂片、草履虫三个示例</small>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            index={index}
          />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>按样本类型筛选</h2>
          <div className="chips muted filter-group">
            {(["全部", ...SAMPLE_TYPES] as TypeFilter[]).map((filter) => (
              <button
                key={filter}
                className={typeFilter === filter ? "chip-selected" : ""}
                onClick={() => setTypeFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <h2>按复看状态筛选</h2>
          <div className="chips muted filter-group">
            {(["全部", "待复看", "已复看"] as ReviewFilter[]).map((filter) => (
              <button
                key={filter}
                className={reviewFilter === filter ? "chip-selected" : ""}
                onClick={() => setReviewFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="rules-card">
            <h2>保存规则</h2>
            <ul>
              <li>样本类型、染色方式、放大倍数、重点结构均为必填。</li>
              <li>低于 400x 不能把细胞核标为已确认。</li>
              <li>染色方式须与样本类型匹配，否则阻止保存并说明原因。</li>
              <li>复看覆盖当前结论，但保留上一版的时间与完整内容。</li>
            </ul>
          </div>
          <button className="reset-button" onClick={resetToSeeds}>
            恢复内置示例
          </button>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>新建观察</p>
              <h2>录入新玻片记录</h2>
            </div>
          </div>
          <ObservationForm
            mode="create"
            initialDraft={emptyDraft()}
            submitLabel="保存观察记录"
            onSubmit={addRecord}
          />
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>观察记录库</p>
            <h2>
              记录列表（{visibleRecords.length}/{records.length}）
            </h2>
          </div>
        </div>
        {visibleRecords.length === 0 ? (
          <p className="empty-state">当前筛选条件下没有记录。</p>
        ) : (
          <div className="record-list">
            {visibleRecords.map((record, index) => (
              <RecordCard
                key={record.id}
                record={record}
                index={index}
                onToggleReviewFlag={toggleReviewFlag}
                onSaveReview={saveReview}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="app-footer">
        所有记录保存在本机浏览器中；刷新页面后记录与完整变更历史仍然保留。
      </footer>
    </main>
  );
}

export default App;
