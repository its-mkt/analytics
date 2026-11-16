interface RankBadgeProps {
  /** 1부터 시작하는 순위 */
  rank: number;
}

/** 표 순위 번호 (1~3위 강조) */
export function RankBadge({ rank }: RankBadgeProps) {
  return (
    <span className={`rank-badge ${rank <= 3 ? `top-${rank}` : ''}`}>
      {rank}
    </span>
  );
}
