# The "Gauntlet Loop": An AI Build-and-Critique Method, Not a Call of Duty Player Loop

The "Gauntlet Loop" is not a Call of Duty mode or an established game-design term. It is an AI-agent development workflow that AI investor Matt Shumer named in July 2026, after he used it to have Claude Opus 5 generate "Claude of Duty," a Call of Duty-style browser shooter. That makes it a production-pipeline pattern you can build into your tools, not a player-facing core loop.

## Paste-ready paragraph

> The "Gauntlet Loop" is not a Call of Duty game mode or a player-facing core loop. It is an AI-agent development method that Matt Shumer named in July 2026, after using it to have Claude Opus 5 generate "Claude of Duty," a browser FPS of about 55,000 lines written in Three.js. Here is how it works. A lead agent gets a goal plus a concrete quality bar (for Claude of Duty, real Call of Duty screenshots). It splits the work into the smallest pieces that can be judged separately and gives each piece a builder agent and a separate critic agent with fresh context. The critic inspects the real output, compares it blind against the reference, names the biggest gap and sends the work back. The loop repeats until the work wins or a human stops it. For our software, we should build in: reference bars the critic can inspect, isolated blind critics, a keep-the-best "ratchet," a live progress page, and hard budget and stop limits.

## TL;DR

- "Gauntlet Loop" is a new community term from AI development, coined by Matt Shumer on July 27, 2026. It is not a CoD feature or a recognized game-design term. It became famous through "Claude of Duty," the AI-generated CoD-style game Shumer says drew 3.8M views on X; Enterprise DNA reported its repo "hit 1,547 stars and 253 forks" within three days.
- The core loop has five steps: a real reference bar, the agent's own decomposition of the work, a separate builder and blind critic for each piece, iteration with no fixed round cap, and a human acting as the brake. It is a named form of the "Orchestrator-workers" and "Evaluator-optimizer" patterns from Anthropic's "Building Effective Agents" (Erik Schluntz and Barry Zhang, December 19, 2024).
- Build it in as a polish-and-QA pipeline for content that already has a direction, not as a generator that builds things from nothing. Its quality depends entirely on the reference corpus, and uncapped runs get expensive: Pieter Levels reported $500 and then $900, and developer reports collected by Stork.AI put a Gauntlet-built F1 game at about $1,200 and a GTA-style attempt at $1,700.

## Key Findings

**What the term actually refers to.** Shumer posted the game on July 25, 2026 with the claim "Claude Opus 5 one-shotted this game." The next day he corrected himself: "Zero-shot** not one-shot lol whoops." On July 27 he asked followers to suggest a name and two hours later wrote "I'm officially calling this the Gauntlet Loop," publishing a how-to guide the same evening. His guide sums the method up as: "Give the agent a bar it can't talk its way around, let it split the work, and never let the builder grade itself."

**The loop, step by step** (from Shumer's guide):
1. **Goal, not implementation.** His original prompt, published verbatim as `prompt.md`, is short: about 130 words by Regen Raygun's count, though one GitHub skill repo calls it "the 152-word Call of Duty prompt." It asked for a shooter "at the level of the most recent Call of Duty games" and did not specify any architecture.
2. **A real bar.** "'Make it amazing' is not a bar." For the game, the bar was actual CoD screenshots. Shumer says the bar does not need to be reachable; its job is to stop the agent from settling for "pretty good for AI."
3. **The agent splits the work.** For example, the gun, hands, trees, lighting, movement, enemy behavior and sound can each get their own loop.
4. **The builder never grades itself.** A fresh critic gets the goal, the bar and the actual artifact, but not the builder's reasoning. It acts "almost like an A/B tester," picking blind between our output and the reference.
5. **Keep looping.** There is no fixed final round. You stop when the gains get too small or the budget runs out. Shumer also recommends a live HTML progress page and an optional "smoothing pass" to make parallel work consistent.

**Why it works.** An agent that grades its own output defines "good" down until its work qualifies. An external reference combined with a blind, fresh-context critic removes that self-judgment. In the language of game-design retention, the "reward" is a ratchet: the best version so far is kept and replaced only when a challenger wins head-to-head, so the work only ever moves forward.

## Details

**What Claude of Duty actually achieved.** According to its repository README, the game is about 55,000 lines across 11 subsystems, and every texture, mesh, animation and sound is generated procedurally. Its own critics scored it 3.59 → 4.14 → 4.05 → 5.05 out of 10, and "every critic in every round picked the real Call of Duty frame." It runs at 28–30 fps on a Retina display. In other words, the loop did not match AAA quality. What it did was measure the gap honestly in every round.

**A key engineering lesson.** The README reports that parallel fan-out (six agents, each owning one directory) improved the score by only +0.46 and pushed frame-ruining defects up (60 → 47 → 66). The cause was that tonemapping, sky and indirect light form one coupled system. A sequential pass with a single owner per coupled concern improved the score by +1.00 and cut defects from 66 to 26. Split the work along boundaries that are truly independent.

**Cost and failure reports.** Pieter Levels (@levelsio) said he ended up with "a total mess and chaos of unperformant code" and burned $500, later revising that to $900 and saying he "had to remove 95%." A Better Stack F1 game called "Apex GP" was reported at about $1,200. Julian Goldie's AI Success Lab write-up says "the loop ran 19 hours, spawned 137 sub-agents and used 1.7 billion tokens," and that "a longer follow-up run went 34 hours and 251 sub-agents." The game's repository description, however, says "137 agents, 22M tokens, 10 rounds." The 22M figure cannot account for a $1,200 bill, so it probably counts only some tokens; treat it as unresolved. Separately, a builder posting as GREGORY (@MrInReality1) self-reported "51.3 hours, 996 agents and 264,200,000 tokens" for "DeCarlo Boyz," an open-world GTA-style game set in Pittsburgh that he describes as still a work in progress (per Jon Jordan at Regen Raygun).

**Where it works and where it fails.** WotAI ran the method four times and concluded it is "a polish amplifier, not a zero-to-one generator." All four of its runs on existing products converged in under a day. Its single biggest predictor of success was whether the critic had real material to inspect. A daily.dev write-up notes that the method breaks down for novel work, such as custom business logic, where no finished reference exists and the critic ends up inventing its own standard. Decrypt also warns that FPS code is heavily represented in training data, so "built from scratch" claims deserve skepticism.

**Not to be confused with CoD "Gauntlet" modes.** Call of Duty has real Gauntlet modes, and these are the closest player-facing concept:
- *Black Ops 4* Zombies Gauntlet (2019): 30 rounds, each with its own rule. Failing a round earns a strike, three strikes ends the run, and rewards come at rounds 10, 20 and 30.
- *Black Ops 7* Gauntlet (2026): a 6v6 match that rotates through five modes every two minutes, up to 150 points.
- Warzone's Iron Gauntlet: a harder competitive battle royale.
- MW4's Gauntlet 1v1: a winner-stays wager mode.

If you meant an in-game escalating-challenge loop, the BO4 structure (escalating rules, a strike budget, milestone rewards, a full reset) is the model to study. It has nothing to do with Shumer's term.

## Recommendations

- **Build it as a pipeline feature, not a game feature.** Give your tool a reference library for each content type, a critic that runs in an isolated context and never sees the builder's notes, blind A/B judging, a version ratchet, a live status page, and hard caps on money, time and rounds.
- **For narrative content, curate reference corpora.** Shumer suggests using exemplary paragraphs as the bar for writing. One playbook adds that you should choose recent, less famous work so the model cannot recognize the reference and break the blind test. Use separate critics for distinct concerns such as voice, clarity and continuity, followed by one integration critic.
- **Anchor before you amplify.** Supply an architecture or style contract and a starting point that already has the right direction. Do not point the loop at a blank page.
- **Pilot on one shipped surface**, such as a dialogue set or a UI screen, and budget for the cost before scaling.

## Caveats

- The term is about four months old and comes from social media. Most coverage is blogs, newsletters and X posts rather than peer-reviewed or studio sources, and many cost and agent-count figures are self-reported.
- Shumer has not published his token count or spend for Claude of Duty; Regen Raygun notes he "hasn't disclosed the cost of the Gauntlet Loop, either in tokens or dollars," even though his guide recommends the "ultracode" setting, which "costs much more."
- Your phrase "game generations like Claude of Duty" most likely means AI-generated games. If you actually meant a CoD-style player loop, the term does not apply, and the CoD Gauntlet modes above are the relevant reference.