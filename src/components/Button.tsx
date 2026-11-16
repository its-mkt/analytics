import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'md' | 'sm';
  /** 라벨 앞 아이콘. 아이콘이 있으면 라벨을 <span>으로 감싼다 */
  icon?: ReactNode;
}

/** 공용 `.btn` 버튼 (기본 type="button") */
export function Button({
  variant = 'default',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' && 'pri',
    variant === 'ghost' && 'btn-ghost',
    size === 'sm' && 'btn-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={cls} {...rest}>
      {icon}
      {icon && children != null ? <span>{children}</span> : children}
    </button>
  );
}
