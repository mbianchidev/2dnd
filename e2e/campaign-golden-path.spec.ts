import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "2dnd_save";
const MAIN_QUEST_ID = "twelvefoldCovenant";
const EPILOGUE_ID = "campaign.twelvefoldCovenant.epilogue";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface BrowserQuestProgress {
  status: string;
  stage: number;
  claimedRewards: string[];
}

interface BrowserSave {
  player: {
    name: string;
    inventory: Array<{ id: string }>;
    progression: {
      seenCutsceneIds: string[];
      pendingCutsceneIds: string[];
      tutorial: {
        completed: boolean;
      };
      quests: {
        quests: Record<string, BrowserQuestProgress>;
      };
    };
  };
  defeatedBosses: string[];
}

async function holdKey(
  page: Page,
  key: string,
  duration = 180,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  );
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function enableDebug(page: Page): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  await expect(page.locator("#debug-panel")).toBeVisible();
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

async function readSave(page: Page): Promise<BrowserSave> {
  return page.evaluate((saveKey) => {
    const raw = localStorage.getItem(saveKey);
    if (!raw) throw new Error(`Missing localStorage save: ${saveKey}`);
    return JSON.parse(raw) as BrowserSave;
  }, SAVE_KEY);
}

async function advanceQuestDialogue(page: Page): Promise<void> {
  await holdKey(page, "Space");
  await holdKey(page, "Space");
  await holdKey(page, "Space");
}

async function advanceGenericCutscene(page: Page): Promise<void> {
  await page.waitForTimeout(420);
  await holdKey(page, "Enter");
  await page.waitForTimeout(420);
}

async function drainGenericCutscenesUntil(
  page: Page,
  destination: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(destination)) return;
    if (state.includes("CUTSCENE")) {
      await advanceGenericCutscene(page);
    } else {
      await page.waitForTimeout(150);
    }
  }
  throw new Error(`Timed out draining cutscenes to ${destination}`);
}

test("campaign golden path reaches and recovers the post-game ending", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    let seed = 0x2d0d2026;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("campaignGoldenPathInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("campaignGoldenPathInitialized", "true");
    }
  });

  await test.step("create a new character", async () => {
    await page.goto("./", { waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await clickGame(page, 320, 324);
    await waitForState(page, "BOOT | Screen: character");

    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Backspace");
    }
    for (const key of ["b", "r", "o", "w", "s", "e", "r", "h", "e", "r", "o"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(30);
    }
    await clickGame(page, 284, 160);
    await holdKey(page, "Enter");
    await waitForState(page, "BOOT | Screen: stats");

    await clickGame(page, 390, 64);
    await clickGame(page, 400, 460);
    await waitForState(page, "BOOT | Screen: appearance");
    await clickGame(page, 320, 112);
    await clickGame(page, 420, 312);
    await waitForState(page, "CUTSCENE | campaign.opening | Step 1/2");
    const interruptedSave = await readSave(page);
    expect(interruptedSave.player.progression.pendingCutsceneIds).toEqual([
      "campaign.opening",
      "campaign.stage.firstSeal",
    ]);

    await advanceGenericCutscene(page);
    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await clickGame(page, 320, 324);
    await waitForState(page, "CUTSCENE | campaign.opening | Step 1/2");
    await drainGenericCutscenesUntil(page, "OVERWORLD");
    await waitForState(page, "[TUTORIAL]");
    await clickGame(page, 506, 455);
    await holdKey(page, "Enter");
    await holdKey(page, "Enter");
    await holdKey(page, "Enter");
    await holdKey(page, "Enter");
    await expect(page.locator("#debug-state")).not.toContainText("[TUTORIAL]");
    expect((await readSave(page)).player.progression.tutorial.completed).toBe(true);

    await holdKey(page, "F1");
    await waitForState(page, "[TIPS]");
    await holdKey(page, "F1");
    await expect(page.locator("#debug-state")).not.toContainText("[TIPS]");
    await holdKey(page, "Escape");
    await waitForState(page, "[MENU]");
    await clickGame(page, 320, 260);
    await waitForState(page, "[TIPS]");
    await holdKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[TIPS]");
    await enableDebug(page);
    expect(browserErrors).toEqual([]);
  });

  await test.step("complete the first Elowen quest interaction", async () => {
    await submitDebug(page, "/tp Willowdale");
    await expect(page.locator("#debug-log")).toContainText(
      "[CMD] Teleported to city Willowdale",
    );
    await holdKey(page, "Space");
    await waitForState(page, "[CITY:willowdale_city:0]");
    await submitDebug(page, "/near willowdaleArchivist");
    await expect(page.locator("#debug-log")).toContainText(
      "[CMD] Positioned beside willowdaleArchivist.",
    );
    await advanceQuestDialogue(page);
    await waitForState(page, "CUTSCENE");
    await drainGenericCutscenesUntil(page, "[CITY:willowdale_city:0]");

    await expect.poll(async () => {
      const save = await readSave(page);
      return save.player.progression.quests.quests[MAIN_QUEST_ID]?.stage;
    }).toBe(1);
    const save = await readSave(page);
    expect(save.player.name).toBe("browserhero");
    expect(save.player.inventory.map((item) => item.id)).toContain(
      "covenantSigil",
    );
  });

  await test.step("reload the persisted campaign", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await clickGame(page, 320, 324);
    await waitForState(page, "OVERWORLD");
    await enableDebug(page);
    const save = await readSave(page);
    expect(save.player.name).toBe("browserhero");
    expect(save.player.progression.quests.quests[MAIN_QUEST_ID]?.stage).toBe(1);
    expect(browserErrors).toEqual([]);
  });

  await test.step("travel through a dungeon and return from battle", async () => {
    await submitDebug(page, "/tp Heartlands Crypt");
    await expect(page.locator("#debug-log")).toContainText(
      "[CMD] Teleported to dungeon Heartlands Crypt",
    );
    await holdKey(page, "Space");
    await waitForState(
      page,
      "CUTSCENE | campaign.dungeon.heartlandsCrypt.reveal",
    );
    await drainGenericCutscenesUntil(page, "[DUNGEON:heartlands_dungeon]");

    await submitDebug(page, "/tp Willowdale");
    await waitForState(page, "OVERWORLD");
    await submitDebug(page, "/spawn slime");
    await waitForState(page, "BATTLE");
    await submitDebug(page, "/kill");
    await waitForState(page, "Phase: victory");
    await waitForState(page, "OVERWORLD");
  });

  await test.step("defeat the final boss and complete the real Elowen turn-in", async () => {
    await submitDebug(page, "/quest set main lastForge");
    await expect.poll(async () => {
      const save = await readSave(page);
      return save.player.progression.quests.quests[MAIN_QUEST_ID]?.stage;
    }).toBe(6);
    await submitDebug(page, "/spawn infernoForgemaster");
    await waitForState(page, "CUTSCENE | boss.infernoForgemaster.pre");
    await page.waitForTimeout(420);
    await holdKey(page, "Escape");
    await waitForState(page, "BATTLE");
    await submitDebug(page, "/kill");
    await waitForState(page, "Phase: victory");
    await waitForState(page, "CUTSCENE | boss.infernoForgemaster.post");
    await drainGenericCutscenesUntil(page, "OVERWORLD");

    await submitDebug(page, "/tp Willowdale");
    await holdKey(page, "Space");
    await waitForState(page, "[CITY:willowdale_city:0]");
    await submitDebug(page, "/near willowdaleArchivist");
    await expect(page.locator("#debug-log")).toContainText(
      "[CMD] Positioned beside willowdaleArchivist.",
    );
    await advanceQuestDialogue(page);
    await waitForState(page, "CUTSCENE | campaign.finalReturn");
    await drainGenericCutscenesUntil(
      page,
      "ENDING | Step: 1/5 | Type: narration",
    );
    await waitForState(page, "ENDING | Step: 1/5 | Type: narration");

    const save = await readSave(page);
    const progress = save.player.progression.quests.quests[MAIN_QUEST_ID];
    expect(progress?.status).toBe("completed");
    expect(progress?.claimedRewards).toEqual(expect.arrayContaining([
      "main.completionXp",
      "main.completionGold",
      "main.dawnforgedBlade",
      "main.shadowSteed",
    ]));
    expect(save.player.inventory.map((item) => item.id)).toContain(
      "dawnforgedBlade",
    );
    expect(save.defeatedBosses).toContain("infernoForgemaster");
  });

  await test.step("view credits and continue post-game", async () => {
    await page.waitForTimeout(400);
    await holdKey(page, "Enter");
    await waitForState(page, "ENDING | Step: 2/5 | Type: dialogue");
    await holdKey(page, "Enter");
    await waitForState(page, "ENDING | Step: 3/5 | Type: narration");
    await holdKey(page, "Enter");
    await waitForState(page, "ENDING | Step: 4/5 | Type: summary");
    await holdKey(page, "Enter");
    await waitForState(page, "ENDING | Step: 5/5 | Type: credits");
    await holdKey(page, "Enter");
    await waitForState(page, "ENDING | Choices");
    await holdKey(page, "Enter");
    await waitForState(page, "OVERWORLD");

    const save = await readSave(page);
    expect(save.player.progression.seenCutsceneIds).toContain(EPILOGUE_ID);
  });

  await test.step("replay a Chronicle entry without mutating progression", async () => {
    const beforeReplay = JSON.stringify(
      (await readSave(page)).player.progression,
    );
    await page.waitForTimeout(800);
    await holdKey(page, "Escape");
    await waitForState(page, "[MENU]");
    await clickGame(page, 320, 220);
    await waitForState(page, "[CHRONICLE]");
    await holdKey(page, "Enter");
    await waitForState(page, "CUTSCENE | campaign.opening");
    await page.waitForTimeout(420);
    await holdKey(page, "Escape");
    await waitForState(page, "OVERWORLD");
    expect(JSON.stringify((await readSave(page)).player.progression))
      .toBe(beforeReplay);
  });

  await test.step("recover a completed but unseen ending after reload", async () => {
    await page.evaluate(({ saveKey, epilogueId }) => {
      const raw = localStorage.getItem(saveKey);
      if (!raw) throw new Error(`Missing localStorage save: ${saveKey}`);
      const save = JSON.parse(raw) as BrowserSave;
      save.player.progression.seenCutsceneIds =
        save.player.progression.seenCutsceneIds.filter(
          (cutsceneId) => cutsceneId !== epilogueId,
        );
      localStorage.setItem(saveKey, JSON.stringify(save));
    }, { saveKey: SAVE_KEY, epilogueId: EPILOGUE_ID });

    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await clickGame(page, 320, 324);
    await waitForState(page, "ENDING | Step: 1/5 | Type: narration");
    await page.waitForTimeout(420);
    await holdKey(page, "Escape");
    await waitForState(page, "ENDING | Choices");
    await holdKey(page, "Enter");
    await waitForState(page, "OVERWORLD");
    expect(browserErrors).toEqual([]);
  });
});
