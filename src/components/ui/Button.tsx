import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * shadcn 설정이 관리하는 최소 프리미티브. 토글처럼 이미 의미가 완전한 native button을 감싸며
 * variant API는 실제 두 번째 사용처가 생길 때만 추가해 번들을 키우지 않는다.
 */
export function Button({ className, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} className={className} />;
}
