// src/components/hr/StatusMsg.jsx
// Inline result line under a form / inside a dialog (replaces the old
// emoji-prefixed success / error / warning strings in HR pages).
//
//   const [msg, setMsg] = useState(null)
//   setMsg({ tone: "success", text: "บันทึกสำเร็จ" })   // success | warning | error
//   {msg && <StatusMsg msg={msg} center />}
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import { cx } from "../../lib/styles"

const TONES = {
  success: { Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", role: "status" },
  warning: { Icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400", role: "alert" },
  error: { Icon: AlertCircle, cls: "text-red-600 dark:text-red-400", role: "alert" },
}

export default function StatusMsg({ msg, center = false, className = "" }) {
  if (!msg || !msg.text) return null
  const t = TONES[msg.tone] ?? TONES.error
  const Icon = t.Icon
  return (
    <p
      role={t.role}
      className={cx("flex items-start gap-1.5 text-sm font-medium", center && "justify-center text-center", t.cls, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{msg.text}</span>
    </p>
  )
}
