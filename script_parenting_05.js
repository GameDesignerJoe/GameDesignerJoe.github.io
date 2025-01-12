import { questions } from './questions.js';

let currentLevel = 2; // Tracks the level of the game
console.log("Current level:", currentLevel);

const buttonClickedSound = new Audio("audio/mouse-click.wav"); // button sound

function playButtonClickedSound() {
    buttonClickedSound.play();
}
buttonClickedSound.preload = "auto";

const temporaryTexts = [
    "you are a terrible parent",
    "you are a liar",
    "liar",
    "i know what you did",
    "you abandoned me",
];

// Starting stats
let stats = {
    happiness: 50,
    resilience: 50,
    social: 50,
    independence: 50
}

function updateStatLabels(level) {
    const statLabels = {
        1: ["Happiness", "Resilience", "Social", "Independence"],
        2: ["Coddling", "Distain", "Neglect", "Abandonment"],
    };

    if (statLabels[level]){
        const labels = statLabels[level];
        document.querySelector("#happiness-number").nextElementSibling.textContent = labels[0];
        document.querySelector("#resilience-number").nextElementSibling.textContent = labels[1];
        document.querySelector("#social-number").nextElementSibling.textContent = labels[2];
        document.querySelector("#independence-number").nextElementSibling.textContent = labels[3];
    } else {
        console.error("No stat labels found for level:", level);
    }
}

// Arrays for each age range
const choicesBabyToddler = [];
const choicesElementary = [];    
const choicesMiddle = [];
const choicesHighschool = [];

// Game state
let currentYear = 1;
const choices = [];

// Define haunted effects for specific levels and years
const hauntedEffects = {
    2: { // Level 2 effects
        2: () => { // Flicker button label
            const yesButton = document.getElementById("yes");
            const noButton = document.getElementById("no");
            const questionElement = document.getElementById("question-text");

            if (yesButton && noButton && questionElement) {
                // Dynamically fetch the labels from he question's dataset
                const originalYesLabel = yesButton.textContent;
                const originalNoLabel = noButton.textContent;

                // Track the current state of the flicker
                let isFlickering = false;

                // flicker function
                const flickerLabels = () => {
                    if (!isFlickering) {
                        // Start flickering: "Show worst parent ever"
                        isFlickering = true;
                        yesButton.textContent = "You are the";
                        noButton.textContent = "worst Parent EVER!";

                        setTimeout(() => {
                            // Restore the button labels.
                            yesButton.textContent = originalYesLabel;
                            noButton.textContent = originalNoLabel;
                            isFlickering = false; // restarts flicker
                        }, Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000); // stay on 'worst parent ever' for 1-3 seconds
                    }
                };

                // Flicker the button labels
                const interval = setInterval(() => {
                    if (!isFlickering) {
                        flickerLabels();
                    }                    
                }, Math.floor(Math.random() * (4000 - 2500 + 1)) + 5000); // Wait 5-8 seconds before starting the flicker
                
                // stop flicker when the question changes
                const observer = new MutationObserver(() => {
                    // If question text changes, stop the flicker
                    clearInterval(interval);
                    observer.disconnect();

                    // Reset the button labels
                    yesButton.textContent = originalYesLabel;
                    noButton.textContent = originalNoLabel;
                });

                // Observe changes to the question text
                if (questionElement) {
                    observer.observe(questionElement, { childList: true });
                }            
            } else {
                console.error("Buttons with IDs 'yes' and 'no' not found!");
            }
        },
        3: () => { // Text shake effect
            const questionElement = document.getElementById("question-text");
        
            if (questionElement) {
                // Words you want to target
                const wordsToShake = ["potty", "criticize", "pressure", "expectations"]; // Example words to shake
        
                // Original question text
                const originalText = questionElement.textContent;
        
                // Wrap the target words in <span>
                const updatedText = originalText.replace(
                    new RegExp(`\\b(${wordsToShake.join("|")})\\b`, "gi"),
                    `<span class="shake-word">$1</span>`
                );
        
                // Update the question text with wrapped words
                questionElement.innerHTML = updatedText;
        
                // Add shake effect to all wrapped words
                const shakeElements = questionElement.querySelectorAll(".shake-word");
                shakeElements.forEach((element) => {
                    element.classList.add("shake");
                });
        
                // Remove the shake effect after 500ms
                setTimeout(() => {
                    shakeElements.forEach((element) => {
                        element.classList.remove("shake");
                    });
                }, 1000); // Reset after 500ms
            }
        },        
        4: () => { // Year 3 effect
            const questionElement = document.getElementById("question-text");
        
            if (questionElement) {
                // Original question text
                const originalText = questionElement.textContent;
        
                // List of indexes for letters to highlight
                const highlightIndexes = [5, 10, 15]; // Example: Highlight letters at these positions
        
                // Create the highlighted text with spans
                const updatedHTML = originalText
                    .split("")
                    .map((char, index) => {
                        if (highlightIndexes.includes(index)) {
                            return `<span class="pulsing-letter">${char}</span>`;
                        }
                        return char;
                    })
                    .join("");
        
                // Update the question element
                questionElement.innerHTML = updatedHTML;
            } else {
                console.error("Element with ID 'question-text' not found");
            }
        },        
        5: () => { // Year 18 effect
            // Flash the background
            const body = document.body;

            // Save the current background image
            const originalBackgroundImage = body.style.backgroundImage;

            // Flash the background color
            body.style.backgroundImage = "none";
            body.style.backgroundColor = "black";
            
            setTimeout(() => {
                body.style.backgroundImage = originalBackgroundImage; 
                body.style.backgroundColor = ""; 
            }, 200); 
        },
        6: () => { // Haunted Effect: Mouse Enter
            const yesButton = document.getElementById("yes");
            const noButton = document.getElementById("no");
            const questionElement = document.getElementById("question-text");

            if (yesButton && noButton && questionElement) {
                // Save the original button labels
                const yesLabel = yesButton.textContent;
                const noLabel = noButton.textContent;

                // Define hover handlers
                const yesHoverEnter = () => { yesButton.textContent = "You can't hide!"; };
                const yesHoverLeave = () => { yesButton.textContent = yesLabel; };
                const noHoverEnter = () => { noButton.textContent = "Don't click!"; };
                const noHoverLeave = () => { noButton.textContent = noLabel; };

                // Add hover effects to buttons
                yesButton.addEventListener("mouseenter", yesHoverEnter);
                yesButton.addEventListener("mouseleave", yesHoverLeave);
                noButton.addEventListener("mouseenter", noHoverEnter);
                noButton.addEventListener("mouseleave", noHoverLeave);

                // Remove hover effects after 10 seconds
                setTimeout(() => {
                    yesButton.removeEventListener("mouseenter", yesHoverEnter);
                    yesButton.removeEventListener("mouseleave", yesHoverLeave);
                    noButton.removeEventListener("mouseenter", noHoverEnter);
                    noButton.removeEventListener("mouseleave", noHoverLeave);

                    // Reset the button labels
                    yesButton.textContent = yesLabel;
                    noButton.textContent = noLabel;
                }, 10000); // Reset after 10 seconds
            } else {
                console.error("Buttons with IDs 'yes' and 'no' not found!");
            }
        },
        8: () => { // Haunted Effecgt
                // effect here
        },
    },
    3: {
        1: () => { // Year 3 effect
            // Add shake effect to question text
            const questionElement = document.getElementById("question-text");
            if (questionElement){
                questionElement.classList.add("shake");
                setTimeout(() => {   
                    questionElement.classList.remove("shake");
                }, 500); // Reset after 500ms
            }
        },
        2: () => { // Year 13 effect
            // Change button labels temporarily
            const yesButton = document.getElementById("yes");
            const noButton = document.getElementById("no");
            if (yesButton && noButton) {
                yesButton.textContent = "Liar!";
                noButton.textContent = "You Failed!";
                setTimeout(() => {   
                    yesButton.textContent = "Yes";
                    noButton.textContent = "No";
                }, 1000); // Reset after 1000ms
            }
        },
        3: () => { // Year 18 effect
            // Flash the background
            const body = document.body;
            body.style.backgroundColor = "black";
            setTimeout(() => {
                body.style.backgroundColor = ""; // Reset to original background color
            }, 500); // Reset after 500ms
        }
    }
};

function applyHauntedEffect(level, year) {
    const header = document.getElementById("page-title"); // Title of the page

    if (currentLevel === 2 && header) {
        // change title
        header.textContent = "You are a terrible parent.";
        document.title = "You are a terrible parent.";
    }

    const yearElement = document.getElementById("year"); //Targt the year element
    if (level === 2 && yearElement) {
        // start flickering effect for level 2
        const originalText = `Your child is ${currentYear}`; // Store the original text

        // Flicker logic
        const flickerEffect = () => {
            yearElement.textContent = "Your child is gone";  // Temporarily change the text
            setTimeout(() => {
                    yearElement.textContent = `Your child is ${currentYear}`; // Reset to original text
            }, 100); // "gon" lasts for .2 seconds"
        };

        //Keep "Your child is 1" for longer duration
        const interval = setInterval(() => {
            flickerEffect();
        }, Math.floor(Math.random() * (5000 - 3000 + 1)) + 5000); // Flicker to "gone" every 5-7 seconds 

        // Stop flickering
        setTimeout(() => {
            clearInterval(interval);
            yearElement.textContent = `Your child is ${currentYear}`; // Reset to original text
        }, 20000); // Stop after 20 seconds
    }

    if (hauntedEffects[level] && hauntedEffects[level][year]) {
        hauntedEffects[level][year]();
    }
}

// Update UI with the current year and question
function updateQuestion() {
    const questionBlock = document.getElementById("question-block");
    const questionElement = document.getElementById("question-text");
    const yearElement = document.getElementById("year");

    if (currentLevel === 2){ // get the stats to change for the new level
        updateStatLabels(currentLevel);
    }

    if (!questionElement) {
        console.error("updateQuestion: 'question-text' element not found!");
        return;
    }

    // Ensure questions exists for the current level
    const levelQuestions = questions[currentLevel];
    if (!levelQuestions) {
        console.error("No questions available for current level:", currentLevel);
        return;
    }

    // ensure questions exist for the current year
    const yearQuestions = levelQuestions[currentYear];
    if (!yearQuestions || yearQuestions.length === 0) {
        console.error("No questions available for current year", currentYear);
        return;
    }

    // if (!yearElement) {
    //     console.error("No questions available for current year:", currentYear);
    //     return;
    // }

    // Select a random question
    const randomIndex = Math.floor(Math.random() * yearQuestions.length);
    const currentQuestion = yearQuestions[randomIndex];

    // Update the year and question text
    yearElement.textContent = `Your child is ${currentYear}`;
    questionElement.textContent = currentQuestion.text;
    questionElement.dataset.yes = currentQuestion.yes;
    questionElement.dataset.no = currentQuestion.no;
    questionElement.dataset.statAdjustments = JSON.stringify(currentQuestion.statAdjustments);

    // Update the button labels
    const yesButton = document.getElementById("yes");
    const noButton = document.getElementById("no");
    if (yesButton) yesButton.textContent = currentQuestion.yesLabel || "Yes";
    if (noButton) noButton.textContent = currentQuestion.noLabel || "No";

    // Apply haunted effects
    applyHauntedEffect(currentLevel, currentYear);
}

function updateStatDisplay(stat) {
    const statElement = document.getElementById(`${stat}-number`);

    // If the element exists, update its text content
    if (statElement) {
        statElement.textContent = stats[stat];
    } else {
        console.error('Stat element with ID ${stat}-number not found');
    }
}

// Handle player choices
function handleChoice(choice) {
    const questionElement = document.getElementById("question-text");
    if (!questionElement) {
        console.error("Element with ID 'question-text' not found");
    return; // Prevent further execution
    }

    const choiceText = choice === "yes" ? questionElement.dataset.yes : questionElement.dataset.no;
    if (!choiceText) {  
        console.error("choiceText is not defined");
        return; // Prevent further execution
    }

    // console.log("Processing choice;", choiceText, "with text:", choiceText);

    // Add to choices and update relevant blocks
    if (currentYear >= 1 && currentYear <= 4) {
        const group = document.getElementById("group-baby-toddler");
        // console.log("Group element:", group);

        if (group) {
            group.style.display = "block";
            const choicesElement = document.getElementById("choices-baby-toddler");
            // console.log("Child element:", choicesElement);

            if (choicesElement) {
                choicesBabyToddler.push(choiceText);
                choicesElement.textContent = choicesBabyToddler.join(" ");
            } else {
                console.error("Element with ID 'choices-baby-toddler' not found");
            }
        } else {
            console.error("Parent block 'group-baby-toddler' not found");
        }
        
    } else if (currentYear >= 5 && currentYear <= 10) {
        document.getElementById("group-elementary").style.display = "block";
        choicesElementary.push(choiceText);
        document.getElementById("choices-elementary").textContent = choicesElementary.join(" ");
    } else if (currentYear >= 11 && currentYear <= 13) {
        document.getElementById("group-middle").style.display = "block";
        choicesMiddle.push(choiceText);
        document.getElementById("choices-middle").textContent = choicesMiddle.join(" ");
    } else if (currentYear >= 14 && currentYear <= 18) {
        document.getElementById("group-highschool").style.display = "block";
        choicesHighschool.push(choiceText);
        document.getElementById("choices-highschool").textContent = choicesHighschool.join(" ");
    }

    // Adjust stats
    const statAdjustments = JSON.parse(questionElement.dataset.statAdjustments || "{}");
    const adjustments = statAdjustments[choice];
    for (let stat in adjustments) {
        stats[stat] += adjustments[stat];
        updateStatDisplay(stat);
    }

    // Move to the next year
    currentYear++;
    if (currentYear > 18) {
        endGame();
    } else {
        updateQuestion();
    }
}

// ------------------------------------ //
// End the game and display the result
function endGame() {
    const questionBlock = document.getElementById("question-block");
    const getResultsButton = document.getElementById("get-results");

    // Hide the question block and show the result block
    questionBlock.style.display = "none";
    
    // Show the "Get Results" button
    getResultsButton.style.display = "block";

    // Add a click event to the button
    getResultsButton.addEventListener("click", showResults);
}

function showResults() {
    const resultBlock = document.getElementById("result-block");
    const getResultsButton = document.getElementById("get-results");
    const resultTitle = document.getElementById("final-title");
    const resultDescription = document.getElementById("final-description");

    // Restart button
    const restartButton = document.getElementById("restart");

    // Hide the "Get Results" button
    getResultsButton.style.display = "none";

    // Show the result block
    resultBlock.style.display = "block";
    restartButton.style.display = "block";

    // Determine the final result based on stats
    let title = "";
    let description = "";

    if (stats.happiness < 30) {
        title = "You are a terrible parent.";
        description = "While happiness isn't everything, you have created an adult who doesn't beleive they deserve to be loved. Despite their other traits, they will forever feel as if they are undeserving of love. This will drive them to seek relationships that reinforce this 'unworthy' self-image, leading to toxic partners, and poor career choices. <br><br>You should have done better.";
    } else if (stats.happiness > 80) {
        title = "You are a terrible parent.";
        description = "You have coddled your child, making them completely unaware of the realities of the world and relient totally on you. If they ever find love, which is unlikely, they will be codependent with their partner, who will be exactly like you and thus you will hate them, driving a wedge between you and your child. <br><br>You should have done better.";
    } else if (stats.resilience < 35) {
        title = "You are a terrible parent.";
        description = "You have failed to make your child resilient. They look to you for everything, unable to survive even the meekest of discomforts. They have grown into a whiny, annoy adult baby who complains about everything and expects everyone to give them whatever they desire. If your child finds a partner, they will be meek and enabling this behavior, suffering your child's abuse when they don't get what they want. Your inability to teach resilience to your child has resulted in them becoming a toxic partner to others and spoiled beyond employability. <br><br>You should have done better.";
    } else if (stats.resilience > 80) {
        title = "You are a terrible parent.";
        description = "You have made your child too resilient. They are unable to show any emotion, even when it is appropriate. They are unable to connect with others and will be alone for the rest of their life. They look at others as only something that will hurt them or to be taken advantage of. While they will be strong in their career, they will never find the ability to be a true partner to anyone in their life. <br><br>You should have done better.";
    } else if (stats.social < 30) {
        title = "You are a terrible parent.";
        description = "You have failed to properly socalize your child, turning them into a recluse who will never leave your basement. Worse, they either see nothing wrong with this or blame everyone else for their lack of connections. This will lead them down a dark hole of depression and loneliness. While you were making sure your child was happy in the short term, you failed to think about their future, which will now be empty of anyone other than you. That is until you die, then they'll just be alone. <br><br>You should have done better.";
    } else if (stats.social > 80) {
        title = "You are a terrible parent.";
        description = "You have raised a child who only wants to party and be unaccountable for any sort of responsibility. They base their whole identity around who they are with and what they are doing. Anyone with real depth will grow tired of their 'life of the party' bs and move on to someone with more substance. As for their career, they swear their twitch channel will blow up any day now. You should have spent more time introducing your child to the realities of adulthood and less placating their ever growing ego. <br><br>You should have done better.";
    } else if (stats.independence < 30) {
        title = "You are a terrible parent.";
        description = "You have raised a child who is so dependent on you they can't make a decision without your input. They will never be able to make a decision on their own, never be able to stand up for themselves, and will never be able to be a partner to anyone. They will either be alone for the rest of their life or will never leave your side until you die. They are unable to make a connection with anyone. <br><br>You should have done better.";
    } else if (stats.independence > 70) {
        title = "You are a terrible parent.";
        description = "You have raised a child who is so independent they don't need anyone. They couldn't get out of the house fast enough. You will never hear from them again. They will never have a partner beyond a one night stand, never have children or any real connections, and will die alone. Instead of making sure your kid could stand on their own two feet, perhaps you should have spent more time showing them they were loved and part of a family. <br><br>You should have done better.";
    } else {
        title = "You are a terrible parent.";
        description = "Regardless of the choices you made, your child did not meet the expectations you had for them. They are insecure, overly concerned with their body image, spend more time alone than they should, and seem to lack any motivation beyond not doing anything meaningful with their life. <br><br>You should have done better.";
    }

    // Display the title and description
    resultTitle.textContent = title;
    resultDescription.innerHTML = description;
}

// Attach event listeners
document.getElementById("yes").addEventListener("click", () => {
    playButtonClickedSound();
    handleChoice("yes")
});

document.getElementById("no").addEventListener("click", () => {
    playButtonClickedSound();
    handleChoice("no")
});

// Initialize the game
updateQuestion();

// Restart the game
const restartSound = new Audio("audio/haunted_tech.wav");
document.getElementById("restart").addEventListener("click", () => {
    console.log("Restarting game...");
    
    // Play restart sound
    restartSound.play();

    // Reset stats
    stats.happiness = 50;
    stats.resilience = 50;
    stats.social = 50;
    stats.independence = 50;

    // Reset choices arrays
    choicesBabyToddler.length = 0;
    choicesElementary.length = 0;
    choicesMiddle.length = 0;
    choicesHighschool.length = 0;

    // reset all choice blocks
    const groupBabyToddler = document.getElementById("group-baby-toddler");
    const groupElementary = document.getElementById("group-elementary");
    const groupMiddle = document.getElementById("group-middle");
    const groupHighschool = document.getElementById("group-highschool");

     // Hide all group blocks
    if (groupBabyToddler) {
        groupBabyToddler.style.display = "none";
    }
    if (groupElementary) {
        groupElementary.style.display = "none";
    }
    if (groupMiddle) {
        groupMiddle.style.display = "none";
    }
    if (groupHighschool) {
        groupHighschool.style.display = "none";
    }

    // Clear text content for choice blocks
    const choicesBabyElement = document.getElementById("choices-baby-toddler");
    if (choicesBabyElement) {
        choicesBabyElement.textContent = "";
    }

    const choicesElementaryElement = document.getElementById("choices-elementary");
    if (choicesElementaryElement) {
        choicesElementaryElement.textContent = "";
    }

    const choicesMiddleElement = document.getElementById("choices-middle");
    if (choicesMiddleElement) {
        choicesMiddleElement.textContent = "";
    }

    const choicesHighschoolElement = document.getElementById("choices-highschool");
    if (choicesHighschoolElement) {
        choicesHighschoolElement.textContent = "";
    }

// Reset year and level
currentYear = 1;
currentLevel++;
console.log("Current level:", currentLevel);

// Ensure visibility of the question block
const questionBlock = document.getElementById("question-block");
if (questionBlock) {
    questionBlock.style.display = "block";
}

const resultBlock = document.getElementById("result-block");
if (resultBlock) {
    resultBlock.style.display = "none";
}

const restartButton = document.getElementById("restart");
if (restartButton) {
    restartButton.style.display = "none";
}

// Update the first question
updateQuestion();
});