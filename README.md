# WorkoutLeveling — Getting Started Guide

> Complete guide for local development, phone access over LAN, and Android build (APK).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Running in Development (Local PC)](#3-running-in-development-local-pc)
4. [Access from Phone (LAN)](#4-access-from-phone-lan)
5. [Android Build (APK with Capacitor)](#5-android-build-apk-with-capacitor)
6. [How the Database Works (SQLite + Migrations)](#6-how-the-database-works-sqlite--migrations)
7. [Configuration and Variables](#7-configuration-and-variables)
8. [Quick Commands](#8-quick-commands)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Install the following tools before getting started:

| Tool        | Minimum Version        | Download                                                                                        |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| **PHP**     | 8.1+                   | https://www.php.net/downloads (on Windows, use the Thread Safe version and add it to your PATH) |
| **Node.js** | 18+ (20.x recommended) | https://nodejs.org                                                                              |
| **npm**     | 9+                     | Included with Node.js                                                                           |
| **Git**     | Any version            | https://git-scm.com                                                                             |

> **Android (APK only):** Also install Android Studio and JDK 17. These are **not required** for web development.

Verify that everything is available in your PATH:

```bash
php --version      # PHP 8.x.x
node --version     # v20.x.x
npm --version      # 10.x.x
```

---

## 2. Project Structure

```
WorkoutLeveling/
├── backend/
│   ├── api/                  ← PHP handlers for each REST resource
│   │   ├── auth/handler.php
│   │   ├── profile/handler.php
│   │   ├── workouts/handler.php
│   │   ├── sessions/handler.php
│   │   ├── exercises/handler.php
│   │   ├── stats/handler.php
│   │   └── body-stats/handler.php
│   ├── core/                 ← Core classes (Database, Auth, Response, Validator)
│   ├── config/config.php     ← DB_PATH, APP_ENV, SESSION_NAME
│   ├── migrations/           ← Idempotent SQL migrations (001–004)
│   ├── data/
│   │   ├── workout.db        ← SQLite database (created automatically)
│   │   └── uploads/          ← Uploaded files (exercise media, images)
│   ├── router.php            ← PHP built-in server router (serves both frontend and API)
│   └── index.php             ← API entry point + migration bootstrap
│
└── frontend/
    ├── src/                  ← TypeScript source files
    │   ├── main.ts           ← Entry point + SPA router + sidebar
    │   ├── pages/            ← One page module per route
    │   ├── api/              ← Fetch wrapper (client.ts + resources)
    │   ├── components/       ← Toast, Modal, Confirm, AuthTabs
    │   └── types/index.ts    ← Shared TypeScript types
    ├── public/
    │   ├── index.html        ← SPA shell
    │   ├── dist/bundle.js    ← esbuild output (generated during build)
    │   ├── css/              ← Stylesheets (layout, components, pages, charts)
    │   ├── icons/            ← PWA icons (192px, 512px, etc.)
    │   └── sw.js             ← PWA Service Worker
    ├── package.json
    ├── tsconfig.json
    └── capacitor.config.ts   ← Capacitor configuration for Android
```

---

## 3. Running in Development (Local PC)

### Step 1 — Install npm dependencies (first time only)

```bash
cd WorkoutLeveling/frontend
npm install
```

### Step 2 — Start the PHP server

The PHP server serves **both the static frontend** (`frontend/public/`) and the **API** (`/api/*`) through `router.php`.

A single process, a single port.

```bash
# From the project root
php -S 0.0.0.0:3000 backend/router.php
```

> Keep this running in its own terminal.
>
> `0.0.0.0` means "listen on all network interfaces", allowing access from devices on the same network.

### Step 3 — Compile TypeScript (watch mode)

```bash
# In a second terminal
cd frontend
npm run watch
```

This starts esbuild in **watch mode**.

Every time you save a `.ts` file, the bundle is automatically regenerated at:

```
public/dist/bundle.js
```

### Step 4 — Open your browser

```
http://localhost:3000
```

The SQLite database (`backend/data/workout.db`) is automatically created on the **first launch**, including all tables and seed data.

No manual setup is required.

---

## 4. Access from Phone (LAN)

Make sure your PC and phone are connected to the **same Wi-Fi network**.

### Find your PC's IP address

**Windows**

```cmd
ipconfig
```

Look for the **IPv4 Address** under your Wi-Fi adapter, for example:

```
192.168.1.243
```

**macOS / Linux**

```bash
ifconfig | grep "inet " | grep -v 127
```

### Build using your LAN IP

Instead of `npm run watch`, run esbuild manually and point `API_BASE` to your local IP:

```bash
cd frontend
npx esbuild src/main.ts \
  --bundle \
  --outfile=public/dist/bundle.js \
  --format=iife \
  --target=es2020 \
  --sourcemap \
  --watch \
  --define:__API_BASE__='"http://192.168.1.243:3000/api"'
```

> Replace `192.168.1.243` with your actual local IP address.

The PHP server is already running on `0.0.0.0:3000`, so it's reachable from other devices.

On your phone, open:

```
http://192.168.1.243:3000
```

> **Note:** If Windows Firewall blocks port **3000**, create an inbound rule:
>
> **Control Panel → Windows Defender Firewall → Inbound Rules → New Rule → TCP Port 3000 → Allow**

---

## 5. Android Build (APK with Capacitor)

### Additional prerequisites

* Android Studio installed: https://developer.android.com/studio
* JDK 17 (included with Android Studio)
* Android SDK installed through Android Studio (API Level 34 recommended)

### Step 1 — Configure the server URL

Before building the Android app, point `__API_BASE__` to your backend server.

Edit the `build:mobile` script inside `frontend/package.json` and replace `YOUR_SERVER`:

```json
"build:mobile": "esbuild src/main.ts --bundle --outfile=public/dist/bundle.js --format=iife --target=es2020 --define:__API_BASE__='\"https://yourdomain.com/api\"'"
```

For local LAN testing you can instead use:

```json
"build:mobile": "... --define:__API_BASE__='\"http://192.168.1.243:3000/api\"'"
```

### Step 2 — Build and sync Capacitor

```bash
cd frontend
npm run build:android
```

This performs:

1. `npm run build` — Compiles TypeScript
2. `npx cap sync android` — Copies files into the Android project

### Step 3 — Open Android Studio

```bash
npm run open:android
```

Inside Android Studio:

* **Build → Build Bundle(s) / APK(s) → Build APK(s)**

The generated APK will be located at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer it to your phone and install it.

You may need to enable **Install from Unknown Sources** in Android settings.

---

## 6. How the Database Works (SQLite + Migrations)

The database is stored as a SQLite file:

```
backend/data/workout.db
```

**No manual setup is required.**

On the first server startup, `index.php` automatically checks which migrations have already been applied and executes any missing ones.

| Migration                | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `001_initial_schema.sql` | Base schema: exercises, workouts, sessions, users                        |
| `002_seed_data.sql`      | Initial data: muscles, movement types, exercises                         |
| `003_auth_tokens.sql`    | Bearer authentication token table                                        |
| `004_accounts.sql`       | Multi-user support: email, roles, profiles, user_id on workouts/sessions |

### Manual backup

Before risky updates, create a backup:

```bash
# Windows
copy backend\data\workout.db backend\data\workout.db.bak

# macOS/Linux
cp backend/data/workout.db backend/data/workout.db.bak
```

### Complete database reset

```bash
# Delete the database file — it will be recreated automatically
rm backend/data/workout.db       # macOS/Linux
del backend\data\workout.db      # Windows
```

---

## 7. Configuration and Variables

### `backend/config/config.php`

```php
define('DB_PATH', __DIR__ . '/../data/workout.db');   // Database path
define('APP_ENV', getenv('APP_ENV') ?: 'development'); // 'development' or 'production'
define('SESSION_NAME', 'wl_session');
```

When `APP_ENV = 'production'`, cookies become `Secure + SameSite=None`, and detailed error messages are hidden.

### `backend/index.php` — CORS

```php
define('ALLOWED_ORIGINS', [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://192.168.1.243:3000',   // ← Replace with your LAN IP
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
]);
```

### `frontend/src/config.ts`

```typescript
export const API_BASE = typeof __API_BASE__ !== 'undefined'
  ? __API_BASE__
  : '/api';
```

The value of `__API_BASE__` is injected by esbuild during the build process using the `--define` flag.

Do **not** edit this file directly.

Instead, modify the npm build script.

---

## 8. Quick Commands

```bash
# ── Development ───────────────────────────────────────────────

# 1. Start the server (Terminal 1) — from project root
php -S 0.0.0.0:3000 backend/router.php

# 2. Start TypeScript watch (Terminal 2)
cd frontend && npm run watch

# ── Build ─────────────────────────────────────────────────────

# Production web build
cd frontend && npm run build

# Watch build
cd frontend && npm run watch

# ── Android ───────────────────────────────────────────────────

# Build + Capacitor sync
cd frontend && npm run build:android

# Open Android Studio
cd frontend && npm run open:android

# Manual Capacitor sync (after modifying public/)
cd frontend && npm run cap:sync

# ── Database ──────────────────────────────────────────────────

# Backup
copy backend\data\workout.db backend\data\workout.db.bak

# Reset (database will be recreated automatically)
del backend\data\workout.db

# Inspect using SQLite CLI
sqlite3 backend/data/workout.db
  .tables
  .schema users
  SELECT * FROM users;
  .quit
```

---

## 9. Troubleshooting

### ❌ Blank page or "Cannot connect"

* Verify that the PHP server is running:

```bash
php -S 0.0.0.0:3000 backend/router.php
```

* Verify that the bundle exists:

```bash
ls frontend/public/dist/bundle.js
```

* If missing:

```bash
cd frontend && npm run build
```

---

### ❌ HTTP 500 / "Internal Server Error"

* Check the PHP terminal output.
* In `APP_ENV=development`, the full error message is displayed.

Common cause:

* **Missing database column** → The database is outdated.

Reset it or let the migration bootstrap apply missing migrations automatically.

---

### ❌ Login doesn't work / token isn't saved

Open:

**DevTools → Application → Local Storage**

Verify that `auth_token` exists after logging in.

If not:

Open **DevTools → Network** and inspect the response from:

```
/api/auth/login
```

---

### ❌ Doesn't load on phone

1. Verify your IP using `ipconfig` (Windows).
2. Ensure the server is listening on `0.0.0.0`, not `localhost`.
3. Allow TCP port **3000** through Windows Firewall.
4. Rebuild using the correct LAN IP in `--define:__API_BASE__`.

---

### ❌ Migration error on first startup

The database may be corrupted or only partially initialized.

Delete it:

```bash
del backend\data\workout.db
```

On the next server startup, it will be recreated from scratch.

---

### ❌ TypeScript doesn't compile (esbuild)

esbuild does **not** perform type checking.

To view TypeScript errors:

```bash
cd frontend
npx tsc --noEmit
```

---

### ❌ Capacitor / Android Studio not found

Verify that `JAVA_HOME` and the Android SDK are available in your PATH.

In Android Studio:

**File → Project Structure → SDK Location**

Check that the displayed SDK path matches your environment variables.
