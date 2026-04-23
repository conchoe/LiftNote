1. Goal
Elevate my app from a local workout logger to a community-driven platform where users can synchronize data to the cloud, follow friends, and "upvote" the best training splits in a global marketplace.

2. Technical Stack
Backend/Database: Supabase (PostgreSQL) — chosen for its high compatibility with Expo and built-in Auth.

Authentication: Supabase Auth (Email/Password).

State Management: Transition from AsyncStorage to a hybrid model (Local cache + Supabase sync).

3. Database Schema (The "Social" Brain)
The AI needs to create/simulate these tables:

Profiles: id, username, avatar_url, current_streak, bio.

Workouts: id, user_id, workout_name, split_name, volume_total, created_at.

Splits (Marketplace): id, creator_id, name, description, structure_json, likes_count, created_at.

Likes: id, user_id, target_id (workout or split), type ('workout' | 'split').

Friends: id, user_id, friend_id, status ('pending' | 'accepted').

4. New Screen Requirements
Tab: "Community Feed"
Activity Feed: A scrollable list showing "Friend Activity." (e.g., "Mike just finished Push Day - he hit 225 on bench press for the first time!").

Interactions: A "Heart" icon on each workout. Tapping it increments the likes in the database and triggers a haptic pulse.

Friend Search: A search bar to find users by username and a "Follow/Add" button.

Tab: "The Marketplace"
Trending Splits: A horizontal scroll showing splits with the highest "Like Velocity" (likes gained in the last 7 days).

All-Time Greats: A list sorted by total likes_count. should be 5 total splits

Import Feature: A "Download to my Trainer" button on any split. This copies the structure_json from the marketplace split and adds it to the user's splits.

Profile / PR Screen
Trophy Case: Displays the user's all-time PRs (e.g., "Max Bench: 225 lbs").

Privacy Toggle: Allow users to set their profile to "Private" (only friends see logs) or "Public."

5. Elevated Logic (The "Algorithms")
Trending Logic: Trending = Total Likes / (Days since creation + 2)^1.8. (The AI should use a simplified version of this to sort the marketplace).

Social Streak: If a friend is about to lose their streak (hasn't logged in 48 hours), show a "Nudge" button to send them a notification/message.

6. Acceptance Criteria
[ ] Authentication: User can sign up, log in, and their data follows them to a different device.

[ ] Global Sync: A workout logged on Phone A appears in the feed of Phone B (Friend).

[ ] Marketplace Interaction: User can "Like" a split, and the count updates globally in real-time.

[ ] Persistence: If the user is offline, the app should queue the workout and upload it once a connection is restored (Bonus).