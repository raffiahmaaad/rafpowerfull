# RafTools

<div align="center">

![RafTools](https://img.shields.io/badge/RafTools-v5.0.0-00f0ff?style=for-the-badge&logo=toolbox&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**Your Ultimate All-in-One Online Toolkit**

Privacy-first • Free • No signup required

[Live Demo](https://raf-tools.vercel.app) • [Setup Guide](#-complete-setup-guide)

</div>

---

## ✨ Features

### 📧 TempMail (GhostMail)

Generate disposable email addresses that forward to your real inbox and self-destruct automatically.

- **Instant Email Generation** - Create disposable addresses in seconds
- **Custom Alias** - Choose your own prefix or generate random realistic names
- **Multiple Domains** - Public domains + custom domain support
- **Duration Control** - 10 min to permanent (for registered users)
- **Real-time Inbox** - Ultra-fast 500ms auto-refresh
- **AI Code Extraction** - Automatically extract verification codes
- **Recovery Keys** - Recover sessions across devices
- **Spam Detection** - Automatic spam filtering

### 📄 PDF Tools (15 Tools)

All processing happens locally in your browser. No uploads to servers.

| Category         | Tools                                                       |
| ---------------- | ----------------------------------------------------------- |
| **Organize**     | Merge, Split, Remove Pages, Extract Pages, Organize/Reorder |
| **Optimize**     | Compress PDF                                                |
| **Convert To**   | JPG to PDF, WORD to PDF, HTML to PDF                        |
| **Convert From** | PDF to JPG                                                  |
| **Edit**         | Rotate, Add Page Numbers, Add Watermark                     |
| **Security**     | Protect (Password), Unlock                                  |

### 🖼️ Image Tools (8 Tools)

| Category       | Tools                                                  |
| -------------- | ------------------------------------------------------ |
| **Basic**      | Compress, Resize, Crop, Convert (JPG/PNG/WebP), Rotate |
| **AI-Powered** | Remove Background, Upscale (2x/4x), Document Scanner   |

### 🎲 Generator Tools

- **Address & Identity Generator** - 44 countries supported
- **CC Generator** - Valid test credit card numbers for development

### 🔐 User Account System

- Email registration with verification
- JWT-based authentication
- Password management
- Custom domain support

---

## 🛡️ Security

| Feature          | Implementation                                  |
| ---------------- | ----------------------------------------------- |
| Password Hashing | PBKDF2-SHA256, 100k iterations                  |
| Password Policy  | 10+ chars, uppercase, lowercase, number, symbol |
| Rate Limiting    | Cloudflare WAF + application-level              |
| Security Headers | HSTS, CSP, X-Frame-Options                      |
| XSS Prevention   | DOMPurify sanitization                          |
| Bot Protection   | Cloudflare Turnstile                            |

---

## 🏗️ Tech Stack

| Layer        | Technologies                              |
| ------------ | ----------------------------------------- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS  |
| **Backend**  | Cloudflare Workers, Hono, D1 (SQLite), KV |
| **APIs**     | iLoveAPI (PDF/Image processing)           |

---

## 🚀 Complete Setup Guide

### Prerequisites

Before starting, make sure you have:

- **Node.js 18+** - [Download](https://nodejs.org)
- **Git** - [Download](https://git-scm.com)
- **Cloudflare Account** - [Sign up free](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI** - Install with `npm install -g wrangler`

---

### Step 1: Clone Repository

```bash
git clone https://github.com/raffiahmaaad/raftools.git
cd raftools
```

---

### Step 2: Setup Frontend

```bash
# Install dependencies
npm install
```

Create `.env` file in root directory:

```env
VITE_API_URL=https://your-worker.workers.dev
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

> ⚠️ You'll update these values after backend deployment

---

### Step 3: Setup Backend

```bash
cd backend
npm install
```

#### 3.1 Login to Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate.

#### 3.2 Create KV Namespace

```bash
npx wrangler kv:namespace create "GHOSTMAIL_KV"
```

**Output example:**

```
✨ Success! Created KV namespace with id: "abc123xyz..."
```

📝 **Copy the ID** - you'll need it for `wrangler.toml`

#### 3.3 Create D1 Database

```bash
npx wrangler d1 create ghostmail-db
```

**Output example:**

```
✨ Created DB 'ghostmail-db' with ID: "xyz789abc..."
```

📝 **Copy the database ID** - you'll need it for `wrangler.toml`

#### 3.4 Update wrangler.toml

Open `backend/wrangler.toml` and update these values:

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID_HERE"           # ← Paste KV ID from step 3.2
preview_id = "YOUR_KV_ID_HERE"   # ← Same ID for preview

[[d1_databases]]
binding = "DB"
database_name = "ghostmail-db"
database_id = "YOUR_D1_ID_HERE"  # ← Paste D1 ID from step 3.3
```

> **💡 Important: Customizing Names**
>
> The **names** are fully customizable! You can use any name you want:
>
> | What                 | Customizable? | Example                            |
> | -------------------- | ------------- | ---------------------------------- |
> | KV namespace name    | ✅ Yes        | `MY_APP_KV`, `EMAIL_STORAGE`, etc. |
> | D1 database name     | ✅ Yes        | `my-app-db`, `raftools-prod`, etc. |
> | `binding = "KV"`     | ❌ No         | Must be `"KV"` (code uses this)    |
> | `binding = "DB"`     | ❌ No         | Must be `"DB"` (code uses this)    |
> | `id` / `database_id` | 🔄 Your own   | Use IDs from YOUR resources        |
>
> **Example with custom names:**
>
> ```bash
> npx wrangler kv:namespace create "MY_EMAIL_KV"
> npx wrangler d1 create my-personal-db
> ```
>
> Just make sure to use **your own IDs** in wrangler.toml, not the ones from my GitHub!

#### 3.5 Run Database Migrations

```bash
# Apply all migrations to remote database
npx wrangler d1 migrations apply ghostmail-db --remote
```

This creates all required tables.

#### 3.6 Set Secrets (REQUIRED)

These secrets are REQUIRED for the app to work:

```bash
# JWT Secret - used for authentication tokens
npx wrangler secret put JWT_SECRET
# Enter a random string (32+ characters recommended)
# Example: mysupersecretjwtkey1234567890abcdefgh

# Admin Password - for admin panel access
npx wrangler secret put ADMIN_PASSWORD
# Enter your admin password

# Turnstile Secret - for bot protection
npx wrangler secret put TURNSTILE_SECRET_KEY
# Get from: https://dash.cloudflare.com → Turnstile → Create Widget
```

**Optional secrets** (for iLoveAPI image/PDF processing):

```bash
npx wrangler secret put ILOVEAPI_PUBLIC_KEY
npx wrangler secret put ILOVEAPI_SECRET_KEY
# Get from: https://www.iloveapi.com
```

#### 3.7 Deploy Backend

```bash
npx wrangler deploy
```

**Output example:**

```
✨ Deployed to https://ghostmail-worker.xxx.workers.dev
```

📝 **Copy the worker URL** - you'll need it for frontend `.env`

---

### Step 4: Configure Frontend

Go back to root directory and update `.env`:

```bash
cd ..
```

Edit `.env` file:

```env
VITE_API_URL=https://ghostmail-worker.xxx.workers.dev  # ← Your worker URL
VITE_TURNSTILE_SITE_KEY=0x4AAA...                      # ← From Turnstile dashboard
```

---

### Step 5: Test Locally

**Terminal 1 - Backend:**

```bash
cd backend
npx wrangler dev
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

Open http://localhost:5173

---

### Step 6: Deploy Frontend

#### Option A: Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

#### Option B: Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name=raftools
```

---

## 🔑 Required Secrets Checklist

| Secret                 | Required    | How to Get                                                      |
| ---------------------- | ----------- | --------------------------------------------------------------- |
| `JWT_SECRET`           | ✅ Yes      | Generate yourself (32+ random chars)                            |
| `ADMIN_PASSWORD`       | ✅ Yes      | Create yourself                                                 |
| `TURNSTILE_SECRET_KEY` | ✅ Yes      | [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com) |
| `ILOVEAPI_PUBLIC_KEY`  | ⚠️ Optional | [iLoveAPI](https://www.iloveapi.com)                            |
| `ILOVEAPI_SECRET_KEY`  | ⚠️ Optional | [iLoveAPI](https://www.iloveapi.com)                            |

---

## 📁 Project Structure

```
raftools/
├── src/                    # React source
├── components/
│   ├── auth/               # Login, Register
│   ├── dashboard/          # User dashboard
│   ├── tempmail/           # Email components
│   ├── pdftools/           # 15 PDF tools
│   ├── imagetools/         # 8 Image tools
│   ├── generatortools/     # Identity generator
│   └── cctools/            # CC generator
├── backend/
│   ├── src/index.ts        # Worker API
│   ├── migrations/         # D1 migrations
│   └── wrangler.toml       # Cloudflare config
└── public/                 # Static assets
```

---

## 📡 API Endpoints

### Email

| Method | Endpoint                | Description        |
| ------ | ----------------------- | ------------------ |
| POST   | `/api/generate`         | Create email alias |
| GET    | `/api/inbox/:alias`     | Get inbox          |
| DELETE | `/api/inbox/:alias/:id` | Delete email       |

### Authentication

| Method | Endpoint             | Description      |
| ------ | -------------------- | ---------------- |
| POST   | `/api/auth/register` | Register account |
| POST   | `/api/auth/login`    | Login            |
| GET    | `/api/auth/me`       | Get current user |

### Image (iLoveAPI)

| Method | Endpoint              | Description       |
| ------ | --------------------- | ----------------- |
| POST   | `/api/image/removebg` | Remove background |
| POST   | `/api/image/compress` | Compress          |
| POST   | `/api/image/upscale`  | AI upscale        |

---

## ❓ Troubleshooting

### "JWT_SECRET not set" error

```bash
cd backend
npx wrangler secret put JWT_SECRET
# Enter a long random string
```

### Database errors

```bash
npx wrangler d1 migrations apply ghostmail-db --remote
```

### Turnstile verification failed

- Check `TURNSTILE_SECRET_KEY` is set correctly
- Check `VITE_TURNSTILE_SITE_KEY` in frontend `.env`

---

## 📄 License

MIT License

---

## 👨‍💻 Author

**Leraie** - [GitHub](https://github.com/raffiahmaaad)

---

<div align="center">

Made with ❤️ using Cloudflare Workers

</div>
