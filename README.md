# LASUEDPLUG (`lasuedplug.com`)

**The Official Community & Campus Marketplace for LASUED, LASU, and Epe.**

---

## 1. Project Overview

**LASUEDPLUG** is a mobile-first, Progressive Web App (PWA) campus marketplace built to help students, local vendors, and landlords across the **Lagos State University of Education (LASUED)**, **LASU**, and the wider **Epe** community buy, sell, book services, and find safe off-campus housing in one trusted place.

### Core Capabilities
- **Marketplace & Campus Stores:** Buy and sell textbooks, electronics, fashion, food, and dorm essentials, or open a dedicated Campus Storefront with business opening hours.
- **Campus Services:** Discover and book student-run services such as tutoring, graphic design, laundry, catering, hairstyling, and device repairs.
- **Accommodation & Roommates:** Browse off-campus lodges, hostels, and self-contained rooms with protected exact-address privacy and a dedicated Roommate Matching board.
- **Student & Business Accounts:** Supports both Student accounts (Campus, Department, Level) and Business / Landlord accounts (Physical Shop or Online-Only).
- **Trust Score, Reviews & Verification:** Verified Student / Seller badges, star ratings, community reviews, and a moderation reporting system.
- **Fast Local Caching & Offline Resilience:** Dual-layer local cache (instant Stale-While-Revalidate + Firestore IndexedDB persistence) and PWA installability for smooth performance on campus mobile networks.

> **Independent Platform Disclaimer:** LASUEDPLUG is an independent, community-built platform created for students and residents around LASUED, LASU, and Epe. It is not officially affiliated with, endorsed by, or operated by the administration of Lagos State University of Education (LASUED) or Lagos State University (LASU).

---

## 2. Developer Credits

**Designed and built by Oyeyemi Solomon.**

- **Founder & Lead Developer:** Oyeyemi Solomon — Geography Education student at Lagos State University of Education (LASUED) and founder of **SOLVATECH**.
- **Organization:** SOLVATECH
- **Direct Contact / Developer & Platform Support:** `09049979183` ([Chat on WhatsApp](https://wa.me/2349049979183))

LASUEDPLUG was built under SOLVATECH as a practical campus solution to solve everyday student commerce, service discovery, and off-campus housing challenges across Epe and its surrounding university communities.

---

## 3. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 18, TypeScript, Vite |
| **Styling & UI** | Tailwind CSS, `lucide-react` icons |
| **Routing** | React Router v6 (`react-router-dom`) |
| **Authentication** | Firebase Authentication (Email/Password) |
| **Database & Caching** | Cloud Firestore (v10 Modular SDK with IndexedDB `persistentLocalCache` + client SWR cache) |
| **Media & Compression** | Client-side image compression (`browser-image-compression`, Base64 under 100KB) & optional Firebase Storage / Cloudinary support |
| **Background Search & Matching** | Groq AI (`groq-sdk`) for silent natural-language search expansion & category matching |
| **Hosting & CI/CD** | Vercel (auto-deployed from GitHub) |

---

## 4. How to Run Locally

This project is a purely client-side SPA (no custom Node/Express `server.ts` backend required).

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Create your local environment file:**
   Copy `.env.example` to `.env.local` in the project root and populate the values (see Section 5):
   ```bash
   cp .env.example .env.local
   ```

3. **Start the development server (runs on port `3000`):**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Verify tests, type-checking, and production build:**
   ```bash
   npx tsx --test src/lib/*.test.ts
   npm run lint
   npm run build
   ```

---

## 5. Environment Variables

All client environment variables must be defined in `.env.local` (for local development) and in **Vercel Project Settings -> Environment Variables** (for production). `.env.local` is already listed in `.gitignore` and must never be committed to Git.

```env
# Firebase Web App Configuration (Required)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Groq AI Key (Required for silent smart search & category suggestion)
VITE_GROQ_API_KEY=your_groq_api_key

# Cloudinary (Optional — if external CDN uploads are enabled later)
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

---

## 6. Admin Guide (How to Manage the Platform)

All moderation and platform controls live under `/admin` and are strictly protected by both `AdminRoute` and `firestore.rules`.

### A. Logging In as Admin
1. Go to `/login` and sign in with the authorized primary admin account: **`awoyinfasolomon1@gmail.com`** (ensure email verification is complete on the Firebase Auth account).
2. Navigate to **`/admin`** (or open the **Admin** option from the navigation menu) to view live platform metrics: Total Users, Total Listings, Pending Approvals, and Open Reports.

### B. Approving or Rejecting Listings (`/admin/listings`)
- Every new Item, Service, Accommodation, Roommate request, and Campus Store enters Firestore with `isApproved: false` so unvetted content never appears publicly.
- **Auto-Hide on Edit:** If a seller edits an already-approved listing, `isApproved` automatically resets to `false` and the listing returns to the Pending queue until re-approved.
- From `/admin/listings`, filter by module (`Item`, `Service`, `Room`, `Roommate`, `Store`), inspect details, and click **Approve** (publishes live and notifies the owner) or **Reject** (deletes the submission and notifies the owner).

### C. Suspending Users or Banning Scammers (`/admin/users`)
- Search users by name, email, campus, or UID at `/admin/users`.
- Click **Suspend** to immediately block a user from creating/editing listings or signing in. Suspended users are automatically signed out and shown a support message.
- Scammer bans triggered from Reports set `status: 'suspended'` and `isBanned: true`, blocking future sign-ups with that email.

### D. Handling Reports (`/admin/reports`)
- User-submitted reports against listings, stores, accommodations, or accounts appear in `/admin/reports`.
- Review the reporter's reason and open the target preview, then choose:
  - **Dismiss Report:** Marks the report resolved with no penalty.
  - **Delete Listing & Resolve:** Permanently removes the offending listing and closes the report.
  - **Suspend User** or **Ban Scammer:** Disables the offending user's account and resolves the report.

### E. Verifying Students (`/admin/verifications`)
- Users submit their Student ID card or school fee receipt from `/dashboard/profile`.
- Open `/admin/verifications` to inspect the submitted document image at full size:
  - Click **Approve** to grant `isVerified: true` on the user's profile, automatically propagate the Verified Badge onto their active listings, and send a confirmation notification.
  - Click **Reject** if the document is blurry or invalid so the student can re-apply with a clearer photo.

### F. Platform Maintenance Mode (`/admin/settings`)
- Toggle **Maintenance Mode** on when performing major updates. Public visitors see a friendly maintenance screen while the admin account retains full access to manage the site.

---

## 7. Deployment Guide

### A. Vercel Hosting & GitHub Auto-Deploy
1. Connect the GitHub repository (`SOLVATECHOFFICIAL/Lasuedplug.com`) to **Vercel**.
2. Framework preset: **Vite** (`npm run build`, output directory `dist`). `vercel.json` is configured for client-side React Router SPA fallback rewrites.
3. Add all `VITE_*` variables from `.env.example` into Vercel **Project Settings -> Environment Variables**.
4. **Automatic Builds:** Every push or merge to the `main` branch on GitHub automatically triggers a new Vercel production build and deployment.

### B. Deploying Firestore Rules & Indexes
Whenever `firestore.rules` or `firestore.indexes.json` is updated:
- **Via Firebase Console:** Copy the contents of `firestore.rules` into **Firebase Console -> Firestore Database -> Rules** and click **Publish**.
- **Via Firebase CLI:**
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```

---

## 8. SEO & Google Indexing

- **Metadata (`index.html`):** Configured with descriptive `<title>`, `<meta name="description">`, `<meta name="keywords">`, Open Graph tags (`og:title`, `og:description`, `og:image`), Twitter cards, and JSON-LD `WebApplication` schema for rich WhatsApp previews and search engine snippets.
- **Dynamic Social SEO (`react-helmet-async`):** Product, Service, Accommodation, Campus Store, and Seller detail pages dynamically update `<title>`, `og:title`, `og:description`, `og:url`, and use the public official logo (`https://raw.githubusercontent.com/SOLVATECHOFFICIAL/Lasuedplug.com/main/lasued.png`) for `og:image` alongside `vercel.json` SPA rewrites for direct deep linking.
- **Crawler Files (`public/`):**
  - `public/robots.txt` allows indexing and points crawlers to the sitemap.
  - `public/sitemap.xml` lists all primary public routes (`/`, `/marketplace`, `/services`, `/accommodation`, `/roommates`, `/about`, `/safety`, `/terms`, `/privacy`).
- **Submitting to Google Search Console:**
  1. Open [Google Search Console](https://search.google.com/search-console) and add `https://lasuedplug.com` (URL prefix or Domain property).
  2. Verify ownership via DNS TXT record (recommended with Vercel/domain registrar) or HTML tag.
  3. Open **Sitemaps** in the left sidebar, enter `sitemap.xml`, and click **Submit**.
  4. Use **URL Inspection** on `https://lasuedplug.com/` and click **Request Indexing** after major updates.

---

## 9. Future Roadmap (V2.0)

Planned enhancements for future releases of LASUEDPLUG:
1. **Native Android & iOS Apps (Capacitor):** Wrap the Vite web build with Capacitor to publish LASUEDPLUG on the Google Play Store and Apple App Store with native camera and share integrations.
2. **Real-Time Push Notifications (FCM + Cloud Functions):** Send instant mobile push alerts via Firebase Cloud Messaging when a buyer clicks a listing, a review is posted, or an admin approves a submission.
3. **In-App Real-Time Chat:** Add an authenticated direct messaging inbox between buyers, sellers, and roommates alongside WhatsApp handoff.
4. **Integrated Payment Gateway & Escrow:** Support secure Naira escrow payments (Paystack / Flutterwave) for verified item purchases and accommodation booking deposits.
