import { type ReactNode } from 'react';

interface CardProps {
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ interactive, className = '', children }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${
        interactive 
          ? 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer' 
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
