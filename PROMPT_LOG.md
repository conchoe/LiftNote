#Prompt Log

1. Read SPEC.md in this project. Implement the full mobile app exactly as specified. 
Create all necessary files, components, and navigation. Make sure that appropriate data is persistent. 
Avoid security risks for sensitive data.  Include proper error handling. 
Make sure the app starts without errors and displays the home screen correctly.

2. Review the React Native/Expo code in this project against the spec in SPEC.md. 
For each acceptance criterion in the spec, verify whether the code actually implements it correctly. 
Also check for:
- Bugs or logic errors
- Missing error handling
- Code quality issues (unclear naming, repeated code, etc.)
- Best practices for React Native or other technologies

Format your review as a numbered list of findings, each marked as [PASS], [FAIL], or [WARN]. 
Be specific. Reference file names and line numbers. 
Export the review as REVIEW.md at the root of the project.

3. Okay Now I want to fix some of the UI/UX. right now the Exit split button is almost off of the screen and I can't pres it. Make it so that the button is more on the screen and pressable, also change the color scheme so that all the green buttons are a chrome/whiteish color. Additionally everytime i log a workout and i save a workout, the Workout Saved animation doesn't play until i exit out and click back onto that workout. Make it so that it plays right as I store it. 

4. I am upgrading my Expo Go workout app to include a Supabase backend. Please read the attached SPEC2.md. Your first task is to:

Help me set up the Supabase client initialization.

Create a 'Marketplace' screen that fetches 'Splits' from a Supabase table.

Implement a 'Like' button that uses optimistic UI updates (changes the color immediately, then updates the database in the background).

5. Review the React Native/Expo code in this project against the spec in SPEC.md.  and SPEC2.md
For each acceptance criterion in the spec, verify whether the code actually implements it correctly. 
Also check for:
- Bugs or logic errors
- Missing error handling
- Code quality issues (unclear naming, repeated code, etc.)
- Best practices for React Native or other technologies

Format your review as a numbered list of findings, each marked as [PASS], [FAIL], or [WARN]. 
Be specific. Reference file names and line numbers. 
Export the review as REVIEW.md at the root of the project.

6. Can you read REVIEW.md and fix all of the failures and warning that came from SPEC2.md

7. can you implement a way for users to see their friends, who they are, how many they have. In the account tab there should be a instagram like followers and following at the top showing the number of people a user follow and the number of users that follow that user. They should then be able to click on that number to see a screen with all of their followers or following listed depending on which one they click

Additionally a way for users to see the username of whoever has sent them a friend request.

8. Okay now I want to add a few features. I want to make it so that when a user receieves a friend request they can see the other user's username. Additionally after they accept the request the accept button should turn into a "follow-back" button where the user can then in turn send a follow request back to the other user.
Additionally I want to add a feature where if you click on a person's username in the community tab or when viewing your followers/following. If they are public or if you follow them you should be able to see their trophy case and their last few workouts and last used split

9. Can you then implement a way for splits to be populated on the marketplace by users. heres how I want it to work. First off the marketplace should only consist of splits from PUBLIC profiles. If a profile is public and it has one of the top 5 most liked splits add it to the marketplace. Additionally if a profile is public and it has gained more likes in the past week than any other, put the top 3 most trending splits on the marketplace.

10. Okay can you make it so that a user's password can be 3 characters long, Next, can you implement these UI/UX details The "Modern UI/UX Overhaul" Prompt for Cursor
Context: I am refining the UI/UX of my workout app, LiftNote, to meet 2025 modern mobile standards. My goal is to move away from a "basic" look to a premium, accessible, and high-performance design.

Design Principles to Apply:

One-Handed Usability: Ensure all primary actions (Log Set, Start Workout, Save) are in the "Thumb Zone" (bottom 2/3 of the screen). If we have top-mounted buttons, move them to a Bottom Action Bar or use a Floating Action Button (FAB).

Clarity & Content-Focus: Remove unnecessary borders and "visual noise." Use whitespace to group elements. Exercise cards should be clean, using subtle shadows or a slightly lighter gray background against a dark theme.

Modern Dark Mode: Update the theme to use a deep dark gray (#121212) as the background instead of pure black. Use desaturated primary colors for accents to reduce eye strain.

Micro-interactions & Feedback: > - Add visual feedback for all pressable elements (e.g., scale down slightly when pressed).

Use expo-haptics to provide a "light" impact when a set is logged and a "success" notification when a workout is completed.

Implement "Optimistic UI" for the Like button (it should change state instantly before the server responds).

Touch Targets & Accessibility: Ensure every button is at least 44x44 points. Use a clear typographic scale with bold headings (San Francisco/System font) and legible body text with a contrast ratio of at least 4.5:1.

Specific Screen Tasks:

Log Screen: Redesign the set-entry rows. Use a cleaner table-less layout. Use large, easy-to-tap numeric inputs.

Marketplace: Use high-quality "Cards" for splits. Each card should show the Split Name, Creator, and Like count prominently.

Navigation: Ensure the BottomTabNavigator is clean, using modern icons (Lucide or Ionicons) and subtle labels.

Technical Requirement: Use React Native Paper or Lucide-react-native for icons if available, and ensure all styling is handled via a centralized theme.js file for consistency.

11. Okay now I want there to be a base exercise library for a new user. it should include these exercises: 🦵 Legs (Quads, Hamstrings, Glutes)
Back Squat / Front Squat (The king of leg movements)

Leg Press (Machine-based volume)

Romanian Deadlift (RDL) (Focuses on hamstrings/glutes)

Leg Extension (Quad isolation)

Leg Curl (Hamstring isolation)

Lunges (Dumbbell or Barbell)

Calf Raises (Standing or Seated)

👕 Chest
Bench Press (Flat, Incline, or Decline)

Dumbbell Press (Allows for a deeper range of motion)

Chest Flyes (Dumbbell or Cable)

Push-ups (The classic bodyweight builder)

Dips (Chest-focused variant)

🛶 Back
Deadlift (Conventional or Sumo)

Pull-ups / Chin-ups (Vertical pulling)

Lat Pulldowns (Machine alternative to pull-ups)

Bent-Over Rows (Barbell or Dumbbell)

Seated Cable Rows (Horizontal pulling)

Face Pulls (Great for rear delts and posture)

🗿 Shoulders
Overhead Press (Military Press - Standing or Seated)

Dumbbell Lateral Raises (For that "wide" shoulder look)

Arnold Press (Rotational shoulder press)

Front Raises (Targeting anterior delts)

Reverse Flyes (Rear delt isolation)

💪 Arms (Biceps & Triceps)
Barbell Bicep Curls (Mass builder)

Hammer Curls (Focuses on the forearms and brachialis)

Preacher Curls (Isolation)

Tricep Pushdowns (Cable-based)

Skull Crushers (EZ Bar tricep extensions)

Overhead Tricep Extension (Dumbbell or Cable)

🧱 Core & Foundation
Plank (Isometric stability)

Hanging Leg Raises (Lower abs)

Crunches / Sit-ups (Upper abs)

Russian Twists (Obliques) and they should still ahve the option to add more by typing them in. Make the exercise library foldable so that the exercises are only listed if you click on the library.