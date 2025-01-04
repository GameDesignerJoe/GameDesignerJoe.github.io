const newLocal = "They find a stray animal and beg to keep it, despite their lack of experience and your lack of resources. Do you let them bring it home or teach them the limits of compassion?";
// Questions for each year
const questions = {
    1: [
        { 
            text: "Do you want to breastfeed your child?", 
            yes: "You have chosen to breastfeed your child. Of course you have. It's the best thing for them.", 
            no: "You have chosen not to breastfeed your child and instead give them formula. It's more convenient for you and you're not sure if it really makes a difference.",
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
            yes: "While it might be better for the environment to use cloth diapers, the mess is just too much for you.", 
            no: "You use cloth diapers, despite the mess. On the plus side, you're helping the environment.", 
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
            yes: "You use a pacifier.", 
            no: "You decide to tough it out and use a pacifier.",
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
            yes: "Screw what the experts say, you know your child. When it cries you comfort them... always.", 
            no: "You swallow your own pain and decide not to comfort your baby when they cry at night, hoping that the short term pain will teach them to sooth themselves.",
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
            yes: "You kept your child in the private daycare even if the kid doesn't like it, hoping that they'll benefit in the long run from the better education and environment.", 
            no: "You decided to pull your child out of the private daycare and sent them to a public one. They enjoy it more, but you will always wonder if they're missing out.",
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
            yes: "You get your child a NERF gun, knowing it's just a toy, even though you're secretly bothered by them running around 'shooting' people in the face with it.", 
            no: "You didn't get the NERF gun your child wanted. They're too young and you're not a fan of them playing with guns at any age.",
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
            yes: "You told the difficult relative that they can no longer be around you and your child, despite them being your child's favorite. They'll get over it eventually.", 
            no: "You keep the difficult relative in your life and just swallow you tongue whenever they open their mouth. Your kid is happy at least.",
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
            yes: "You keep sending them to daycare despite their constant crying. They need to grow up and get used to it.", 
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
            yes: "You discipline your child harshly over bitting another child - zero tolerance for assaulting another child.", 
            no: "When your child bit another child, you forgave them, knowing they're still learning. Fingers crossed it doesn't become a habit.",
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
            yes: "You continue with the potty training, even though your kid is actively fighting you. At this age they need to figure it out.", 
            no: "You backed off of potty training, which at this age means it'll make for some awkward situations, but your child will figure it out... eventually.",
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
            yes: "Despite you kid wanting to not perform anymore, you keep them in the program. They'll eventually get over it and be stronger because of it.", 
            no: "When your child wanted to drop out of performing, you let them. They'll find something else they love.",
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
            yes: "You decided to get rid of the jeans and tell them not to worry about it.", 
            no: "You decided to talk to them about body image, but at this age, you're not sure how much of it really will stick.",
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
            yes: "When asked if Stanta was real, you told them he was.", 
            no: "You told your child the truth about Santa, knowing that you were taking some of the magic out of the world for them.",
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
            yes: "When your child tried to steal a toy, you walked them over to the store manager and made them return it.", 
            no: "When your child tried to steal a toy, you waited until you got home to address it gently.",
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
            yes: "Your child is struggling with math, so you enforce extra practice.", 
            no: "Your child is struggling with math, so you let them take the poorer grade and instead focus on their strengths.",
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
            yes: "A coach benched your child unfairly, so you confronted the coach. It didn't change anything, but at least your kid saw you fight for them.", 
            no: "A coach benched your child unfairly. When your kid looked to you for help, you told them to endure - it happens sometimes.",
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
            yes: "You stick it out in the worse neighborhood so your child can go to the better school.", 
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
            yes: "You moved your kid out of the overly strict teacher, making your child happier.", 
            no: "You kept your child in the class with the strict teacher. Better for them to figure out how to deal with it now.",
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
            yes: "You no longer attend their sporting games because they asked you not to. Instead you drop them off and wait in the car to pick them up.", 
            no: "You keep coming to the games, despite their nervousness.",
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
            yes: "You kid is being bullied and rather than retailiate, you have chosen to take the high road and hope your child will learn from your example.", 
            no: "You confronted the parents and school directly bringing the wraith of god down upon them. It escilates to the point of near volience on your part.",
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
            text: newLocal, 
            yes: "When your child brought home a stray, you let them keep the animal, despite the financial burden.", 
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
            yes: "Despite your child saying that gaming helps them make friends, you have set strict  on their gaming time.", 
            no: "While they might be gaming too much, at least your child is doing it with other kids.",
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
            yes: "Your child wants to start a diet and you support their decision.", 
            no: "Your child wants to start a diet, but you don't support their decision. They need to be eating healthy, but not dieting.",
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
            yes: "When your child threw a tantrum at dinner, you grounded them. They are much too old to behave like that.", 
            no: "When your child threw a tantrum at dinner, you let them eat what they wanted. You remeber what being a teenager was like.",
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
            yes: "Your child came to you and said they identify as a gender other than how they were born. While confusing and difficult for you, you allow them start the hormone treatment.", 
            no: "Your child came to you and said they identify as a gender other than how they were born. While this may eventually be their choice, for now you feel they are too young to truly know their body and you don't allow the hormone treatment.",
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
            yes: "Your child brings home a partner who has drastically different values. While you don't agree with them, you support your child's decision.", 
            no: "Your child brings home a partner who has drastically different values. You voice your concerns and tell your child that they can't see that person anymore.",
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
            yes: "You forced your kid to buckle down and study for their driving test. Not driving is not an option.", 
            no: "You let your child decide when or if they ever want to drive. It would be nice to have another driver in the family, but if they don't want to do it, who are you to force them to?",
            yesLabel: "Study and drive",
            noLabel: "Let them decide",
            statAdjustments: {
                /* happiness - resilience - social - independence */
                yes: { happiness: -5, resilience: 5, social: 5, independence: 5 },
                no: { happiness: 5, resilience: -10, social: -5, independence: -5  }
            },
        },
        { 
            text: "Your child is seeing a therapist because you're concerned about their mental health. However, the therapist says that your child doesn't think they have a problem. The therapist says they can't treat someone who doesn't think there's anything wrong with them. Do you find a new therapist or do you let them stop going?", 
            yes: "You chose to find a new therapist for your child, despite them saying they don't think they need one.", 
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
            yes: "You let your child go to the party, despite your concerns about alcohol. They'll have to learn at some point.", 
            no: "You don't let your child go to the party. You're not sure if there will be alcohol there, but you're not willing to take the risk. It's not them you don't trust, it's the other kids.",
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
            yes: "Your child seems to perfer to be alone and you don't make a big deal out of it.", 
            no: "Your child seems to prefer to be alone, but you force them into social situations with other kids their own age. The world is a social place and they need to learn how to interact with others.",
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
            yes: "When your child got into an ivy league college, you decided to send them. That's what second mortgages are for after all.", 
            no: "When your child got into an ivy league college, you decided to tell them they needed to pick a more affordable option. Student loans stick with you for life.",
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
            yes: "Your child wanted to take a gap year before starting college and you allowed it. Let's hope it's not a gap life.", 
            no: "Your child wanted to take a gap year before starting college, but you forced them to register for college. They'll thank you later.",
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

// Arrays for each age range
const choicesBabyToddler = [];
const choicesElementary = [];    
const choicesMiddle = [];
const choicesHighschool = [];

function updateStatDisplay(stat) {
    console.log('Updating stats: ${stat}');
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
    const choiceText = choice === "yes" ? questionElement.dataset.yes : questionElement.dataset.no;

    if (currentYear >= 1 && currentYear <= 4) {
        document.getElementById("group-baby-toddler").style.display = "block";
        choicesBabyToddler.push(choiceText);
        document.getElementById("choices-baby-toddler").textContent = choicesBabyToddler.join(" ");
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

/*  Not sure if I need this anymore.
    // Add the choice to the list
    choices.push(choiceText);

    // Update the paragraph with all choices as a single string
    const choiceList = document.getElementById("choices-list");
    choiceList.textContent = choices.join(" ");
*/
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
    console.log("Restarting the game...");

    // Ensure updateStatDisplay is exits
    if (typeof updateStatDisplay !== "function") {
        console.error("updateStatDisplay is not defined.");
        return;
    }

    // Reset game state
    currentYear = 1; // Reset the year
    choicesBabyToddler.length = 0; // Clear the choices array
    choicesElementary.length = 0; // Clear the choices array
    choicesMiddle.length = 0; // Clear the choices array
    choicesHighschool.length = 0; // Clear the choices array

    // Reset displayed stats
    for (let stat in stats) {
        stats[stat] = 50; // Reset each stat to default
        updateStatDisplay(stat); // Update the displayed stats
    }
    
    // Reset the year display
    document.getElementById("year").textContent = "Year: ${currentYear}";

    // Clear all choice blocks
    document.getElementById("group-baby-toddler").textContent = "";
    document.getElementById("group-elementary").textContent = "";
    document.getElementById("group-middle").textContent = "";
    document.getElementById("group-highschool").textContent = "";

    // Hide the result block and the restart button
    document.getElementById("result-block").style.display = "none";
    document.getElementById("restart").style.display = "none";
    
    // Show the question block again
     document.getElementById("question-block").style.display = "block";
   
    // Update the question
    updateQuestion();
   
    //choices.length = 0; // Clear the choices array
    //document.getElementById("choices-list").innerHTML = ""; // Clear the choices list
    
    // Hide the result block and the restart button
    //document.getElementById("result-block").style.display = "none";
    //document.getElementById("restart").style.display = "none";

    
    // Start the game from the beginning
});