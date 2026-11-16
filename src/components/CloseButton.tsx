import { X } from 'lucide-react';

interface CloseButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  id?: string;
  size?: number;
  title?: string;
}

/** X 아이콘만 있는 닫기·지우기 버튼 */
export function CloseButton({
  label,
  onClick,
  className,
  id,
  size = 18,
  title,
}: CloseButtonProps) {
  return (
    <button
      type="button"
      className={className}
      id={id}
      aria-label={label}
      title={title}
      onClick={onClick}
    >
      <X size={size} aria-hidden="true" />
    </button>
  );
}
