# Grasping Hand

An old hand reaches up into the **Carousel Combat Tracker**, grabs a combatant's card,
and drags it to the front of the initiative order. Everyone at the table sees it.

## Using it

The first time you load a world with the module enabled, it creates a **Cut in Line** macro
and puts it in the first empty slot of your hotbar. Press that slot's number key to use it.

The macro grabs whichever token you have selected. To always grab the same NPC, edit the macro
and put his name between the quotes:

```js
const NAME = "Old Man";
```

"The front" means right before whoever is about to act:

- **At the start of a round:** he becomes first in the order.
- **Mid-round:** he cuts in right before the current combatant and takes his turn immediately.

Deleted the macro? Run `game.modules.get("grasping-hand").api.createMacro()` in the console (F12)
to get it back.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Hand color | 35 | 0 is black and white, 100 is the photo's full skin tone. |
| Peace sign | Off | After setting the card down, the hand throws up a peace sign before it leaves. |
| Sound effect | none | Optional sound played for everyone when the hand appears. |

## Notes

- If the carousel is set to hide enemies until their first turn, players can't see his card
  until he has acted once, so they won't see the grab in round 1.
- Mid-round cuts can give him a decimal initiative (e.g. 14.5) so he fits between two combatants.
- `images/hand.webp` is cut from a licensed stock photo. Don't publish it in a public repository.
- `images/peace.webp` is from a free pngtree.com image. Free pngtree images usually require credit, so check their license terms.
