LiftNote

LiftNote is a high-performance, native mobile workout tracker built for athletes who want to design, log, and share their training evolution. Moving beyond simple local logging, LiftNote features a global Split Marketplace where users can discover trending routines, like their friends' progress, and synchronize their data across devices in real-time.

Features
Cloud-Native Architecture: Real-time data synchronization across devices via Supabase.

The Split Marketplace: A community hub to browse, like, and "Import" training routines designed by other users.

One-Handed UI/UX: Designed for the gym floor. All primary logging actions are situated in the "Thumb Zone" for easy access during intense sessions.

Optimistic Interactions: Immediate visual feedback for "Likes" and "Set Logs" using optimistic UI updates and Expo-Haptics.

Progressive Analytics: Automated volume calculation and Personal Record (PR) tracking to visualize growth over time.

 Technical Stack
Framework: React Native (Expo SDK 54)

Backend: Supabase (PostgreSQL + Auth)

Icons: Lucide-react-native

Navigation: React Navigation (Bottom Tabs + Stack)

Feedback: Expo-Haptics

 How to Run Locally
To run LiftNote on your own device, follow these steps:

1. Prerequisites
Install Node.js (v18+)

Install the Expo Go app on your iOS or Android device.

2. Setup
Bash
# Clone the repository
git clone [YOUR_REPO_URL]
cd liftnote

# Install dependencies
npm install
3. Environment Variables
Create a .env file in the root directory and add your Supabase credentials:

Plaintext
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
4. Start the Engine
Bash
npx expo start --tunnel
Scan the QR code appearing in your terminal using your phone's camera (iOS) or the Expo Go app (Android).