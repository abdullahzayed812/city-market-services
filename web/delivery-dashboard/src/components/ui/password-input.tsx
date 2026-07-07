import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "./input"
import { cn } from "@/lib/utils"

const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input type={visible ? "text" : "password"} className={cn("pe-10", className)} ref={ref} {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
