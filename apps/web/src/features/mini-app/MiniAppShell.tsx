// Placeholder — will be replaced in Task 2.6
export function MiniAppShell({
  miniApp,
}: {
  miniApp: { name: string; liffId: string | null; [key: string]: any }
  forwardPath?: string
}) {
  return <div>Loading Mini App: {miniApp.name}</div>
}
