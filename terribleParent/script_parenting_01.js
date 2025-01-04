// Questions for each year
const questions = {
    1: [
        { text: "Do you want to breastfeed your child?", yes: "You have chosen to breastfeed your child.", no: "You have chosen not to breastfeed your child." },
        { text: "Do you want to use disposable diapers?", yes: "You have chosen to use disposable diapers.", no: "You have chosen not to use disposable diapers." },
        { text: "Do you want to use a pacifier?", yes: "You have chosen to use a pacifier.", no: "You have chosen not to use a pacifier." },
        { text: "Do you want to use a baby monitor?", yes: "You have chosen to use a baby monitor.", no: "You have chosen not to use a baby monitor." },
        { text: "Do you want to use a baby bathtub?", yes: "You have chosen to use a baby bathtub.", no: "You have chosen not to use a baby bathtub." },
        { text: "Do you want to sleep train your baby", yes: "You have chosen to sleep train your baby.", no: "You have chosen not to sleep train your baby." },
        { text: "Your baby cries constantly when you try to sleep-train them, but experts say it’s necessary for their development. Do you comfort them each time or let them cry it out?", yes: "You have chosen to comfort your child when they cry at night.", no: "You have chosen not to comfort your baby when they cry at night." },
        { text: "Your baby forms a deep attachment to a relative who belittles your parenting. Do you sever the connection to protect yourself or let it continue for your child’s bond?", yes: "You have chosen to break off communication with your child's favorite relative.", no: "You have chosen not to break off communication with your child's favorite relative." },
        { text: "Your toddler cries every morning when dropped off at daycare, but quitting work would bankrupt your family. Do you keep sending them or risk financial ruin?", yes: "You keep sending them to daycare despite their constant crying ", no: "You have chosen to remove them from daycare and raise them at home, despite the financial state it puts your family in." },
    ],
    2: [
        { text: "Do you want to send your child to a private daycare?", yes: "You have chosen to send your child to a private daycare.", no: "You have chosen not to send your baby to a private daycare." },
        { text: "Do you want to give you child peanut butter?", yes: "You have chosen to give your child peanut butter.", no: "You have chosen not to give your child peanut butter." },
    ],
    3: [
        { text: "Your child bites another at daycare. Do you discipline harshly to prevent it from happening again or forgive, knowing they’re still learning?", yes: "You have chosen to discipline your child harshly over bitting another child.", no: "You have chosen not to discipline your child over biting another child." },
        { text: "They show no interest in potty training, but your peers criticize you for delaying. Do you pressure them to meet societal expectations or wait until they’re ready?", yes: "You have chosen to pressure your child into potty training.", no: "You have chosen not to pressure your child into potty training." },
    ],
    4: [
        { text: "Your child loves performing but freezes during a recital. Do you force them to stick with it, despite them wanting to quit or let them quit to avoid their discomfort?", yes: "You have chosen to force your child to continue performing, despite their discomfort.", no: "You have chosen to let your child drop out of performing." },

    ],
    5: [
        { text: "Your child asks if Santa is real. Do you continue the fantasy telling them he is or do you tell them the truth, knowing you're taking some of the magic out of the world for them?", yes: "You have chosen to continue the fantasy that Santa is real.", no: "You have chosen to tell them the truth that Santa isn't real." },
    ],
    6: [
        { text: "Your child steals a small toy and seems proud. Do you confront them directly or wait to address it gently?", yes: "You have chosen to confront them directly, making an example out of them.", no: "You have chosen to address it later, when they can better process what they've done." },
    ],
    7: [
        { text: "They struggle with math and fall behind their class. Do you enforce extra practice or let them focus on their strengths?", yes: "You enforce extra practice.", no: "You have chosen to let them practice on their strengths." },    ],
    8: [
        { text: "Their coach benches them unfairly. Do you confront the coach or teach your child to endure?", yes: "You confront the coach directly.", no: "You don't confront the coach." },
        { text: "You need to move out of the place you live because the neighborhood is horrible. However, your child has been accepted into a special accelerated program at school. Do you stick it out and stay in the sketchy neighborhood or do you move knowing that the new school doesn't have any such program?", yes: "You stick it out and stay in the horrible area so your child can go to the better school.", no: "You move to the better neighborhood knowing that your child will not be able to attend the special program." },
    ],
    9: [
        { text: "They tell you they hate a teacher who’s strict but highly effective. Do you request a transfer or teach them resilience?", yes: "You have chosen to transfer your child to a teacher who is less strict, making your child happier.", no: "You have chosen to leave your child in the class with the strict teacher." },
    ],
    10: [
        { text: "They ask you to stop attending their games or events because it makes them nervous. Do you respect their wishes or insist on being there for support?", yes: "You have chosen to no longer attend their games, instead you drop them off and wait in the car to pick them up.", no: "You have chosen keep coming to the games, despite their nervousness." },
        { text: "Your child is being bullied by some kids at their school through social media. You talk to the parents, but they blame your child. Do you take the high road and use this as a teaching moment or do you retaliate, showing your child how to stand up for themselves?", yes: "You have chosen to take the high road and hope your child will learn from your example.", no: "You have confront the parents and school directly bringing the wrait of god down upon them." },
    ],
    11: [
        { text: "They find a stray animal and beg to keep it, despite your lack of resources. Do you let them bring it home or teach them the limits of compassion?", yes: "You have chosen to let them keep the animal, despite the financial burden.", no: "You don't allow them to keep the pet and instead take them to the shelter to drop off the pet." },
    ],
    12: [
        { text: "Your child wants to spend hours playing video games, claiming it helps them make friends. Do you set strict limits or let them bond their way?", yes: "You have chosen to set strict limits on their gaming time.", no: "You have chosen to let them balance their own time with gaming." },
    ],
    13: [
        { text: "Your child struggles with body image and asks to start a diet. Do you support their initiative or reassure them to embrace who they are?", yes: "You have support their diet.", no: "You tell them you aren't supporting their diet." },
    ],
    14: [
        { text: "Your child says they identify as a gender other than how they were born. Do you allow for them to start hormone treatment to begin the transition process?", yes: "You have chosen to allow them to start the hormone treatment.", no: "You have chosen not to let them start the hormone treatment." },
    ],
    15: [
        { text: "They start a relationship with someone who has drastically different values. Do you support them or voice your concerns?", yes: "You have chosen to support their dating choice.", no: "You do not support their choice in dating and tell them as such." },
    ],
    16: [
        { text: "Your child has just turned 16 and is really excited to start driving. Do you get them a car, knowing having an extra driver in the family will be helpful, despite the financial burden or do you put it on them as an adulting lesson to take care of it themselves? ", yes: "You have chosen to get them a car.", no: "You have chosen not to get them a car." },
    ],
    17: [
        { text: "Your child is invited to a party where you suspect there might be alcohol. Do you let them go or forbid it, knowing they might sneak out?", yes: "You have chosen to let them go to the party.", no: "You have chosen not to let them go." },
        { text: "You notice your child doesn't have any real friends to hang out with. They seem at peace with this, but it concerns you. Do you let them be content and alone or force them into social situations with other kids their own age hoping that something sticks?", yes: "You let them be content and alone.", no: "You force them into social situations." },
    ],
    18: [
        { text: "Your child managed to get accepted to an ivy league college. You have no idea how you'll pay for it, but it could really set your child up for success. Do you tell them they should accept it, unsure how you'll pay for it or do you tell them they need to pick a more affordable option.", yes: "You have chosen to send your child to an ivy league college.", no: "You have chosen not to send your child to an ivy league college." },
    ],
    // Add more questions to get to 18 years old.
};

// Game state
let currentYear = 1;
const choices = [];

// Update UI with the current year and question
function updateQuestion() {
    const yearElement = document.getElementById("year");
    const questionElement = document.getElementById("question-text");
    
    yearElement.textContent = `Year ${currentYear}`;

    // Get a random question for the current year
    const yearQuestions = questions[currentYear];
    const randomIndex = Math.floor(Math.random() * yearQuestions.length);
    const currentQuestion = yearQuestions[randomIndex];

    // Update the question text
    questionElement.textContent = currentQuestion.text;

    // Store the current question effects
    questionElement.dataset.yes = currentQuestion.yes;
    questionElement.dataset.no = currentQuestion.no;
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

    // Move to the next year
    currentYear++;
    if (currentYear > 18) {
        endGame();
    } else {
        updateQuestion();
    }
}

// End the game and display the result
function endGame() {
    const questionBlock = document.getElementById("question-block");
    const resultBlock = document.getElementById("result-block");
    const resultText = document.getElementById("final-result");
    const restartButton = document.getElementById("restart");

    // Hide the question block and show the result block
    questionBlock.style.display = "none";
    resultBlock.style.display = "block";
    restartButton.style.display = "block";

    // Randomly select a result
    const result = [
        "You are a terrible parent."
    ];
    resultText.textContent = result[Math.floor(Math.random() * result.length)];
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
