I am making a workout logging app in React Native using Expo Go SDK 54. In app/app-example is some useful information on integrated modules that Expo has that you can make use of as you please. 

Use AsyncStorage for keeping data stored


** Core Features **
1. A User should have a library of exercises that they can add. Then they should be able to select an exericse and record the number of reps, sets, weight, and their RPE (rate of perceived exertion) for each set of that exercise. 
DATA MODEL:
    - A workout split is like this ex. Push, Pull, Legs, Rest or Upper, Lower, Rest. 
    - A workout split contains workouts
    - A workout contains exerices
    - An exercise contains sets
    - A set contains reps, weight and RPE.
- They should also have way to input what split they are on. Give the user an option to "Create a new split". Do this by giving them 7 empty boxes where they can insert a workout into each one. Each workout consists of exercises, they can then name this workout. A user can fill 1-7 boxes if the boxes aren't all full it is fine. They should also be able to store multiple splits. They should be able to name each split.
2. All previous workouts should be saved to the device so that a user can go back and see how many reps and how much weight they did on an exercise in the past. 
3. Streak Counter, Implement a duolingo style streak counter where A users streak increases every day they are in the gym and is reset if they do not record a workout for 3 days.  
4. Data Persistance. All logs should be saved locally so that they persist after the app closes. 
5. Navigation: A Tab-based or Stack-based navigation between the "Log Workout" screen and the "History/Streaks" screen. For the History/Streaks screen, the users streak should be displayed at the top and they should be able to access the history of every exercise they have saved. As well as a visual representation of how often they have been going to the gym with a graph.  
Tab 1: logging workout screen
    State A: 
        The Log Workout screen should have them choose what split they are on. This split should persist until the person chooses to "change split." 
        example:
        -  A user opens the app and creates a split. They then log their workout. They close the app and reopen it. When they go to the "Log Workout" screen    they should already be inside of the split that they were last in. If they want to change their split they should have to exit out of their current split. 
    State B:
        Once they are in a split they should have to select what workout within that split that they are doing. They should then be able to see the exercises in that split displayed in boxes and be able to click on an exercise to log their set number, reps, weight, and rpe. 
        - sets should go from 1 at the minimum with a loose upper bound that grows as they enter more sets
        - reps should have a minimum of 1
        - weight should be in lbs and have a minimum of 1
        - RPE should be recorded from 1-10
        - The user should have the option to exit their current split when they are in state B.
    
Tab 2: 
    Prominent Fire icon with current streak count.
    - a simple bar chart showing workouts per week 
    - A searchable list of all exercises. Clicking one shows a history of every set ever recorded for that specific movement.

** Error Handling
    Data Validation: all inputs for sets, reps, weight, and rpe should be numeric. 
    - RPE should be bounded between 1 and 10;
    - prevent saving a workout if it has 0 sets.
    - if a user tries to log a workout before they have created a split the app should redirect them to creating a split instead of crashing
    - if a user goes to the progress tab but has no history saved, show a message saying "No Workouts Saved"

** Acceptance Criteria
    1. closing the app on a specific split and reopening it should land the user back on that same split. 
    2. A user can create a split that doesn't use all 7 boxes and it should NOT cause an error
    3. When a user adds a set to an exercise, the weight should default to the last set of that exercise to save time;
    4.if a workout was logged on monday, the users streak should not be reset to 0 until 12:00 am on thursday.
    5. Changing a split name or exercise name does NOT delete historical logs of the old exercise names
    6. The app refuses to save if a weight field is left blank, but it should not crash
    7. When a workout is saved there should be some visual indication that it was saved. example: a "workout logged!" animation or a checkmark
    8. Offline capability: the app should be able to function fully without an internet connection