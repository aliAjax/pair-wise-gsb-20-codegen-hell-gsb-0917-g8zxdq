import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const project = {
  id: "hxwl-06",
  port: 5106,
  title: "显微镜玻片观察",
  subtitle: "样本、多倍率视野与染色观察记录库",
  stack: "React + Vite + TypeScript + CSS",
  domain: "生物显微观察",
  users: ["实验课教师", "学生", "实验管理员"],
};

const SAMPLE_TYPES = ["植物组织", "动物组织", "微生物", "血液涂片"] as const;
type SampleType = (typeof SAMPLE_TYPES)[number];

/** 样本类型 → 允许的染色方式，用于保存前校验 */
const STAIN_COMPATIBILITY: Record<SampleType, string[]> = {
  植物组织: ["碘液", "亚甲基蓝", "清水（不染色）"],
  动物组织: ["亚甲基蓝", "伊红", "苏木精-伊红（HE）"],
  微生物: ["活体观察（不染色）", "革兰氏染色", "亚甲基蓝"],
  血液涂片: ["瑞氏染色", "吉姆萨染色"],
};

const ALL_STAINS = Array.from(new Set(Object.values(STAIN_COMPATIBILITY).flat()));
const MAGNIFICATIONS = [40, 100, 200, 400, 1000];
/** 低于该倍率时，细胞核不允许标记为已确认 */
const NUCLEUS_MIN_MAGNIFICATION = 400;

const STORAGE_KEY = "hxwl06-observations-v1";

/** 某一版观察结论的完整快照 */
interface ConclusionSnapshot {
  sampleName: string;
  sampleType: SampleType;
  stainMethod: string;
  magnification: number;
  keyStructures: string;
  nucleusConfirmed: boolean;
  fieldNotes: string;
}

/** 历史版本：被复看覆盖掉的旧结论，保留保存时间与内容 */
interface Revision extends ConclusionSnapshot {
  version: number;
  savedAt: string;
}

interface Observation extends ConclusionSnapshot {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** 旧版本，新的在前 */
  history: Revision[];
}

interface FormState {
  sampleName: string;
  sampleType: SampleType | "";
  stainMethod: string;
  magnification: string;
  keyStructures: string;
  nucleusConfirmed: boolean;
  fieldNotes: string;
}

type FormMode = { kind: "create" } | { kind: "reobserve"; id: string };

const emptyForm: FormState = {
  sampleName: "",
  sampleType: "",
  stainMethod: "",
  magnification: "",
  keyStructures: "",
  nucleusConfirmed: false,
  fieldNotes: "",
};

function seedObservations(): Observation[] {
  const seed: Array<ConclusionSnapshot & { id: string; createdAt: string }> = [
    {
      id: "seed-onion",
      sampleName: "洋葱表皮",
      sampleType: "植物组织",
      stainMethod: "碘液",
      magnification: 400,
      keyStructures: "细胞壁、细胞核",
      nucleusConfirmed: true,
      fieldNotes: "细胞壁清晰，细胞核可见",
      createdAt: "2026-09-18T08:30:00.000Z",
    },
    {
      id: "seed-blood",
      sampleName: "人血涂片",
      sampleType: "血液涂片",
      stainMethod: "瑞氏染色",
      magnification: 1000,
      keyStructures: "红细胞、白细胞",
      nucleusConfirmed: false,
      fieldNotes: "红细胞分布均匀",
      createdAt: "2026-09-18T08:40:00.000Z",
    },
    {
      id: "seed-paramecium",
      sampleName: "草履虫",
      sampleType: "微生物",
      stainMethod: "活体观察（不染色）",
      magnification: 200,
      keyStructures: "纤毛、伸缩泡",
      nucleusConfirmed: false,
      fieldNotes: "纤毛运动明显",
      createdAt: "2026-09-18T08:50:00.000Z",
    },
  ];
  return seed.map(({ createdAt, ...snapshot }) => ({
    ...snapshot,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    history: [],
  }));
}

function loadObservations(): Observation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Observation[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // 存储损坏时回退到示例数据
  }
  return seedObservations();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function snapshotText(s: ConclusionSnapshot): string {
  return `${s.sampleType} · ${s.stainMethod} · ${s.magnification}x · 重点结构：${s.keyStructures} · 细胞核${s.nucleusConfirmed ? "已确认" : "未确认"}${s.fieldNotes ? ` · ${s.fieldNotes}` : ""}`;
}

/** 保存前校验，返回错误原因列表；为空则允许保存 */
function validateForm(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.sampleName.trim()) errors.push("请填写样本名称。");
  if (!form.sampleType) errors.push("请选择样本类型。");
  if (!form.stainMethod) errors.push("请选择染色方式。");
  if (!form.magnification) errors.push("请选择放大倍数。");
  if (!form.keyStructures.trim()) errors.push("请填写重点结构。");

  const magnification = Number(form.magnification);
  if (form.magnification && (!Number.isFinite(magnification) || magnification <= 0)) {
    errors.push("放大倍数无效。");
  }
  if (form.nucleusConfirmed && Number.isFinite(magnification) && magnification > 0 && magnification < NUCLEUS_MIN_MAGNIFICATION) {
    errors.push(`放大倍数低于 ${NUCLEUS_MIN_MAGNIFICATION}x 时无法可靠辨认细胞核，不能把细胞核标为已确认；请提高倍率或取消勾选。`);
  }
  if (form.sampleType && form.stainMethod && !STAIN_COMPATIBILITY[form.sampleType].includes(form.stainMethod)) {
    errors.push(
      `染色方式「${form.stainMethod}」不适用于样本类型「${form.sampleType}」。该类型可选：${STAIN_COMPATIBILITY[form.sampleType].join("、")}。`,
    );
  }
  return errors;
}

function formToSnapshot(form: FormState): ConclusionSnapshot {
  return {
    sampleName: form.sampleName.trim(),
    sampleType: form.sampleType as SampleType,
    stainMethod: form.stainMethod,
    magnification: Number(form.magnification),
    keyStructures: form.keyStructures.trim(),
    nucleusConfirmed: form.nucleusConfirmed,
    fieldNotes: form.fieldNotes.trim(),
  };
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `obs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: number; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [observations, setObservations] = useState<Observation[]>(loadObservations);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<FormMode>({ kind: "create" });
  const [errors, setErrors] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<"全部" | SampleType>("全部");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
  }, [observations]);

  const metrics = useMemo(() => {
    const stains = new Set(observations.map((o) => o.stainMethod));
    const structures = new Set(
      observations.flatMap((o) => o.keyStructures.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)),
    );
    const revisionCount = observations.reduce((sum, o) => sum + o.history.length, 0);
    return [
      { label: "样本数", value: observations.length },
      { label: "视野记录", value: observations.length + revisionCount },
      { label: "染色方法", value: stains.size },
      { label: "重点结构", value: structures.size },
    ];
  }, [observations]);

  const filtered = useMemo(
    () => (typeFilter === "全部" ? observations : observations.filter((o) => o.sampleType === typeFilter)),
    [observations, typeFilter],
  );

  const reobserveTarget = mode.kind === "reobserve" ? observations.find((o) => o.id === mode.id) : undefined;

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const resetForm = () => {
    setForm(emptyForm);
    setMode({ kind: "create" });
    setErrors([]);
  };

  const handleSubmit = () => {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    const snapshot = formToSnapshot(form);
    const now = new Date().toISOString();

    if (mode.kind === "create") {
      const observation: Observation = {
        ...snapshot,
        id: makeId(),
        version: 1,
        createdAt: now,
        updatedAt: now,
        history: [],
      };
      setObservations((prev) => [observation, ...prev]);
    } else {
      const targetId = mode.id;
      setObservations((prev) =>
        prev.map((o) => {
          if (o.id !== targetId) return o;
          // 复看：新结论覆盖当前内容，旧版本连同保存时间一起进入历史
          const previous: Revision = {
            version: o.version,
            savedAt: o.updatedAt,
            sampleName: o.sampleName,
            sampleType: o.sampleType,
            stainMethod: o.stainMethod,
            magnification: o.magnification,
            keyStructures: o.keyStructures,
            nucleusConfirmed: o.nucleusConfirmed,
            fieldNotes: o.fieldNotes,
          };
          return {
            ...o,
            ...snapshot,
            version: o.version + 1,
            updatedAt: now,
            history: [previous, ...o.history],
          };
        }),
      );
    }
    resetForm();
  };

  const startReobserve = (observation: Observation) => {
    setMode({ kind: "reobserve", id: observation.id });
    setForm({
      sampleName: observation.sampleName,
      sampleType: observation.sampleType,
      stainMethod: observation.stainMethod,
      magnification: String(observation.magnification),
      keyStructures: observation.keyStructures,
      nucleusConfirmed: observation.nucleusConfirmed,
      fieldNotes: observation.fieldNotes,
    });
    setErrors([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportSummary = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      observations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hxwl06-观察记录-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const magnificationValue = Number(form.magnification);
  const nucleusBlocked =
    form.nucleusConfirmed && Number.isFinite(magnificationValue) && magnificationValue > 0 && magnificationValue < NUCLEUS_MIN_MAGNIFICATION;
  const stainMismatch =
    form.sampleType !== "" && form.stainMethod !== "" && !STAIN_COMPATIBILITY[form.sampleType].includes(form.stainMethod);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}，每次复看自动留痕，刷新后仍可追溯完整变更。</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>按样本类型筛选</h2>
          <div className="chips muted">
            {(["全部", ...SAMPLE_TYPES] as const).map((type) => (
              <button
                key={type}
                className={typeFilter === type ? "chip-active" : ""}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>{mode.kind === "reobserve" ? `复看：${reobserveTarget?.sampleName ?? ""}（当前 v${reobserveTarget?.version ?? "?"}）` : "新增观察"}</h2>
            </div>
            {mode.kind === "reobserve" && (
              <button onClick={resetForm}>取消复看</button>
            )}
          </div>

          {errors.length > 0 && (
            <div className="error-box" role="alert">
              <strong>无法保存，请先处理以下问题：</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="field-grid">
            <label>
              <span>样本名称 *</span>
              <input
                value={form.sampleName}
                placeholder="如：洋葱表皮"
                onChange={(e) => updateForm({ sampleName: e.target.value })}
              />
            </label>
            <label>
              <span>样本类型 *</span>
              <select
                value={form.sampleType}
                onChange={(e) => updateForm({ sampleType: e.target.value as SampleType | "" })}
              >
                <option value="">请选择样本类型</option>
                {SAMPLE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              <span>染色方式 *</span>
              <select
                value={form.stainMethod}
                onChange={(e) => updateForm({ stainMethod: e.target.value })}
              >
                <option value="">请选择染色方式</option>
                {ALL_STAINS.map((stain) => (
                  <option key={stain} value={stain}>{stain}</option>
                ))}
              </select>
              {form.sampleType && (
                <small className={stainMismatch ? "hint warn-text" : "hint"}>
                  {stainMismatch
                    ? `「${form.stainMethod}」不适用于「${form.sampleType}」，保存将被阻止。`
                    : `「${form.sampleType}」适用：${STAIN_COMPATIBILITY[form.sampleType].join("、")}`}
                </small>
              )}
            </label>
            <label>
              <span>放大倍数 *</span>
              <select
                value={form.magnification}
                onChange={(e) => updateForm({ magnification: e.target.value })}
              >
                <option value="">请选择放大倍数</option>
                {MAGNIFICATIONS.map((mag) => (
                  <option key={mag} value={String(mag)}>{mag}x</option>
                ))}
              </select>
            </label>
            <label>
              <span>重点结构 *</span>
              <input
                value={form.keyStructures}
                placeholder="如：细胞壁、细胞核"
                onChange={(e) => updateForm({ keyStructures: e.target.value })}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.nucleusConfirmed}
                onChange={(e) => updateForm({ nucleusConfirmed: e.target.checked })}
              />
              <span>细胞核已确认（需 ≥ {NUCLEUS_MIN_MAGNIFICATION}x）</span>
              {nucleusBlocked && (
                <small className="hint warn-text">当前倍率低于 {NUCLEUS_MIN_MAGNIFICATION}x，保存将被阻止。</small>
              )}
            </label>
            <label className="full-row">
              <span>视野描述</span>
              <textarea
                value={form.fieldNotes}
                placeholder="补充视野中的形态、分布、运动等细节"
                rows={3}
                onChange={(e) => updateForm({ fieldNotes: e.target.value })}
              />
            </label>
          </div>

          <div className="form-actions">
            <button className="primary-action" onClick={handleSubmit}>
              {mode.kind === "reobserve" ? "保存复看结论（覆盖当前版本并留痕）" : "保存观察记录"}
            </button>
            {mode.kind === "reobserve" && (
              <p className="hint">保存后当前 v{reobserveTarget?.version} 结论将进入历史，新版本为 v{(reobserveTarget?.version ?? 1) + 1}。</p>
            )}
          </div>
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>{typeFilter === "全部" ? "全部样本" : typeFilter}</p>
            <h2>观察记录（{filtered.length}）</h2>
          </div>
          <button onClick={exportSummary}>导出摘要</button>
        </div>
        <div className="record-list">
          {filtered.length === 0 && <p className="empty-state">当前筛选下暂无记录。</p>}
          {filtered.map((observation, index) => (
            <article key={observation.id} className="record-card">
              <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="record-body">
                <div className="record-title">
                  <h3>{observation.sampleName}</h3>
                  <span className="badge">v{observation.version}</span>
                  {observation.history.length > 0 && (
                    <span className="badge badge-review">复看 {observation.history.length} 次</span>
                  )}
                  <span className={observation.nucleusConfirmed ? "badge badge-ok" : "badge badge-muted"}>
                    细胞核{observation.nucleusConfirmed ? "已确认" : "未确认"}
                  </span>
                </div>
                <p>{snapshotText(observation)}</p>
                <p className="record-time">更新于 {formatTime(observation.updatedAt)} · 创建于 {formatTime(observation.createdAt)}</p>

                {observation.history.length > 0 && (
                  <div className="history">
                    <button className="link-button" onClick={() => toggleExpanded(observation.id)}>
                      {expandedIds.has(observation.id) ? "收起变更追溯" : `变更追溯（${observation.history.length} 个历史版本）`}
                    </button>
                    {expandedIds.has(observation.id) && (
                      <ol className="history-list">
                        {observation.history.map((revision) => (
                          <li key={`${observation.id}-v${revision.version}`}>
                            <strong>v{revision.version}</strong>
                            <span className="history-time">保存于 {formatTime(revision.savedAt)}</span>
                            <p>{revision.sampleName} · {snapshotText(revision)}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
              <div className="record-actions">
                <button onClick={() => startReobserve(observation)}>标记复看</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
