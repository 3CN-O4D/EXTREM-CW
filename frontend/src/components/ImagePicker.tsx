import { Camera, Image as ImageIcon } from 'lucide-react';

export interface ImagePickerProps {
  /** Label above the pickers. */
  label: string;
  /** Optional helper text. */
  hint?: string;
  /** Current image preview (full or thumb). */
  preview?: string | null;
  /** Shows a compressing message while the file is processed. */
  busy?: boolean;
  busyText?: string;
  /** Called with the chosen file from either the camera or the file picker. */
  onFile: (file: File) => void;
}

/**
 * Two-path image upload: one input opens the camera (`capture`), the other
 * opens the gallery / file browser. Shared by carpet receive, status and
 * edit forms so the behaviour is identical everywhere.
 */
export default function ImagePicker({
  label,
  hint = 'Take a photo now or choose one from your gallery / files.',
  preview,
  busy,
  busyText = 'Compressing image…',
  onFile,
}: ImagePickerProps) {
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {hint && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-700">
          <Camera size={15} /> Take photo
          <input type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <ImageIcon size={15} /> Choose file
          <input type="file" accept="image/*" onChange={pick} className="hidden" />
        </label>
      </div>
      {busy && <span className="mt-2 block text-xs text-brand-600 dark:text-brand-300">{busyText}</span>}
      {preview && <img src={preview} alt="" className="mt-2 h-24 w-24 rounded-xl object-cover ring-1 ring-violet-300" />}
    </div>
  );
}
