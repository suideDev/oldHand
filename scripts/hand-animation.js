// The grasping hand animation. Plain DOM + Web Animations only (no Foundry APIs),
// so it can be previewed outside of Foundry.

// Default hand image, resolved relative to this file so it works in Foundry and in the demo.
export const HAND_IMAGE = new URL("../images/hand.webp", import.meta.url).href;
export const PEACE_IMAGE = new URL("../images/peace.webp", import.meta.url).href;

// The image has the arm at the top and fingers pointing down; it's shown turned upside down so the
// hand reaches up from below. These are fractions of the image's width/height *as shown*.
const FINGERS_CENTER_X = 0.37;
const FINGERTIPS_Y = 0.01;
const IMAGE_ASPECT = 1287 / 520; // height / width

// How big the hand is compared to the card, and how far up the card the fingertips reach.
const HAND_TO_CARD_WIDTH = 1.05;
const GRIP_Y = 0.68;

// Peace-sign hand (fingers already point up): where the V is, and how it sits under the card.
const PEACE_CENTER_X = 0.42;
const PEACE_ASPECT = 391 / 170; // height / width
const PEACE_TO_CARD_WIDTH = 0.95;
const PEACE_TIPS_Y = 0.97; // fingertips just touch the bottom of the card
const PEACE_HOLD = 1100;

export const TIMING = {
    descend: 950,
    grip: 280,
    lift: 320,
    carry: 1000,
    drop: 240,
    retreat: 750,
};

// Time from the start of the animation until the card has been set down.
export const RELEASE_MS = TIMING.descend + TIMING.grip + TIMING.lift + TIMING.carry + TIMING.drop;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadImage(src, color) {
    const img = new Image();
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.style.filter = `grayscale(${1 - Math.min(Math.max(color, 0), 1)}) contrast(1.06)`;
    await img.decode().catch(() => {});
    return img;
}

function div(className, parent) {
    const el = document.createElement("div");
    el.className = className;
    parent?.append(el);
    return el;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function dustPuff(layer, x, y, count = 16) {
    for (let i = 0; i < count; i++) {
        const puff = div("grasping-hand-dust", layer);
        puff.style.left = `${x + (Math.random() - 0.5) * 50}px`;
        puff.style.top = `${y - Math.random() * 8}px`;
        const side = i % 2 ? 1 : -1;
        const dx = side * (30 + Math.random() * 90);
        const dy = -(Math.random() * 40);
        const size = 0.6 + Math.random() * 0.8;
        puff.animate(
            [
                { transform: `translate(0, 0) scale(${size * 0.4})`, opacity: 0.8 },
                { transform: `translate(${dx}px, ${dy}px) scale(${size * 1.8})`, opacity: 0 },
            ],
            { duration: 700 + Math.random() * 600, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" },
        ).finished.then(() => puff.remove());
    }
}

// ---------------------------------------------------------------------------
// Main sequence
// ---------------------------------------------------------------------------

/**
 * Play the grab animation.
 * @param {HTMLElement} card    The card to take.
 * @param {HTMLElement} target  The card whose spot it gets set down on.
 * @param {object} [options]
 * @param {Promise} [options.hold]   Resolves once the real tracker has re-sorted; the ghost card stays until then.
 * @param {string}  [options.scope]  Class to wrap the ghost in so the tracker's scoped CSS still applies to it.
 * @param {string}  [options.image]  Hand image URL (arm at the top, fingers pointing down).
 * @param {number}  [options.color]  0 = black and white, 1 = full color.
 * @param {boolean} [options.peace]  Flash a peace sign after setting the card down.
 * @returns {Promise<boolean>} false if the cards aren't visible on this screen.
 */
export async function playGrab(card, target, { hold = Promise.resolve(), scope = "combat-dock", image = HAND_IMAGE, color = 0.35, peace = false } = {}) {
    // Load the images before anything appears so the hand doesn't pop in half-drawn.
    const [img, peaceImg] = await Promise.all([loadImage(image, color), peace ? loadImage(PEACE_IMAGE, color) : null]);

    const from = card.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) return false;

    const layer = div("grasping-hand-layer", document.body);
    const vignette = div("grasping-hand-vignette", layer);
    vignette.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" });

    // The rig carries the ghost card and the hand together, pivoting where the hand holds the card.
    const rig = div("grasping-hand-rig", layer);
    Object.assign(rig.style, {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        transformOrigin: `50% ${GRIP_Y * 100}%`,
    });

    const scopeEl = div(`${scope} grasping-hand-scope`, rig);
    const ghost = card.cloneNode(true);
    ghost.removeAttribute("data-tooltip");
    ghost.classList.remove("hovered");
    ghost.classList.add("grasping-hand-ghost");
    Object.assign(ghost.style, { width: `${from.width}px`, height: `${from.height}px`, margin: "0", visibility: "hidden" });
    scopeEl.append(ghost);

    // A card-sized hand whose fingertips reach up over the bottom third of the card.
    const handW = Math.max(from.width * HAND_TO_CARD_WIDTH, 60);
    const handH = handW * IMAGE_ASPECT;
    const handTop = from.height * GRIP_Y - handH * FINGERTIPS_Y;
    const hand = div("grasping-hand", rig);
    hand.append(img);
    Object.assign(hand.style, {
        width: `${handW}px`,
        height: `${handH}px`,
        left: `${from.width / 2 - handW * FINGERS_CENTER_X}px`,
        top: `${handTop}px`,
        transformOrigin: `${FINGERS_CENTER_X * 100}% ${FINGERTIPS_Y * 100}%`,
    });

    // 1. The hand creeps up from below the screen, trembling as it arrives.
    const startY = window.innerHeight - (from.top + handTop) + 30;
    await hand.animate(
        [
            { transform: `translateY(${startY}px) rotate(4deg)` },
            { transform: "translateY(-9px) rotate(-1.5deg)", offset: 0.72 },
            { transform: "translateY(4px) rotate(1deg)", offset: 0.82 },
            { transform: "translateY(-2px) rotate(-0.6deg)", offset: 0.9 },
            { transform: "translateY(0) rotate(0deg)" },
        ],
        { duration: TIMING.descend, easing: "cubic-bezier(.3,.8,.4,1)", fill: "forwards" },
    ).finished;

    // 2. Pinch the card: the hand presses in slightly and the card buckles under the grip.
    const pinch = hand.animate(
        [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-4px) scale(0.97, 0.96)" }, { transform: "translateY(2px) scale(1)" }],
        { duration: TIMING.grip, easing: "ease-in-out" },
    );
    await sleep(TIMING.grip * 0.5);
    ghost.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0.95)" }, { transform: "scaleX(1)" }], { duration: TIMING.grip });
    ghost.style.visibility = "visible";
    ghost.classList.add("held");
    card.style.visibility = "hidden";
    await pinch.finished;

    // 3. Lift the card out of line.
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const s = to.width / from.width;
    // The rig scales around the grip point, so correct for that to land the card's top edge on the target's.
    const dy = to.top - from.top - (1 - s) * GRIP_Y * from.height;
    const liftY = -from.height * 0.35;
    const dir = Math.sign(dx) || 1;
    await rig.animate(
        [{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(0, ${liftY}px) scale(1.08) rotate(${-dir * 3}deg)` }],
        { duration: TIMING.lift, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" },
    ).finished;

    // 4. Carry it over the other cards in an arc, swinging a little.
    const arcY = Math.min(dy, 0) + liftY - from.height * 0.45;
    await rig.animate(
        [
            { transform: `translate(0, ${liftY}px) scale(1.08) rotate(${-dir * 3}deg)` },
            { transform: `translate(${dx * 0.5}px, ${arcY}px) scale(1.14) rotate(${dir * 7}deg)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy + liftY * 0.7}px) scale(${s * 1.08}) rotate(${-dir * 3}deg)`, offset: 0.88 },
            { transform: `translate(${dx}px, ${dy + liftY}px) scale(${s * 1.08}) rotate(0deg)` },
        ],
        { duration: TIMING.carry, easing: "ease-in-out", fill: "forwards" },
    ).finished;

    // 5. Slap it down at the front of the line.
    await rig.animate(
        [
            { transform: `translate(${dx}px, ${dy + liftY}px) scale(${s * 1.08})` },
            { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        ],
        { duration: TIMING.drop, easing: "cubic-bezier(.7,0,1,1)", fill: "forwards" },
    ).finished;

    dustPuff(layer, to.left + to.width / 2, to.top + to.height);
    target.animate(
        [
            { transform: "translateX(0)" },
            { transform: `translateX(${-dir * to.width * 0.35}px) rotate(${-dir * 6}deg)`, offset: 0.25 },
            { transform: `translateX(${dir * 4}px)`, offset: 0.7 },
            { transform: "translateX(0)" },
        ],
        { duration: 420, easing: "ease-out" },
    );
    target.parentElement?.animate(
        [
            { transform: "translate(0, 0)" },
            { transform: "translate(-4px, 3px)" },
            { transform: "translate(4px, -2px)" },
            { transform: "translate(-2px, 1px)" },
            { transform: "translate(0, 0)" },
        ],
        { duration: 260 },
    );

    // 6. Let go and sink back down out of sight, optionally throwing up a peace sign first.
    const sink = (el, height, delay) =>
        el.animate(
            [{ transform: "translateY(0)" }, { transform: "translateY(12px)", offset: 0.2 }, { transform: `translateY(${window.innerHeight + height}px)` }],
            { duration: TIMING.retreat, delay, easing: "cubic-bezier(.55,0,.85,.35)", fill: "forwards" },
        );
    let retreat;
    if (peaceImg) {
        const peaceW = from.width * PEACE_TO_CARD_WIDTH;
        const peaceH = peaceW * PEACE_ASPECT;
        const peaceHand = div("grasping-hand grasping-hand-peace", rig);
        peaceHand.append(peaceImg);
        Object.assign(peaceHand.style, {
            width: `${peaceW}px`,
            height: `${peaceH}px`,
            left: `${from.width / 2 - peaceW * PEACE_CENTER_X}px`,
            top: `${from.height * PEACE_TIPS_Y}px`,
            opacity: "0",
            transformOrigin: "50% 100%",
        });

        // The grabbing hand ducks away as the peace sign pops up in its place.
        hand.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${from.height * 0.6}px)`, opacity: 0 }], {
            duration: 260,
            delay: 150,
            easing: "ease-in",
            fill: "forwards",
        });
        await peaceHand.animate(
            [
                { transform: `translateY(${from.height * 0.8}px) scale(0.9)`, opacity: 0 },
                { transform: "translateY(-6px) scale(1.04)", opacity: 1, offset: 0.7 },
                { transform: "translateY(0) scale(1)", opacity: 1 },
            ],
            { duration: 380, delay: 250, easing: "ease-out", fill: "forwards" },
        ).finished;
        await peaceHand.animate(
            [
                { transform: "rotate(0deg)" },
                { transform: "rotate(-7deg)", offset: 0.25 },
                { transform: "rotate(6deg)", offset: 0.55 },
                { transform: "rotate(-3deg)", offset: 0.8 },
                { transform: "rotate(0deg)" },
            ],
            { duration: PEACE_HOLD, easing: "ease-in-out" },
        ).finished;
        retreat = sink(peaceHand, peaceH, 0);
    } else {
        retreat = sink(hand, handH, 220);
    }
    vignette.animate([{ opacity: 1 }, { opacity: 0 }], { duration: TIMING.retreat + 300, delay: peaceImg ? 0 : 220, fill: "forwards" });

    // Keep the ghost in place until the real tracker has re-sorted underneath it.
    await Promise.race([hold, sleep(5000)]);
    await retreat.finished;
    card.style.visibility = "";
    ghost.classList.remove("held");
    await ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished;
    layer.remove();
    return true;
}
