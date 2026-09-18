import { useState } from "react";
import {
  DraftErrors,
  emptyDraft,
  MAGNIFICATIONS,
  ObservationDraft,
  SAMPLE_TYPES,
  STAIN_METHODS,
  STAIN_RULES,
  STRUCTURE_SUGGESTIONS,
  SampleType,
  StainMethod,
  StructureMark,
  validateDraft,
} from "./types";

interface ObservationFormProps {
  mode: "create" | "review";
  initialDraft: ObservationDraft;
  submitLabel: string;
  onSubmit: (draft: ObservationDraft) => void;
  onCancel?: () => void;
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error" role="alert">{message}</p>;
}

export default function ObservationForm({
  mode,
  initialDraft,
  submitLabel,
  onSubmit,
  onCancel,
}: ObservationFormProps) {
  const [draft, setDraft] = useState<ObservationDraft>(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [customName, setCustomName] = useState("");

  const patch = <K extends keyof ObservationDraft>(
    key: K,
    value: ObservationDraft[K]
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  const addStructure = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (draft.structures.some((s) => s.name === trimmed)) return;
    setDraft((prev) => ({
      ...prev,
      structures: [...prev.structures, { name: trimmed, confirmed: false }],
    }));
    setCustomName("");
  };

  const toggleConfirmed = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      structures: prev.structures.map((s, i) =>
        i === index ? { ...s, confirmed: !s.confirmed } : s
      ),
    }));
  };

  const removeStructure = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      structures: prev.structures.filter((_, i) => i !== index),
    }));
  };

  const nucleusBlocked =
    draft.magnification !== "" && draft.magnification < 400;
  const liveStainRule = draft.stain
    ? STAIN_RULES[draft.stain as StainMethod]
    : null;
  const liveStainMismatch =
    draft.sampleType !== "" &&
    draft.stain !== "" &&
    !liveStainRule?.allowed.includes(draft.sampleType);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(draft);
    if (mode === "create") {
      setDraft(emptyDraft());
      setErrors({});
      setCustomName("");
    }
  };

  return (
    <form className="observation-form" onSubmit={handleSubmit} noValidate>
      <div className="field-grid">
        <label>
          <span>样本名称 *</span>
          <input
            value={draft.sampleName}
            placeholder="例如：洋葱表皮"
            onChange={(e) => patch("sampleName", e.target.value)}
          />
          <ErrorText message={errors.sampleName} />
        </label>

        <label>
          <span>样本类型 *</span>
          <select
            value={draft.sampleType}
            onChange={(e) =>
              patch("sampleType", e.target.value as ObservationDraft["sampleType"])
            }
          >
            <option value="">请选择样本类型</option>
            {SAMPLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <ErrorText message={errors.sampleType} />
        </label>

        <label>
          <span>染色方式 *</span>
          <select
            value={draft.stain}
            onChange={(e) =>
              patch("stain", e.target.value as ObservationDraft["stain"])
            }
          >
            <option value="">请选择染色方式</option>
            {STAIN_METHODS.map((stain) => (
              <option key={stain} value={stain}>
                {stain}
              </option>
            ))}
          </select>
          {draft.stain && (
            <p className={`field-hint ${liveStainMismatch ? "hint-bad" : "hint-ok"}`}>
              适用样本：{liveStainRule?.allowed.join("、")}
              {liveStainMismatch ? " — 与当前样本类型不匹配，无法保存" : ""}
            </p>
          )}
          <ErrorText message={errors.stain} />
        </label>

        <label>
          <span>放大倍数 *</span>
          <select
            value={draft.magnification}
            onChange={(e) =>
              patch(
                "magnification",
                e.target.value === ""
                  ? ""
                  : (Number(e.target.value) as ObservationDraft["magnification"])
              )
            }
          >
            <option value="">请选择放大倍数</option>
            {MAGNIFICATIONS.map((mag) => (
              <option key={mag} value={mag}>
                {mag}x
              </option>
            ))}
          </select>
          {nucleusBlocked && (
            <p className="field-hint hint-bad">
              当前倍率低于 400x，细胞核不可标记为已确认。
            </p>
          )}
          <ErrorText message={errors.magnification} />
        </label>
      </div>

      <fieldset className="structure-field">
        <legend>
          重点结构 * <em>点击结构可切换“已确认 / 未确认”</em>
        </legend>
        <div className="structure-suggestions">
          {STRUCTURE_SUGGESTIONS.map((name) => {
            const added = draft.structures.some((s) => s.name === name);
            return (
              <button
                type="button"
                key={name}
                className={added ? "chip chip-active" : "chip"}
                onClick={() => addStructure(name)}
                disabled={added}
              >
                + {name}
              </button>
            );
          })}
        </div>
        <div className="custom-structure">
          <input
            value={customName}
            placeholder="或输入其他重点结构名称"
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addStructure(customName);
              }
            }}
          />
          <button type="button" onClick={() => addStructure(customName)}>
            添加
          </button>
        </div>
        {draft.structures.length > 0 && (
          <ul className="structure-list">
            {draft.structures.map((structure: StructureMark, index) => (
                <li
                  key={structure.name}
                  className={structure.confirmed ? "is-confirmed" : "is-unconfirmed"}
                >
                  <button
                    type="button"
                    className="structure-toggle"
                    onClick={() => toggleConfirmed(index)}
                    title="切换确认状态"
                  >
                    {structure.confirmed ? "✓ 已确认" : "○ 未确认"}
                  </button>
                  <span className="structure-name">{structure.name}</span>
                  {structure.name === "细胞核" && nucleusBlocked && (
                    <em className="structure-flag">
                      {structure.confirmed
                        ? "低于 400x，不能确认"
                        : "低于 400x，仅可记为未确认"}
                    </em>
                  )}
                  <button
                    type="button"
                    className="structure-remove"
                    onClick={() => removeStructure(index)}
                  >
                    删除
                  </button>
                </li>
              ))}
          </ul>
        )}
        <ErrorText message={errors.structures} />
      </fieldset>

      <label className="description-field">
        <span>观察描述（可选）</span>
        <textarea
          rows={3}
          value={draft.description}
          placeholder="记录视野中的形态、分布、运动等观察结论"
          onChange={(e) => patch("description", e.target.value)}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="primary-action">
          {submitLabel}
        </button>
        {onCancel && mode === "review" && (
          <button type="button" onClick={onCancel}>
            取消复看
          </button>
        )}
      </div>
    </form>
  );
}
