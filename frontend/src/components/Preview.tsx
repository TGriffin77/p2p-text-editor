
interface PreviewProps {
  content: string;
}

export default function Preview({ content }: PreviewProps) {
  return (
    <div className="w-full h-full p-4">
      {content}
    </div>
  )
}