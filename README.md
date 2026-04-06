# Homework9

1. Overview

This app is a mobile workout tracker designed to bridge the gap between high-level "workout splits" and granular set-by-set logging. I chose this idea because traditional fitness apps often make it difficult to switch between different programming styles (like PPL vs. Upper/Lower) while maintaining a strict history of personal records. This app puts the "Split" at the center of the user experience.

2. Screen Descriptions

The "Train" Tab (Logging Screen): * This is the primary workspace. If no split is active, it prompts the user to create one.

    Once a split is active (e.g., "Push Day"), it displays the predefined exercises.

    Users can click an exercise to open a dynamic logging area where they can add rows for sets, reps, weight, and RPE.

The "Progress" Tab (History & Analytics):

    Displays the user's current workout streak at the top using a "Duolingo-style" fire icon.

    Includes a searchable history of every exercise saved to the device.

    Provides a visual frequency graph showing how many times the user has hit the gym recently.

The "Split Architect" (Modal/Screen):

    A 7-day planning interface where users can name their split and assign specific workouts (or "Rest") to each day.

3. How to Setup and Run
To run this app on your own device or simulator, follow these steps:

    Clone the repository:

        git clone [YOUR_GITHUB_URL_HERE]
        cd [YOUR_REPO_NAME]

    Install Dependencies:

        npm install
        npx expo install @react-native-async-storage/async-storage
    
    Start the App:

        npx expo start

    Open on Device:

        Android: Scan the QR code using the Expo Go app.

        iOS: Scan the QR code with your Camera app (ensure you have Expo Go installed).

