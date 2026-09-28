# Grasping Hand

A Foundry VTT module that adds a bit of theatre to initiative. A hand reaches up into the
**Carousel Combat Tracker**, grabs a combatant's card, and drags it to the front of the
initiative order. Every connected player sees it happen.

## Requirements

- Foundry VTT v12 or newer
- [Carousel Combat Tracker](https://foundryvtt.com/packages/combat-tracker-dock). Without it the
  initiative change still happens, but there's no animation.

## Installation

In Foundry's **Add-on Modules** tab, choose **Install Module** and paste this manifest URL:

```
https://github.com/suideDev/oldHand/releases/latest/download/module.json
```

## Usage

The first time a GM loads a world with the module enabled, it creates a **Cut in Line** macro
in the first empty hotbar slot. Press that slot's number key during combat to trigger the grab.

By default the macro moves the combatant whose token is selected. To always move the same
combatant, edit the macro and put their name between the quotes:

```js
const NAME = "Combatant Name";
```

"The front" means right before whoever is about to act:

- **At the start of a round:** the combatant becomes first in the order.
- **Mid-round:** the combatant cuts in ahead of the current turn and acts immediately.

If the macro gets deleted, run `game.modules.get("grasping-hand").api.createMacro()` in the
browser console (F12) to recreate it.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Hand color | 35 | 0 is black and white, 100 is full skin tone. |
| Peace sign | Off | After setting the card down, the hand throws up a peace sign before it leaves. |
| Sound effect | None | Optional sound played for everyone when the hand appears. |

## Notes

- If the carousel hides enemies until their first turn, players can't see that card until it
  has acted once, so they won't see a grab in the first round.
- Cutting in mid-round can give a decimal initiative (e.g. 14.5) so the combatant fits between
  two others.
