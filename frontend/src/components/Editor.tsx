

export default function Editor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <textarea className="w-full h-full p-4" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}