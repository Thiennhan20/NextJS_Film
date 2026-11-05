<div align="center">

# 🎬 MovieSaw — Premium Streaming & Interactive Entertainment Platform

<img src="https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
<img src="https://img.shields.io/badge/Framer_Motion-12-FF0055?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
<img src="https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO" />
<img src="https://img.shields.io/badge/next--intl-i18n-blue?style=for-the-badge" alt="next-intl" />

<br />

**Nền tảng xem phim trực tuyến điện ảnh cao cấp kết hợp tính năng tương tác xã hội & Đấu trường trò chơi thời gian thực.**

**Trải nghiệm rạp chiếu mượt mà với HLS Player đa luồng, Poster 3D, Phòng chiếu trực tiếp, Hệ thống Bạn bè và Đấu trí trực tuyến.**

<br />

[🌐 Live Demo](https://moviesaw.vercel.app/) · [🎮 Game Arena](/game-realtime) · [📧 Liên hệ](mailto:nhanntn2203@gmail.com)

<br />

</div>

---

## ✨ Tính Năng Nổi Bật (Key Features)

<table>
<tr>
<td width="50%">

### 🎥 Trải Nghiệm Xem Phim (Streaming & Player)
- **Custom HLS Player**: Chuyển đổi chất lượng mượt mà, Picture-in-Picture (PiP), phím tắt thông minh.
- **Kiến trúc Multi-Server**: Dự phòng 3 nguồn phát độc lập, tự động fallback khi lỗi luồng.
- **Âm thanh kép & Phụ đề**: Chuyển đổi nhanh giữa Vietsub và Thuyết minh tiếng Việt.
- **Tiếp tục xem (Resume Playback)**: Lưu tiến độ xem chính xác theo tài khoản hoặc LocalStorage.
- **Tích hợp Chặn Quảng Cáo**: Hỗ trợ bộ lọc và công cụ loại bỏ quảng cáo gián đoạn.

</td>
<td width="50%">

### 🎮 Đấu Trường Đoán Số (Game Realtime Arena)
- **Tích hợp trực tiếp tại `/game-realtime`**: Nhúng game đối kháng số học Bulls & Cows 1v1.
- **Đồng bộ tài khoản liền mạch**: Giao tiếp bảo mật 2 chiều qua `postMessage` (JWT, avatar, cấp độ).
- **Chế độ Embed tối ưu**: Tự động nhận diện `embedded=1`, tương thích hoàn hảo cả trên Desktop lẫn Mobile.
- **Leo Rank & Thành Tựu**: Tích điểm Elo, nhận danh hiệu và mở khóa huân chương trực tiếp vào hồ sơ.

</td>
</tr>
<tr>
<td width="50%">

### 👥 Mạng Xã Hội & Bạn Bè (Social & Friends)
- **Hệ thống Bạn bè (`/friends`)**: Tìm kiếm người dùng, gửi/nhận lời mời kết bạn, quản lý danh sách.
- **Trạng thái trực tuyến (Online/Offline)**: Cập nhật real-time trạng thái bạn bè đang hoạt động.
- **Bình luận & Thảo luận (`/mycomments`)**: Bình luận lồng nhau (nested threads), thả tim, phản hồi.
- **Phòng chiếu chung (Watch Party)**: Phòng stream xem phim trực tiếp cùng bạn bè với khung chat WebSocket.

</td>
<td width="50%">

### 🌐 Đa Ngôn Ngữ & Cá Nhân Hóa (i18n & Settings)
- **Hỗ trợ Song ngữ Toàn diện (`next-intl`)**: Chuyển đổi mượt mà giữa Tiếng Việt và Tiếng Anh (`vi` / `en`).
- **Trung tâm Cài đặt (`/settings`)**: Quản lý ngôn ngữ, thông báo, bảo mật và thông tin phiên bản.
- **Bộ sưu tập cá nhân**: Danh sách yêu thích (`/watchlist`), Phim đã xem gần đây (`/recently-watched`), Stream đã lưu (`/saved-streams`).
- **Giao diện Điện ảnh Dark Mode**: Thiết kế kính mờ (Glassmorphism), hiệu ứng chuyển động mượt mà với Framer Motion.

</td>
</tr>
</table>

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 15 CLIENT (APP ROUTER)                  │
│                                                                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ Xem Phim & Chi │  │ Mạng Xã Hội &  │  │   Đấu Trường Đoán Số      │  │
│  │ Tiết (Movies / │  │ Bạn Bè (Chat,  │  │ (/game-realtime iframe & │  │
│  │ TVShows / HLS) │  │ Watch Party)   │  │   postMessage bridge)    │  │
│  └───────┬────────┘  └───────┬────────┘  └────────────┬─────────────┘  │
│          │                   │                        │                │
│  ┌───────┴───────────────────┴────────────────────────┴─────────────┐  │
│  │     Store (Zustand + SWR)  |  i18n (next-intl)  |  Framer Motion │  │
│  └───────────────────────────────────┬──────────────────────────────┘  │
│                                      │                                 │
│  ┌───────────────────────────────────┴──────────────────────────────┐  │
│  │                       API Proxy Routes                           │  │
│  │        /api/tmdb-proxy  •  /api/chat  •  /api/subtitles          │  │
│  └───────────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  ┌──────────┐                  ┌──────────────┐               ┌──────────────┐
  │ TMDB API │                  │ Express API  │               │ Game Server  │
  │ (Data &  │                  │ (Auth, Data, │               │ (Socket.IO,  │
  │ Posters) │                  │ Watchlist)   │               │ PvP Match)   │
  └──────────┘                  └──────────────┘               └──────────────┘
```

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Hạng mục | Công nghệ |
| :--- | :--- |
| **Framework** | Next.js 15.5 (App Router, Turbopack, SSR/SSG) |
| **Ngôn ngữ** | TypeScript 5 |
| **Giao diện** | React 19, Tailwind CSS v4, Heroicons, Lucide React, React Icons |
| **Hiệu ứng chuyển động** | Framer Motion 12 |
| **Đa ngôn ngữ (i18n)** | `next-intl` (Hỗ trợ Tiếng Việt & Tiếng Anh) |
| **Quản lý trạng thái** | Zustand, SWR |
| **Trình phát Video** | Custom HLS.js Player, React Player |
| **Thời gian thực** | Socket.IO Client |
| **Bảo mật & Xác thực** | JWT, Google OAuth (`@react-oauth/google`), Crypto-JS |
| **Cơ sở dữ liệu đám mây** | Supabase JS, Upstash Redis REST |
| **Thông báo & Phản hồi** | React Hot Toast |

---

## 📁 Cấu Trúc Thư Mục (Directory Structure)

```text
client-en-website/
├── public/                 # Tài nguyên tĩnh, favicon, assets
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # Serverless API routes (tmdb-proxy, chat, subtitles)
│   │   ├── friends/        # Trang quản lý Bạn bè & Lời mời kết bạn
│   │   ├── game-realtime/  # Trang nhúng Đấu Trường Game Đoán Số Bí Mật
│   │   ├── login/          # Đăng nhập (JWT & Google OAuth)
│   │   ├── forgot-password/# Quên mật khẩu
│   │   ├── reset-password/ # Đặt lại mật khẩu
│   │   ├── verify-email/   # Xác thực email tài khoản
│   │   ├── movies/[id]/    # Chi tiết phim lẻ & trình phát video
│   │   ├── tvshows/[id]/   # Phim bộ & danh sách tập
│   │   ├── mycomments/     # Quản lý bình luận cá nhân
│   │   ├── profile/        # Quản lý thông tin & hồ sơ người dùng
│   │   ├── recently-watched# Lịch sử phim đã xem gần đây
│   │   ├── saved-streams/  # Danh sách stream phòng chiếu đã lưu
│   │   ├── search/         # Tìm kiếm đa năng kèm bộ lọc
│   │   ├── settings/       # Cài đặt hệ thống, ngôn ngữ & phiên bản
│   │   ├── streaming-lobby/# Sảnh phòng chiếu trực tiếp
│   │   ├── streaming-room/ # Phòng xem chung kèm khung chat realtime
│   │   ├── watchlist/      # Danh sách phim yêu thích
│   │   ├── layout.tsx      # Root Layout & Theme Providers
│   │   └── page.tsx        # Trang chủ MovieSaw
│   ├── components/         # Thành phần giao diện (Watch, Common, Auth, Home, Friends...)
│   ├── hooks/              # Custom hooks (Auth, Window, Socket...)
│   ├── i18n/               # Cấu hình next-intl & tệp ngôn ngữ (`vi/`, `en/`)
│   ├── store/              # Zustand stores (User, Watchlist, Settings)
│   └── lib/                # Tiện ích, Axios client & API helpers
├── package.json
└── README.md
```

---

## 🚀 Cài Đặt và Khởi Chạy (Getting Started)

### 1. Yêu cầu hệ thống
* **Node.js**: Phiên bản 18+ (khuyên dùng Node.js 20 LTS)
* **npm** hoặc **yarn** / **pnpm**

### 2. Cài đặt Dependencies

```bash
cd client-en-website
npm install
```

### 3. Cấu hình biến môi trường (`.env.local`)

Tạo file `.env.local` ở thư mục gốc của client:

```env
# Backend API & Socket Services
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Game Realtime Service (URL tới frontend game-en-website)
NEXT_PUBLIC_GAME_URL=http://localhost:3002

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here

# TMDB Movie Database API
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_here
```

### 4. Khởi chạy môi trường phát triển

```bash
# Khởi chạy Next.js với Turbopack
npm run dev
```

Mở trình duyệt tại [http://localhost:3000](http://localhost:3000) để trải nghiệm.

### 5. Build và kiểm thử Production

```bash
# Biên dịch mã nguồn tối ưu production
npm run build

# Chạy server production
npm start
```

---

## 📊 Tối Ưu Hóa & Hiệu Năng

* ✅ **Turbopack Engine**: Tốc độ khởi động và Fast Refresh nhanh gấp 4 lần.
* ✅ **Zero Hydration Mismatch**: Kiểm soát render SSR/Client nghiêm ngặt, hỗ trợ iframe embedding mượt mà.
* ✅ **Static & Dynamic Rendering**: Tự động phân tách Static Prerender cho trang tĩnh và Dynamic Route cho luồng streaming.
* ✅ **SEO & OpenGraph Ready**: Tối ưu thẻ meta động cho từng tựa phim và phòng stream.

---

## 🔗 Liên Kết Dự Án

* [Game Realtime Server & Frontend (game-en-website)](../game-en-website/README.md)
* [Backend Server (server-en-website)](../server-en-website/)

---

<div align="center">

**Phát triển với ❤️ phục vụ trải nghiệm xem phim & giải trí đỉnh cao.**

</div>
