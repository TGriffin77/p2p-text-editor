export default function handleRoomHash(): string | null {
  const hash = window.location.hash;
  return hash || null;
}
