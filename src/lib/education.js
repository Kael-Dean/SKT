// src/lib/education.js
// Thai education levels for a person's own qualification (ed_level is free text on the backend;
// these are the values we store). Ordered low → high.
export const ED_LEVEL_OPTIONS = [
  { value: "ประถมศึกษา", label: "ประถมศึกษา (ป.6)" },
  { value: "มัธยมศึกษาตอนต้น", label: "มัธยมศึกษาตอนต้น (ม.3)" },
  { value: "มัธยมศึกษาตอนปลาย", label: "มัธยมศึกษาตอนปลาย (ม.6)" },
  { value: "ปวช.", label: "ปวช. (ประกาศนียบัตรวิชาชีพ)" },
  { value: "ปวท.", label: "ปวท. (ประกาศนียบัตรวิชาชีพเทคนิค)" },
  { value: "ปวส.", label: "ปวส. (ประกาศนียบัตรวิชาชีพชั้นสูง)" },
  { value: "อนุปริญญา", label: "อนุปริญญา" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "ประกาศนียบัตรบัณฑิต", label: "ประกาศนียบัตรบัณฑิต (ป.บัณฑิต)" },
  { value: "ปริญญาโท", label: "ปริญญาโท" },
  { value: "ประกาศนียบัตรบัณฑิตชั้นสูง", label: "ประกาศนียบัตรบัณฑิตชั้นสูง" },
  { value: "ปริญญาเอก", label: "ปริญญาเอก" },
]
