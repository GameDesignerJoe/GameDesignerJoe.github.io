// Questions for each year
const questions = {
    1: [
        { 
            text: "Do you want to breastfeed your child?", 
            yes: "You have chosen to breastfeed your child.", 
            no: "You have chosen not to breastfeed your child.",
            yesLabel: "Breastfeed",
            noLabel: "Don't breastfeed",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: 0, independence: 0 },
                no: { happiness: 0, resilience: 0, social: 0, independence: 5  }
            },
        },
        { 
            text: "Do you want to use disposable diapers?", 
            yes: "You have chosen to use disposable diapers.", 
            no: "You have chosen not to use disposable diapers.", 
            yesLabel: "Disposable",
            noLabel: "Cloth",
            statAdjustments: {
                /* Happiness - Resilience - Social - independence */
                yes: { happiness: 5, resilience: 0, social: 0, independence: 0 },
                no: { happiness: -5, resilience: 0, social: 0, independence: 0  }
            },
        }, 
        { 
            text: "Your child is crying constantly and nothing seems to sooth them except suckling. Do you decide to start using a pacifier?", 
            yes: "You have chosen to use a pacifier.", 
            no: "You have chosen not to use a pacifier.",
            yesLabel: "Use pacifier",
            noLabel: "Don't use pacifier",
            statAdjustments: {
                /* Happiness - Resilience - Social - independence */
                yes: { happiness: 5, resilience: -5, social: 0, independence: 0 },
                no: { happiness: -10, resilience: 10, social: 0, independence: 0  }
            }, 
        },
        { 
            text: "Your baby cries constantly when you try to sleep-train them, but experts say it’s necessary for their development. Do you comfort them each time or let them cry it out?", 
            yes: "You have chosen to comfort your child when they cry at night.", 
            no: "You have chosen not to comfort your baby when they cry at night.",
            yesLabel: "Comfort",
            noLabel: "Let cry",
            statAdjustments: {
                /* Happiness - Resilience - Social - independence */
                yes: { happiness: 5, resilience: -15, social: 0, independence: 0 },
                no: { happiness: -10, resilience: 10, social: 0, independence: 5  }
            },
        }, 
    ],
    2: [
        { 
            text: "You get your child into a private, highly regarded daycare. However after a few weeks, you realize that the daycare is not a good fit for your child. Do you keep them in the private daycare or move them to a public daycare?", 
            yes: "You have chosen to send your child to a private daycare.", 
            no: "You have chosen not to send your baby to a private daycare.",
            yesLabel: "Private daycare",
            noLabel: "Public daycare",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: 0, independence: 0 },
                no: { happiness: 5, resilience: -5, social: 10, independence: 0  }
            },
        },
        { 
            text: "Your child finds a NERF gun at a friend’s house and wants one. Do you buy it, knowing it’s a toy, or refuse, knowing it’s a weapon?", 
            yes: "You have chosen to buy your child a NERF gun.", 
            no: "You have chosen not to buy your child a NERF gun.",
            yesLabel: "Buy NERF gun",
            noLabel: "Don't buy NERF gun",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: 5, independence: 0 },
                no: { happiness: -5, resilience: 5, social: 0, independence: 0  }
            },
        },
        { 
            text: "Your baby forms a deep attachment to a relative who belittles your parenting. Do you sever the connection to protect yourself or let it continue for your child’s bond?", 
            yes: "You have chosen to break off communication with your child's favorite relative.", 
            no: "You have chosen not to break off communication with your child's favorite relative.",
            yesLabel: "Sever connection",
            noLabel: "Let it continue",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: 0, independence: 0 },
                no: { happiness: 10, resilience: -5, social: 5, independence: 0  }
            },
        },
        { 
            text: "Your toddler cries every morning when dropped off at daycare, but quitting work would bankrupt your family. Do you keep sending them or risk financial ruin?", 
            yes: "You keep sending them to daycare despite their constant crying ", 
            no: "You have chosen to remove them from daycare and raise them at home, despite the financial state it puts your family in.",
            yesLabel: "Keep sending",
            noLabel: "Remove from daycare",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 10, social: 5, independence: 0 },
                no: { happiness: 5, resilience: -5, social: -5, independence: 0  }
            },
        },
    ],
    3: [
        { 
            text: "Your child bites another at daycare. Do you discipline harshly to prevent it from happening again or forgive, knowing they’re still learning?", 
            yes: "You have chosen to discipline your child harshly over bitting another child.", 
            no: "You have chosen not to discipline your child over biting another child.",
            yesLabel: "Discipline harshly",
            noLabel: "Forgive",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: -5, independence: 0 },
                no: { happiness: 0, resilience: -5, social: -10, independence: 0  }
            },
        },
        { 
            text: "They show no interest in potty training, but your peers criticize you for delaying. Do you pressure them to meet societal expectations or wait until they’re ready?", 
            yes: "You have chosen to pressure your child into potty training.", 
            no: "You have chosen not to pressure your child into potty training.",
            yesLabel: "Pressure",
            noLabel: "Wait",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: 5, independence: 5 },
                no: { happiness: 5, resilience: -5, social: -5, independence: -5  }
            },
        },
    ],
    4: [
        { 
            text: "Your child loves performing but freezes during a recital. Do you force them to stick with it, despite them wanting to quit or let them quit to avoid their discomfort?", 
            yes: "You have chosen to force your child to continue performing, despite their discomfort.", 
            no: "You have chosen to let your child drop out of performing.",
            yesLabel: "Force to continue",
            noLabel: "Let them quit",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: -5, independence: 0 },
                no: { happiness: 5, resilience: -5, social: 0, independence: 0  }
            },
        },
        { 
            text: "You find a nice pair of your kids jeans shoved under their bed. When you ask your child about it they start crying. They tell you they don't like those jeans because they make them look fat. Do you get rid of the jeans and tell them not to worry about it or do you talk to them about body image?", 
            yes: "You have chosen to get rid of the jeans and tell them not to worry about it.", 
            no: "You have chosen to talk to them about body image.",
            yesLabel: "Get rid of jeans",
            noLabel: "Talk about body image",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: -5, social: 5, independence: 0 },
                no: { happiness: 0, resilience: 5, social: 0, independence: 5  }
            },
        },
    ],
    5: [
        { 
            text: "Your child asks if Santa is real. Do you continue the fantasy telling them he is or do you tell them the truth, knowing you're taking some of the magic out of the world for them?", 
            yes: "You have chosen to continue the fantasy that Santa is real.", 
            no: "You have chosen to tell them the truth that Santa isn't real.",
            yesLabel: "Continue fantasy",
            noLabel: "Tell the truth",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 10, resilience: 5, social: 0, independence: 0 },
                no: { happiness: -5, resilience: 0, social: 0, independence: 0  }
            },
        },
    ],
    6: [
        { 
            text: "Your child steals a small toy and seems proud. Do you confront them directly or wait to address it gently?", 
            yes: "You have chosen to confront them directly, making an example out of them.", 
            no: "You have chosen to address it later, when they can better process what they've done.",
            yesLabel: "Confront directly",
            noLabel: "Address later",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: 0, independence: 0 },
                no: { happiness: -5, resilience: 0, social: 0, independence: 0  }
            },
        },
    ],
    7: [
        { 
            text: "They struggle with math and fall behind their class. Do you enforce extra practice or let them focus on their strengths?", 
            yes: "You enforce extra practice.", 
            no: "You have chosen to let them practice on their strengths.",
            yesLabel: "Extra practice",
            noLabel: "Focus on strengths",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: 0, independence: 0 },
                no: { happiness: 0, resilience: 0, social: 0, independence: 0  }
            },
        },    
    ],
    8: [
        { 
            text: "Their coach benches them unfairly. Do you confront the coach or teach your child to endure?", 
            yes: "You confront the coach directly.", 
            no: "You don't confront the coach.",
            yesLabel: "Confront coach",
            noLabel: "Don't confront coach",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: -5, independence: 0 },
                no: { happiness: -5, resilience: 5, social: 0, independence: 0  }
            },
        },
        { 
            text: "You need to move out of the place you live because the neighborhood is horrible. However, your child has been accepted into a special accelerated program at school. Do you stick it out and stay in the sketchy neighborhood or do you move knowing that the new school doesn't have any such program?", 
            yes: "You stick it out and stay in the horrible area so your child can go to the better school.", 
            no: "You move to the better neighborhood knowing that your child will not be able to attend the special program.",
            yesLabel: "Stay in bad neighborhood",
            noLabel: "Move to better neighborhood",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: 5, independence: 0 },
                no: { happiness: -10, resilience: 5, social: 0, independence: 5  }
            },
        },
    ],
    9: [
        { 
            text: "They tell you they hate a teacher who’s strict but highly effective. Do you request a transfer or teach them resilience?", 
            yes: "You have chosen to transfer your child to a teacher who is less strict, making your child happier.", 
            no: "You have chosen to leave your child in the class with the strict teacher.",
            yesLabel: "Transfer",
            noLabel: "Teach resilience",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: -10, social: 0, independence: 0 },
                no: { happiness: -5, resilience: 10, social: 0, independence: 0  }
            },
        },
    ],
    10: [
        { 
            text: "They ask you to stop attending their games or events because it makes them nervous. Do you respect their wishes or insist on being there for support?", 
            yes: "You have chosen to no longer attend their games, instead you drop them off and wait in the car to pick them up.", 
            no: "You have chosen keep coming to the games, despite their nervousness.",
            yesLabel: "Stop attending",
            noLabel: "Keep attending",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: 5, independence: 10 },
                no: { happiness: -5, resilience: 5, social: -5, independence: -5  }
            },
        },
        { 
            text: "Your child is being bullied by some kids at their school through social media. You talk to the parents, but they blame your child. Do you take the high road and use this as a teaching moment or do you retaliate, showing your child how to stand up for themselves?", 
            yes: "You have chosen to take the high road and hope your child will learn from your example.", 
            no: "You have confront the parents and school directly bringing the wrait of god down upon them.",
            yesLabel: "Take high road",
            noLabel: "Confront directly",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 10, social: -5, independence: 0 },
                no: { happiness: 5, resilience: 0, social: 0, independence: 5  }
            },
        },
    ],
    11: [
        { 
            text: "They find a stray animal and beg to keep it, despite their lack of experience and your lack of resources. Do you let them bring it home or teach them the limits of compassion?", 
            yes: "You have chosen to let them keep the animal, despite the financial burden.", 
            no: "You don't allow them to keep the pet and instead take them to the shelter to drop off the pet.",
            yesLabel: "Keep the animal",
            noLabel: "Don't keep the animal",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 15, resilience: -10, social: 5, independence: 0 },
                no: { happiness: -10, resilience: 5, social: 0, independence: 0  }
            },
        },
    ],
    12: [
        { 
            text: "Your child wants to spend hours playing video games, claiming it helps them make friends. Do you set strict limits or let them bond their way?", 
            yes: "You have chosen to set strict limits on their gaming time.", 
            no: "You have chosen to let them play games to their desire.",
            yesLabel: "Set limits",
            noLabel: "Let them play",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: -10, independence: 0 },
                no: { happiness: 5, resilience: -5, social: 5, independence: 5  }
            },
        },
    ],
    13: [
        { 
            text: "Your child struggles with body image and asks to start a diet. Do you support their initiative or reassure them to embrace who they are?", 
            yes: "You have support their diet.", 
            no: "You tell them you aren't supporting their diet.",
            yesLabel: "Support diet",
            noLabel: "Don't support diet",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: 5, independence: 5 },
                no: { happiness: -10, resilience: 5, social: 0, independence: 0  }
            },
        },
        { 
            text: "Your child throws a tantrum at dinner over the food you've made, throwing plates and glasses and threatening you. Do you ground them or back off and let them eat what they want?", 
            yes: "You have chosen to ground them for their behavior.", 
            no: "You have chosen to let them eat what they want.",
            yesLabel: "Ground them",
            noLabel: "Let them eat what they want",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: 0, independence: 0 },
                no: { happiness: -5, resilience: 0, social: 0, independence: 5  }
            },
        },
    ],
    14: [
        { 
            text: "Your child says they identify as a gender other than how they were born. Do you allow for them to start hormone treatment to begin the transition process?", 
            yes: "You have chosen to allow them to start the hormone treatment.", 
            no: "You have chosen not to let them start the hormone treatment.",
            yesLabel: "Allow hormone treatment",
            noLabel: "Don't allow hormone treatment",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 10, resilience: 0, social: 10, independence: 5 },
                no: { happiness: -15, resilience: 5, social: -15, independence: -5  }
            },
        },
    ],
    15: [
        { 
            text: "They start a relationship with someone who has drastically different values. Do you support them or voice your concerns?", 
            yes: "You have chosen to support their dating choice.", 
            no: "You do not support their choice in dating and tell them as such.",
            yesLabel: "Support dating",
            noLabel: "Don't support dating",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: 0, social: 5, independence: 5 },
                no: { happiness: -10, resilience: 5, social: -10, independence: -5  }
            },
        },
    ],
    16: [
        { 
            text: "Your child keeps failiing their driving test. You suspect it's because they're not interested in driving and aren't studying. Do you force them to study and learn to drive or step back and let them decide when or if they ever want to drive?", 
            yes: "You have chosen to force them to study and learn to drive.", 
            no: "You have chosen to let them decide when or if they ever want to drive.",
            yesLabel: "Force to study and drive",
            noLabel: "Let them decide",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: 5, independence: 5 },
                no: { happiness: 5, resilience: -10, social: -5, independence: -5  }
            },
        },
        { 
            text: "Your child is seeing a therapist because you're concerned about their mental health. However, the therapist says that your child doesn't think they have a problem. The therapist says they can't treat someone who doesn't think there's anything wrong with them. Do you find a new therapist or do you let them stop going?", 
            yes: "You chose to find a new therapist for your child.", 
            no: "You chose to let your child stop going to therapy, despite believing there is still a problem.",
            yesLabel: "Keep in therapy",
            noLabel: "Stop therapy",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 5, social: 5, independence: -5 },
                no: { happiness: 5, resilience: -10, social: 0, independence: 5  }
            },
        },
    ],
    17: [
        { 
            text: "Your child is invited to a party where you suspect there might be alcohol. Do you let them go or forbid it, knowing they might sneak out?", 
            yes: "You have chosen to let them go to the party.", 
            no: "You have chosen not to let them go.",
            yesLabel: "Let them go",
            noLabel: "Don't let them go",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 5, resilience: -5, social: 5, independence: 5 },
                no: { happiness: -10, resilience: 5, social: -10, independence: 0  }
            },
        },
        { 
            text: "You notice your child doesn't have any real friends to hang out with. They seem at peace with this, but it concerns you. Do you let them be content and alone or force them into social situations with other kids their own age hoping that something sticks?", 
            yes: "You let them be content and alone.", 
            no: "You force them into social situations.",
            yesLabel: "Let them be",
            noLabel: "Force them intoo social situations",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 0, resilience: 0, social: -10, independence: 10 },
                no: { happiness: -5, resilience: 5, social: 5, independence: 0  }
            },
            text: "Your child runs away from home. You go looking for them and find them, but they won't come back home. Do you force them into the car or let them go?", 
            yes: "You forced them in the car when they ran away.", 
            no: "When they ran away you let them go.",
            yesLabel: "Force them into car",
            noLabel: "Let them go",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -10, resilience: 0, social: 0, independence: -10 },
                no: { happiness: -5, resilience: 5, social: 0, independence: 15  }
            },
        },
    ],
    18: [
        { 
            text: "Your child managed to get accepted to an ivy league college. You have no idea how you'll pay for it, but it could really set your child up for success. Do you tell them they should accept it, unsure how you'll pay for it or do you tell them they need to pick a more affordable option.", 
            yes: "You have chosen to send your child to an ivy league college.", 
            no: "You have chosen not to send your child to an ivy league college.",
            yesLabel: "Send to ivy league",
            noLabel: "Don't send to ivy league",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 10, resilience: -5, social: 10, independence: 5 },
                no: { happiness: -15, resilience: 5, social: -5, independence: 0  }
            },
        },
        { 
            text: "Your child asks to take a gap year before starting college. You're worried that the gap year will turn into a them never going to college. Do you allow them to take the gap year or force them to register for college?", 
            yes: "You have chosen to allow them to take a gap year.", 
            no: "You force them to register for college.",
            yesLabel: "Allow gap year",
            noLabel: "Force college registration",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: 10, resilience: -10, social: 0, independence: 10 },
                no: { happiness: -5, resilience: 5, social: 5, independence: 5  }
            },
        },
    ],
};

// Game state
let currentYear = 1;
const choices = [];

// Update UI with the current year and question
function updateQuestion() {
    const yearElement = document.getElementById("year");
    const questionElement = document.getElementById("question-text");
    const yesButton = document.getElementById("yes");
    const noButton = document.getElementById("no");
    
    yearElement.textContent = `Your child is ${currentYear}`;

    // Get a random question for the current year
    const yearQuestions = questions[currentYear];
    const randomIndex = Math.floor(Math.random() * yearQuestions.length);
    const currentQuestion = yearQuestions[randomIndex];

    // Update the question text
    questionElement.textContent = currentQuestion.text;

    // Update the button labels
    yesButton.textContent = currentQuestion.yesLabel || "Yes";
    noButton.textContent = currentQuestion.noLabel || "No";

    // Store the current question effects
    questionElement.dataset.yes = currentQuestion.yes;
    questionElement.dataset.no = currentQuestion.no;
    questionElement.dataset.statAdjustments = JSON.stringify(currentQuestion.statAdjustments);
}

// Starting stats
let stats = {
    happiness: 50,
    resilience: 50,
    social: 50,
    independence: 50
}

// Handle player choices
function handleChoice(choice) {
    const questionElement = document.getElementById("question-text");
    const choiceText = choice === "yes" ? questionElement.dataset.yes : questionElement.dataset.no;

    // Add the choice to the list
    choices.push(choiceText);
    const choiceList = document.getElementById("choices-list");
    const listItem = document.createElement("li");
    listItem.textContent = choiceText;
    choiceList.appendChild(listItem);

    // Adjust stats
    const statAdjustments = JSON.parse(questionElement.dataset.statAdjustments);
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

    function updateStatDisplay(stat) {
        const statElement = document.getElementById(`${stat}-number`);
        statElement.textContent = stats[stat];
    }
}

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
    //const resultText = document.getElementById("final-result");
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
        description = "While happiness isn't everything, you have created an adult who doesn't beleive they deserve to be happy. Despite their other traits, they will forever feel as if they are undeserving of love. This will drive them to seek relationships that reinforce this 'unworthy' self-image, leading to toxic partners, and poor career choices. <br><br>You should have done better.";
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

    // Randomly select a result
    //const result = [
    //    "You are a terrible parent."
    //];
    //resultText.textContent = result[Math.floor(Math.random() * result.length)];
}

// Attach event listeners
document.getElementById("yes").addEventListener("click", () => handleChoice("yes"));
document.getElementById("no").addEventListener("click", () => handleChoice("no"));

// Initialize the game
updateQuestion();

// Restart the game
document.getElementById("restart").addEventListener("click", () => { 
    // Reset game state
    currentYear = 1;
    choices.length = 0; // Clear the choices array
    document.getElementById("choices-list").innerHTML = ""; // Clear the choices list

    // Reset the year display
    document.getElementById("year").textContent = "Year: ${currentYear}";

    // Update the question
    updateQuestion();
    
    // Hide the result block and the restart button
    document.getElementById("result-block").style.display = "none";
    document.getElementById("restart").style.display = "none";

    // Show the question block again
    document.getElementById("question-block").style.display = "block";
    
    // Start the game from the beginning
});
