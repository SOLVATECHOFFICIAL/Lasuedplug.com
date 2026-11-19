# LASUEDPLUG (`lasuedplug.com`)

A mobile-first community marketplace for LASUED students, LASU students, and the Epe community — covering campus products, student services, and accommodation / roommate matching.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS v3
- **Routing:** React Router v6 (`react-router-dom`)
- **Icons:** `lucide-react`
- **Backend / Auth / Database:** Firebase v10+ modular SDK (`auth`, `firestore`) — Cloudinary will handle media uploads in a later milestone.

## Local Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Firebase environment variables**

   Ensure `.env.local` exists in the project root (copied from `.env.example`) and fill in the web app credentials from your `lasuedplug` Firebase project:

   ```env
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```

   If any of these variables are empty, the app boots safely and displays a yellow configuration banner above the navbar.

3. **Run the development server**

   ```bash
   npm run dev
   ```

   App runs at `http://localhost:3000`.

4. **Build for production**

   ```bash
   npm run build
   ```
