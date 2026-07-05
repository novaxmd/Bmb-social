# AllSocialMediaVideoDownloader (Bmbtech)

This project is a modern Full-Stack application that lets you download video and media content from various social media platforms, with Telegram integration and real-time download tracking.

## 🚀 Tech Stack

### Backend (Server)
- **Node.js & Express**: API server infrastructure.
- **TypeScript**: Safe, type-supported coding.
- **Prisma & SQLite**: Database ORM and local database management (`dev.db`).
- **Telegraf & Telegram MTProto**: Telegram bot integration and user interaction.
- **Socket.IO**: Real-time transfer of download statuses (progress bar, etc.) to the client.
- **FFmpeg & Media Tools**: For video splitting, processing, and compression operations.

### Frontend (Client)
- **Next.js 14 (App Router)**: Modern and fast React framework.
- **React 18 & TypeScript**: UI components.
- **Framer Motion**: Smooth UI animations and transitions.
- **Socket.IO Client**: Real-time data stream (WebSocket) management with the backend.
- **Lucide React**: Modern and lightweight icon library.
- **CSS3 / Tailwind**: Modern and responsive design.

---

## 🛠️ Setup and Running

The project runs two separate services, backend and frontend. To run both services you must have **Node.js** (v18+) installed on your system. You must also have **FFmpeg** installed for video processing features.

### Initial Setup

1. Get the project files (clone your own repository or extract the provided archive):
   ```bash
   cd AllSocialMediaVideoDownloader
   ```

2. Configure `.env` Settings:
   - Create a copy of the `backend/.env.example` file and rename it to `backend/.env`. Fill in the required token, API ID, and connection settings.
   - Create a copy of the `frontend/.env.example` file and rename it to `frontend/.env.local`.

### 1️⃣ Starting the Backend

Run the following commands in a separate terminal window:
```bash
cd backend
npm install
npm run dev
```
> This starts the database connections, the Socket server (on port 3355), and the Telegram Bot.

### 2️⃣ Starting the Frontend

Run the following commands in a different terminal window:
```bash
cd frontend
npm install
npm run dev
```
> The client interface will start running at `http://localhost:3344` (or according to your server configuration settings).

---

## 🔒 Security Note
API keys, Bot tokens (`BOT_TOKEN`), and structures like `cookies.txt` used in this project are ignored via `.gitignore`. Please never share these files in public environments. To set up the project, it's enough to customize the `example` files for your own use.

---

Developed by **Bmb Social Media** — [https://download.bmntech.site](https://download.bmntech.site)
