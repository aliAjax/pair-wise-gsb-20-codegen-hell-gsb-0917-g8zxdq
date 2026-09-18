export type SampleType =
  | "植物组织"
  | "动物组织"
  | "血液涂片"
  | "微生物";

export type StainMethod =
  | "碘液"
  | "亚甲基蓝"
  | "革兰氏染色"
  | "瑞氏染色"
  | "结晶紫"
  | "健那绿"
  | "活体观察";

export type Magnification = 100 | 200 | 400 | 1000;

export const SAMPLE_TYPES: SampleType[] = [
  "植物组织",
  "动物组织",
  "血液涂片",
  "微生物",
];

export const STAIN_METHODS: StainMethod[] = [
  "碘液",
  "亚甲基蓝",
  "革兰氏染色",
  "瑞氏染色",
  "结晶紫",
  "健那绿",
  "活体观察",
];

export const MAGNIFICATIONS: Magnification[] = [100, 200, 400, 1000];

/** 染色方式与样本类型的匹配规则 */
export const STAIN_RULES: Record<
  StainMethod,
  { allowed: SampleType[]; usage: string }
> = {
  碘液: {
    allowed: ["植物组织"],
    usage: "碘液用于染色植物细胞（如洋葱表皮），不适用于其他样本类型。",
  },
  亚甲基蓝: {
    allowed: ["动物组织", "微生物"],
    usage: "亚甲基蓝用于动物细胞或微生物染色，不用于植物组织与血液涂片。",
  },
  革兰氏染色: {
    allowed: ["微生物"],
    usage: "革兰氏染色仅用于细菌等微生物涂片。",
  },
  瑞氏染色: {
    allowed: ["血液涂片"],
    usage: "瑞氏染色仅用于血液涂片，不能用于其他样本类型。",
  },
  结晶紫: {
    allowed: ["植物组织", "动物组织", "微生物"],
    usage: "结晶紫用于组织或微生物的通用染色，不用于血液涂片。",
  },
  健那绿: {
    allowed: ["动物组织", "植物组织"],
    usage: "健那绿用于线粒体活体染色，适用于动植物组织，不用于血液涂片与微生物涂片。",
  },
  活体观察: {
    allowed: ["植物组织", "动物组织", "血液涂片", "微生物"],
    usage: "活体观察不施加染色，适用于全部样本类型。",
  },
};

export interface StructureMark {
  name: string;
  confirmed: boolean;
}

/** 一次观察结论的可存档内容（所有字段均已通过校验） */
export interface ObservationContent {
  sampleName: string;
  sampleType: SampleType;
  stain: StainMethod;
  magnification: Magnification;
  structures: StructureMark[];
  description: string;
}

export interface ObservationDraft {
  sampleName: string;
  sampleType: SampleType | "";
  stain: StainMethod | "";
  magnification: Magnification | "";
  structures: StructureMark[];
  description: string;
}

export interface ObservationVersion extends ObservationContent {
  /** 该版结论的保存时间 */
  savedAt: string;
}

export interface ObservationRecord {
  id: string;
  versions: ObservationVersion[];
  needsReview: boolean;
}

export type DraftErrors = Partial<Record<keyof ObservationDraft, string>>;

export const STORAGE_KEY = "hxwl-06:observations:v1";

/** 首次打开时内置的三个示例 */
export function createSeedRecords(): ObservationRecord[] {
  const base = Date.parse("2026-09-01T09:00:00+08:00");
  const at = (offsetMin: number) => new Date(base + offsetMin * 60000).toISOString();

  return [
    {
      id: "seed-onion-epidermis",
      needsReview: false,
      versions: [
        {
          sampleName: "洋葱表皮",
          sampleType: "植物组织",
          stain: "碘液",
          magnification: 400,
          structures: [
            { name: "细胞壁", confirmed: true },
            { name: "细胞核", confirmed: true },
            { name: "细胞质", confirmed: true },
          ],
          description: "细胞排列整齐呈长方形，细胞壁清晰；碘液染色后细胞核可见。",
          savedAt: at(0),
        },
      ],
    },
    {
      id: "seed-human-blood-smear",
      needsReview: false,
      versions: [
        {
          sampleName: "人血涂片",
          sampleType: "血液涂片",
          stain: "瑞氏染色",
          magnification: 1000,
          structures: [
            { name: "红细胞", confirmed: true },
            { name: "白细胞", confirmed: true },
            { name: "血小板", confirmed: false },
          ],
          description: "红细胞分布均匀、中央淡染；可见分叶核白细胞，血小板难以分辨。",
          savedAt: at(15),
        },
      ],
    },
    {
      id: "seed-paramecium",
      needsReview: false,
      versions: [
        {
          sampleName: "草履虫",
          sampleType: "微生物",
          stain: "活体观察",
          magnification: 200,
          structures: [
            { name: "纤毛", confirmed: true },
            { name: "口沟", confirmed: false },
          ],
          description: "活体样本运动迅速，体表纤毛摆动明显；200x 下内部结构未能确认。",
          savedAt: at(30),
        },
      ],
    },
  ];
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDraft(): ObservationDraft {
  return {
    sampleName: "",
    sampleType: "",
    stain: "",
    magnification: "",
    structures: [],
    description: "",
  };
}

export function contentToDraft(content: ObservationContent): ObservationDraft {
  return {
    sampleName: content.sampleName,
    sampleType: content.sampleType,
    stain: content.stain,
    magnification: content.magnification,
    structures: content.structures.map((s) => ({ ...s })),
    description: content.description,
  };
}

/** 常见重点结构建议 */
export const STRUCTURE_SUGGESTIONS = [
  "细胞壁",
  "细胞膜",
  "细胞核",
  "细胞质",
  "叶绿体",
  "液泡",
  "线粒体",
  "纤毛",
  "口沟",
  "食物泡",
  "红细胞",
  "白细胞",
  "血小板",
];

/**
 * 校验观察草稿。
 * 规则：
 * 1. 样本名称、样本类型、染色方式、放大倍数、重点结构均为必填；
 * 2. 放大倍数低于 400x 时，细胞核不能标记为“已确认”；
 * 3. 染色方式必须与样本类型匹配，否则阻止保存并说明原因。
 */
export function validateDraft(draft: ObservationDraft): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.sampleName.trim()) {
    errors.sampleName = "请填写样本名称。";
  }
  if (!draft.sampleType) {
    errors.sampleType = "请选择样本类型。";
  }
  if (!draft.stain) {
    errors.stain = "请选择染色方式。";
  }
  if (!draft.magnification) {
    errors.magnification = "请选择放大倍数。";
  }
  if (draft.structures.length === 0) {
    errors.structures = "请至少添加一个重点结构。";
  } else if (draft.structures.some((s) => !s.name.trim())) {
    errors.structures = "重点结构名称不能为空。";
  }

  if (draft.sampleType && draft.stain) {
    const rule = STAIN_RULES[draft.stain];
    if (!rule.allowed.includes(draft.sampleType)) {
      errors.stain = `样本类型与染色方式不匹配：${rule.usage}`;
    }
  }

  if (draft.magnification && draft.magnification < 400) {
    const nucleus = draft.structures.find(
      (s) => s.name.trim() === "细胞核" && s.confirmed
    );
    if (nucleus) {
      errors.structures = `放大倍数 ${draft.magnification}x 低于 400x，细胞核不能标记为已确认，请取消确认或提高到 400x 及以上。`;
    }
  }

  return errors;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
