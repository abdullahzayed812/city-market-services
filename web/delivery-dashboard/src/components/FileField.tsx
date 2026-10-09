import { Upload, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";

// Image picker for identity / registration documents
export function FileField({ id, label, hint, file, onChange }: { id: string; label: string; hint: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <label htmlFor={id} className="flex items-center gap-3 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/50">
        {file ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
        <span className="text-sm truncate">{file ? file.name : hint}</span>
      </label>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}
