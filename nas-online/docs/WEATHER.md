# How the weather works

All numbers live in `js/fx/weather-director.js`. Change them there; this page explains what
they mean.

## The day

One in-game day is **5 minutes**: 3 min of daylight, then 2 min of night (`DAY_S`, `NIGHT_S`
in `js/fx/night.js`). At the start of every day, and when the page loads, the game draws
**one forecast** for that whole day. Sleeping through the night skips to the next morning,
which also draws a new forecast.

## The forecasts

`w` is the relative chance of that forecast on any day.

| Forecast | `w` | Chance | Temp (day) | What happens |
|---|---|---|---|---|
| Clear and calm | 32 | 32% | −18 °C | Light air all day. |
| Bright, blinding midday | 26 | 26% | −14 °C | Calm. A 40–90 s blinding glare stretch around midday. |
| Breezy | 22 | 22% | −22 °C | Steady wind of about 0.5, with gust fronts every 8–14 s. |
| Overcast, light snow | 13 | 13% | −15 °C | Low wind, snow falling, a slight haze. |
| Storm at dusk | 5 | 5% | −20 °C | Calm day. The wind builds 40–60 s before dusk, the storm rolls in around dusk, peaks in the early night, and is gone before dawn. |
| Blizzard all day | 2 | 2% | −28 °C | Full storm, whiteout, all day. |

Storm days together are about **7%**: roughly one day in fourteen, or about one storm per hour
of play.

Two rules sit on top of the chances:
- **The first day is never a storm.**
- **There are never two storm days in a row.** The day after a storm is always calm, breezy or
  overcast.

To make storms rarer or commoner, change the two `w` numbers for `eveningStorm` and
`blizzard`.

## What a forecast is made of: spells

A forecast plays out as one or more **spells**: target values the weather eases toward.

| Spell | Wind | Snowfall | Whiteout | Gusts every |
|---|---|---|---|---|
| still | 0.06–0.16 | 0.06–0.16 | 0 | 25–45 s |
| breezy | 0.42–0.56 | 0.22–0.34 | 0.06 | 8–14 s |
| overcast | 0.18–0.28 | 0.42–0.56 | 0.12 | 18–30 s |
| build | 0.4–0.55 | 0.3–0.5 | 0 | 9–14 s |
| stormIn | 0.9–1 | 0.9–1 | 0.96 | 3–5 s |
| storm | 0.88–1 | 0.9–1 | 0.98 | 3–6 s |
| clear (after a storm) | 0.45–0.6 | 0.3–0.45 | 0 | 6–10 s |
| blizzard | 0.85–1 | 0.9–1 | 0.92 | 3–6 s |

How the forecasts use them:
- **Clear and bright days** are `still` all day.
- **Breezy, overcast and blizzard days** hold their own spell all day.
- **Storm at dusk** steps through `still` → `build` → `stormIn` → `storm` → `clear` → `still`.

Within a spell the values breathe slowly, by about ±0.06, so nothing is ever perfectly static.
The wind direction wanders slowly around its base direction.

**Gust fronts** are real lines of stronger wind that cross the map downwind. You see the wave of
blowing snow before it reaches you. How often they come is the "Gusts every" column, and their
strength grows with the wind.

## Temperature

Temperature = the forecast's day temperature − 15 °C at full night − 12 °C × wind.

For example, a clear night is about −33 °C. A blizzard night is about −55 °C.

How cold the explorer feels (`weather.cold`, 0–1) rises from −10 °C to −45 °C. It drives frost,
breath, shivering and how fast warmth drains.

## The edge of the map

Separately from all of the above, walking into the border band at the map's edge ramps the
weather up to a full whiteout, with the wind blowing you back toward the middle. It only exists
to turn players back. You never see it from the safe area.

## Testing it

- **Gear menu → Weather:** force any forecast right now. The body readout shows today's forecast
  and the current spell.
- **URL:**
  - `?forecast=blizzard` (or `clear`, `bright`, `breezy`, `overcast`, `eveningStorm`) forces one.
  - `?weather=calm` / `wind` / `storm` holds a single spell for captures.
- **The browser console** logs `[weather] today's forecast: …` every day.
