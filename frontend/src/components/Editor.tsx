interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function Editor({ value, onChange }: EditorProps) {
  return (
    <textarea
      className="w-full h-full p-4"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
