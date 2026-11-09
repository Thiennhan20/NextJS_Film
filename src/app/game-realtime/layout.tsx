import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đấu Trường Đoán Số 1v1 (Bulls & Cows) — Realtime Arena | ENTN',
  description:
    'Thách đấu bạn bè hoặc đọ trí AI Minimax trong Đấu Trường Đoán Số thời gian thực. Ghép trận siêu tốc, đoán 4 số bí mật, leo rank Elo Esports đỉnh cao!',
  openGraph: {
    title: '⚔️ Đấu Trường Đoán Số 1v1 Realtime — Thách Đấu Bạn Bè Ngay!',
    description:
      'Bulls & Cows thời gian thực trên ENTN. Đoán trúng 4 số bí mật trước đối thủ, so tài trí tuệ và leo rank Elo!',
    url: 'https://moviesaw.vercel.app/game-realtime',
    siteName: 'ENTN',
    images: [
      {
        url: '/game-og.jpg',
        width: 1200,
        height: 675,
        alt: 'Đấu Trường Đoán Số 1v1 Bulls and Cows Realtime Arena - ENTN',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '⚔️ Đấu Trường Đoán Số 1v1 Realtime — Thách Đấu Bạn Bè Ngay!',
    description:
      'Bulls & Cows thời gian thực trên ENTN. Đoán trúng 4 số bí mật trước đối thủ, so tài trí tuệ và leo rank Elo!',
    images: ['/game-og.jpg'],
  },
};

export default function GameRealtimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

