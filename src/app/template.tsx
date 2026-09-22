/**
 * Re-mounts on every navigation (unlike layout.tsx), which is exactly the
 * hook for a route-enter animation: one short rise-and-fade defined in
 * globals.css. No JS, respects prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-enter flex min-h-full flex-1 flex-col">{children}</div>;
}
