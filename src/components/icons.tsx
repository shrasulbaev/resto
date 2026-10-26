// Inline stroke icons used across the app.
type P = { className?: string; size?: number };

function Svg({ className, size = 20, children }: P & { children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const BellIcon = (p: P) => <Svg {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
export const BackIcon = (p: P) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const ReceiptIcon = (p: P) => <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></Svg>;
export const BagIcon = (p: P) => <Svg {...p}><path d="M4 8h16l-2 12H6z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></Svg>;
export const ChatIcon = (p: P) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="M4 12.5l5 5L20 6.5" /></Svg>;
export const CheckCircleIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Svg>;
export const FlameIcon = (p: P) => <Svg {...p}><path d="M12 3c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10z" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const MinusIcon = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const GridIcon = (p: P) => <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></Svg>;
export const ListIcon = (p: P) => <Svg {...p}><path d="M5 6h14M5 12h14M5 18h9" /></Svg>;
export const EditIcon = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>;
export const TrashIcon = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const ImageIcon = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></Svg>;
