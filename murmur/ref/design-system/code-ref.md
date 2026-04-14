<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Murmur - The Arrival</title>
<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,700;1,400&amp;family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&amp;family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500;1,6..72,600&amp;family=Public+Sans:wght@300;400;600&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-secondary-fixed-variant": "#5b5972",
                      "tertiary-container": "#ffbe97",
                      "surface-bright": "#292945",
                      "on-secondary-fixed": "#3f3d54",
                      "surface-dim": "#0d0d1a",
                      "on-error-container": "#ff9b82",
                      "on-primary-fixed": "#503a08",
                      "outline-variant": "#454562",
                      "on-primary-fixed-variant": "#6f5623",
                      "on-tertiary-fixed-variant": "#6f4224",
                      "primary-container": "#674f1d",
                      "secondary-container": "#3b3950",
                      "on-primary": "#533d0b",
                      "surface-tint": "#e4c285",
                      "primary-dim": "#d5b478",
                      "on-primary-container": "#ffdfa7",
                      "tertiary-dim": "#efb18a",
                      "on-tertiary-container": "#64391b",
                      "on-background": "#e5e3ff",
                      "surface-container-low": "#121223",
                      "surface-container-lowest": "#000000",
                      "surface-variant": "#23233e",
                      "secondary": "#c7c3e0",
                      "outline": "#737392",
                      "on-surface-variant": "#a9a8ca",
                      "background": "#0d0d1a",
                      "secondary-fixed-dim": "#d5d1ee",
                      "tertiary": "#ffd1b6",
                      "error-dim": "#c44f34",
                      "tertiary-fixed": "#ffbe97",
                      "inverse-on-surface": "#545363",
                      "on-tertiary-fixed": "#4d260a",
                      "primary-fixed": "#fedb9b",
                      "error-container": "#85230a",
                      "secondary-fixed": "#e3dffd",
                      "tertiary-fixed-dim": "#efb18a",
                      "secondary-dim": "#b9b6d2",
                      "primary": "#e4c285",
                      "surface-container-high": "#1d1d34",
                      "on-error": "#450900",
                      "surface-container": "#17182c",
                      "on-surface": "#e5e3ff",
                      "surface": "#0d0d1a",
                      "on-tertiary": "#6e4223",
                      "surface-container-highest": "#23233e",
                      "inverse-primary": "#755b28",
                      "on-secondary-container": "#c0bcd9",
                      "primary-fixed-dim": "#f0cd8f",
                      "on-secondary": "#3f3e55",
                      "inverse-surface": "#fcf8ff",
                      "error": "#f97758"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "fontFamily": {
                      "headline": ["Newsreader", "serif"],
                      "body": ["Public Sans", "sans-serif"],
                      "label": ["Public Sans", "sans-serif"],
                      "literary": ["EB Garamond", "serif"],
                      "classic": ["DM Sans", "sans-serif"]
              }
            },
          },
        }
      </script>
<style>
        .vignette {
            background: radial-gradient(circle, transparent 20%, rgba(7, 7, 15, 0.95) 100%);
        }
        .glowing-ring {
            box-shadow: 0 0 20px 2px rgba(123, 168, 255, 0.4);
        }
        .waveform-bar {
            width: 3px;
            background-color: #c9a96e;
            border-radius: 99px;
        }
      </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-[#07070f] text-[#f0ede6] min-h-screen font-body overflow-hidden selection:bg-primary selection:text-on-primary">
<!-- Background Layer & Vignette -->
<div class="fixed inset-0 z-0">
<div class="absolute inset-0 bg-[#07070f]"></div>
<div class="absolute inset-0 vignette"></div>
</div>
<!-- Main Content Canvas -->
<main class="relative z-10 h-screen flex flex-col justify-between items-center py-8">
<!-- Top Navigation (Shell Implementation) -->
<header class="fixed top-0 w-full flex justify-between items-center px-6 py-4 w-full z-20">
<!-- Close Action -->
<button class="w-10 h-10 flex items-center justify-center text-[#c9a96e] hover:text-primary-fixed-dim transition-colors duration-300">
<span class="material-symbols-outlined text-2xl" data-icon="close">close</span>
</button>
<!-- Story Title Pill -->
<div class="bg-white/5 backdrop-blur-md px-5 py-1.5 rounded-full border border-white/10 shadow-lg">
<span class="font-classic text-[10px] tracking-[0.2em] font-bold text-[#c9a96e] uppercase">The Arrival</span>
</div>
<!-- Progress Dots -->
<div class="flex items-center space-x-2 w-10 justify-end">
<div class="w-1.5 h-1.5 rounded-full bg-[#c9a96e]"></div>
<div class="w-1.5 h-1.5 rounded-full bg-[#c9a96e]"></div>
<div class="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"></div>
<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
<div class="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
</div>
</header>
<!-- Center: Character & Mood Interface -->
<div class="flex-1 flex flex-col items-center justify-center mt-12">
<!-- Portrait Container -->
<div class="relative group">
<div class="absolute inset-0 rounded-full border-2 border-[#7ba8ff]/30 glowing-ring"></div>
<div class="w-[112px] h-[112px] rounded-full overflow-hidden border-2 border-[#7ba8ff] relative">
<img alt="Character Portrait" class="w-full h-full object-cover" data-alt="portrait of a thoughtful young man with soft lighting and deep shadows, cinematic quality, high contrast, dark moody background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWV25Rxx5of2OIgcV3EFqndDPAwP7CCkWs3vZ8YqFVPX9ScAfROkZe1gvfKY8kasdQo5CLdFf13Mrlx0bqTvtbL0y9wQ8norr3PbztPPagyjU3g0XNmadSknT-mz-0KQS-WXA6D_i-ZdWqMgRSJvzXw9i58NpWSyLuLshITyzZxVfmNvhVuRLZ7WJoB1TToS55KluhppVOVgZfLh-yHeYd0frF__c7q1lBqbm1NqcPoeZc9jN9O6C3YzwygLsa_JH1esqbaJ3t7Ng"/>
</div>
</div>
<!-- Emotion Metadata -->
<div class="mt-6 flex flex-col items-center space-y-3">
<span class="font-classic text-[11px] tracking-[0.3em] font-bold text-on-surface-variant uppercase">Curious</span>
<!-- Animated-look Waveform -->
<div class="flex items-end space-x-1 h-5">
<div class="waveform-bar h-2"></div>
<div class="waveform-bar h-4"></div>
<div class="waveform-bar h-5"></div>
<div class="waveform-bar h-3"></div>
<div class="waveform-bar h-4"></div>
</div>
</div>
</div>
<!-- Bottom: Decision Canvas -->
<section class="w-full max-w-md px-6 pb-8 space-y-6">
<!-- Question Prompt -->
<div class="text-center">
<span class="font-classic text-[11px] tracking-[0.2em] font-semibold text-on-surface-variant uppercase opacity-60">What will you do?</span>
</div>
<!-- Choice Buttons Cluster -->
<div class="flex flex-col space-y-3">
<!-- Option 1: Passive/Safe -->
<button class="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl py-5 px-6 text-left transition-all active:scale-[0.98] group">
<p class="font-literary italic text-lg text-[#f0ede6] group-hover:text-white">"Wait for the shadow to speak first."</p>
</button>
<!-- Option 2: Active/Default Selection -->
<button class="w-full relative bg-white/10 backdrop-blur-2xl border border-[#c9a96e] rounded-xl py-5 px-6 text-left transition-all active:scale-[0.98] overflow-hidden">
<div class="flex justify-between items-baseline mb-0.5">
<p class="font-literary italic text-lg text-white">"Reach into the lantern's glow."</p>
<div class="flex items-center space-x-1.5">
<span class="font-classic text-[9px] uppercase tracking-widest text-[#c9a96e] font-bold">5s</span>
</div>
</div>
<p class="font-classic text-[9px] text-[#c9a96e]/70 uppercase tracking-wider">Auto-selecting if no choice</p>
<!-- Progress Countdown Bar -->
<div class="absolute bottom-0 left-0 h-[3px] bg-[#c9a96e] w-2/3"></div>
</button>
<!-- Option 3: Aggressive/Direct -->
<button class="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl py-5 px-6 text-left transition-all active:scale-[0.98] group">
<p class="font-literary italic text-lg text-[#f0ede6] group-hover:text-white">"Demand to know who follows you."</p>
</button>
</div>
</section>
</main>
<!-- Invisible Controls for Screen Readers -->
<nav class="sr-only">
<ul>
<li>Scene Title: The Arrival</li>
<li>Current Emotion: Curious</li>
<li>Remaining time for default choice: 5 seconds</li>
</ul>
</nav>
</body></html>