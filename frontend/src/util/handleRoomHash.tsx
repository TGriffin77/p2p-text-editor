export default function handleRoomHash() {
  const hash = window.location.hash;
  if (hash == "") {
    const newHash = "#" + crypto.randomUUID();
    window.location.hash = newHash;
    return newHash;
  } else {
    return hash;
  }
}
