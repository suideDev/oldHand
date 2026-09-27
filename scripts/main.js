import { playGrab, RELEASE_MS } from "./hand-animation.js";

const MODULE_ID = "grasping-hand";
const SOCKET = `module.${MODULE_ID}`;
const MACRO_NAME = "Cut in Line";
const MACRO_COMMAND = `// Grasping Hand: drags a combatant's card to the front of the initiative order.
// Put the combatant's name between the quotes (e.g. "Old Man"),
// or leave it empty to use whichever token you have selected.
const NAME = "";

game.modules.get("grasping-hand")?.api?.seize(NAME || undefined);`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let busy = false;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "peace", {
        name: "Peace sign",
        hint: "After setting the card down, the hand throws up a peace sign before it leaves.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
    game.settings.register(MODULE_ID, "sound", {
        name: "Sound effect",
        hint: "Optional sound played for everyone when the hand appears.",
        scope: "world",
        config: true,
        type: String,
        default: "",
        filePicker: "audio",
    });
    game.settings.register(MODULE_ID, "color", {
        name: "Hand color",
        hint: "0 is black and white, 100 is the photo's full skin tone.",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 0, max: 100, step: 5 },
        default: 35,
    });
    game.settings.register(MODULE_ID, "macroCreated", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
});

Hooks.once("ready", async () => {
    game.socket.on(SOCKET, (payload) => {
        if (payload?.action === "seize") playSeize(payload);
    });
    const api = { seize, createMacro };
    game.modules.get(MODULE_ID).api = api;

    // First time the module runs, give the GM a ready-made hotbar macro.
    if (game.user.isGM && !game.settings.get(MODULE_ID, "macroCreated")) {
        try {
            await createMacro();
            await game.settings.set(MODULE_ID, "macroCreated", true);
        } catch (err) {
            console.error(`${MODULE_ID} | couldn't create the macro`, err);
        }
    }
});

/** Create the "Cut in Line" macro (if missing) and put it in the GM's first empty hotbar slot. */
async function createMacro() {
    let macro = game.macros.find((m) => m.getFlag(MODULE_ID, "macro"));
    if (!macro) {
        macro = await Macro.create({
            name: MACRO_NAME,
            type: "script",
            img: `modules/${MODULE_ID}/icons/hand.webp`,
            command: MACRO_COMMAND,
            flags: { [MODULE_ID]: { macro: true } },
        });
    }
    const hotbar = game.user.hotbar ?? {};
    if (!Object.values(hotbar).includes(macro.id)) {
        for (let slot = 1; slot <= 50; slot++) {
            if (hotbar[slot]) continue;
            await game.user.assignHotbarMacro(macro, slot);
            break;
        }
    }
    ui.notifications.info(`Grasping Hand: "${MACRO_NAME}" macro is on your hotbar.`);
    return macro;
}

// ---------------------------------------------------------------------------
// The grab
// ---------------------------------------------------------------------------

/**
 * Drag a combatant to the front of the line.
 * @param {Combatant|Token|TokenDocument|Actor|string} [who]  A combatant, token, actor, combatant id or name.
 *                                                            Defaults to the selected token.
 */
async function seize(who) {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can use the Grasping Hand.");
    const combatant = resolveCombatant(who);
    if (!combatant) {
        const hint = who ? `"${who}" isn't in the current combat.` : "Select his token, or put his name in the macro.";
        return ui.notifications.warn(`Grasping Hand: ${hint}`);
    }
    if (busy) return;
    busy = true;
    try {
        const combat = combatant.combat;
        const plan = planFront(combat, combatant);
        if (!plan) return ui.notifications.info(`${combatant.name} is already at the front.`);

        const payload = { action: "seize", combatId: combat.id, combatantId: combatant.id, targetId: plan.anchor.id };
        game.socket.emit(SOCKET, payload);
        playSeize(payload);
        playSound();

        await sleep(RELEASE_MS);
        await combatant.update({ initiative: plan.initiative });
        if (combat.started) await settleTurn(combat, combat.turns.findIndex((c) => c.id === combatant.id));
    } finally {
        busy = false;
    }
}

/**
 * Work out where the "front" is: in front of whoever is currently acting (or the top of the
 * order if combat hasn't started or it's the start of the round).
 */
function planFront(combat, combatant) {
    const current = combat.started ? combat.combatant : null;
    if (current === combatant) return null;
    if (!current && combat.turns[0] === combatant) return null;

    const order = combat.turns.filter((c) => c !== combatant);
    if (!order.length) return null;
    const idx = Math.max(0, current ? order.indexOf(current) : 0);
    const anchor = order[idx];
    const prev = order[idx - 1];
    const a = anchor.initiative ?? 0;

    let initiative;
    if (!prev) initiative = Math.floor(a) + 1;
    else {
        // Mid-round: squeeze in between the combatant who just went and the one about to go.
        const p = prev.initiative ?? a;
        initiative = p > a ? Math.round(((p + a) / 2) * 100) / 100 : a;
    }
    return { anchor, initiative };
}

/**
 * Foundry may shift the turn index itself after an initiative change (to keep the same combatant
 * active), so wait for that to land before setting the turn we actually want.
 */
async function settleTurn(combat, turn) {
    await sleep(400);
    if (combat.turn !== turn) await combat.update({ turn });
}

function resolveCombatant(who) {
    const combats = [ui.combatDock?.combat, ui.combat?.viewed, game.combat].filter(Boolean);
    if (who?.documentName === "Combatant") return who;

    const find = (fn) => {
        for (const combat of combats) {
            const found = combat.combatants.find(fn);
            if (found) return found;
        }
        return null;
    };

    if (typeof who === "string") return find((c) => c.id === who) ?? find((c) => c.name === who);
    if (who?.documentName === "Actor") return find((c) => c.actorId === who.id || c.actor === who);
    if (who?.document?.documentName === "Token" || who?.documentName === "Token") {
        const tokenId = who.document?.id ?? who.id;
        return find((c) => c.tokenId === tokenId);
    }
    if (who == null) {
        const selected = canvas?.tokens?.controlled?.[0];
        if (selected) return find((c) => c.tokenId === selected.document.id);
    }
    return null;
}

/** Runs on every client (the GM locally, players via the socket). */
async function playSeize({ combatId, combatantId, targetId }) {
    const dock = ui.combatDock;
    const root = dock?.element;
    if (!root || dock.combat?.id !== combatId) return;
    const find = (id) => root.querySelector(`.combatant-portrait[data-combatant-id="${id}"]`);
    const card = find(combatantId);
    const target = find(targetId);
    if (!card || !target || card === target) return;
    if (card.classList.contains("hidden") || target.classList.contains("hidden")) return;

    try {
        await playGrab(card, target, {
            hold: waitForReorder(combatantId),
            color: game.settings.get(MODULE_ID, "color") / 100,
            peace: game.settings.get(MODULE_ID, "peace"),
        });
    } catch (err) {
        console.error(`${MODULE_ID} | animation failed`, err);
        document.querySelectorAll(".grasping-hand-layer").forEach((el) => el.remove());
        card.style.visibility = "";
    }
}

function waitForReorder(combatantId) {
    return new Promise((resolve) => {
        let timeout;
        const hookId = Hooks.on("updateCombatant", (combatant, changes) => {
            if (combatant.id !== combatantId || !("initiative" in changes)) return;
            Hooks.off("updateCombatant", hookId);
            clearTimeout(timeout);
            setTimeout(resolve, 150); // give the carousel a moment to rebuild under the ghost card
        });
        timeout = setTimeout(() => {
            Hooks.off("updateCombatant", hookId);
            resolve();
        }, RELEASE_MS + 4000);
    });
}

function playSound() {
    const src = game.settings.get(MODULE_ID, "sound");
    if (!src) return;
    const helper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    helper?.play({ src, volume: 0.8, autoplay: true, loop: false }, true);
}
