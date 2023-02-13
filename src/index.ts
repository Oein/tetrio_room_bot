import {
  Builder,
  Browser,
  Key,
  By,
  Locator,
  WebElement,
} from "selenium-webdriver";
import {
  Client as d_Client,
  REST as d_REST,
  Routes as d_Routes,
  SlashCommandBuilder,
} from "discord.js";

import * as dotenv from "dotenv";
import { Options } from "selenium-webdriver/chrome";
dotenv.config();

let roomID: string;
let seleniumBooted: boolean = false;

const token = process.env.DISCORD || "";
const client = new d_Client({ intents: [] });
const rest = new d_REST({ version: "10" }).setToken(token);

const bw = 'input[data-index="game.options.boardwidth"]';
const bh = 'input[data-index="game.options.boardheight"]'; // 40
const g = 'input[data-index="game.options.g"]';
const gi = 'input[data-index="game.options.gincrease"]';

const discordCommands: SlashCommandBuilder[] = [
  new SlashCommandBuilder()
    .setName("roomid")
    .setDescription("Tetrio 방의 코드를 알 수 있어요"),
  new SlashCommandBuilder().setName("play").setDescription("게임을 시작해요"),
  new SlashCommandBuilder()
    .addStringOption((s) =>
      s
        .setName("opt")
        .setDescription("변경할 게임의 옵션을 선택해 주세요")
        .addChoices({ name: "가로 크기", value: "bw" })
        .addChoices({ name: "세로 크기", value: "bh" })
        .addChoices({ name: "중력", value: "g" })
        .addChoices({ name: "중력 증가", value: "gi" })
        .setRequired(true)
    )
    .addNumberOption((n) =>
      n
        .setName("val")
        .setDescription("값을 설정해 주세요.")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(40)
    )
    .setName("options")
    .setDescription("게임 설정을 변경해요"),
];

(async function () {
  console.log("[Selenium Boot]", "Loading...");
  let driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(
      new Options()
        .windowSize({
          width: 680,
          height: 480,
        })
        .addArguments("--mute-audio")
    )
    .build();

  // selenium booter
  (async function () {
    const elementExsists = (selector: Locator) => {
      return new Promise<boolean>((resolve, reject) => {
        driver
          .findElement(selector)
          .then((e) => {
            e.isDisplayed().then((v) => resolve(v));
          })
          .catch((e) => resolve(false));
      });
    };

    const waitElement = (selector: Locator) => {
      return new Promise<WebElement>((resolve, reject) => {
        let inter: NodeJS.Timer;

        inter = setInterval(async () => {
          if (await elementExsists(selector)) {
            clearInterval(inter);
            return resolve(await driver.findElement(selector));
          }
        }, 100);
      });
    };

    const userNameSelector = By.id("entry_username");
    const passWordSelector = By.id("login_password");
    const updateLogCoolSelector = By.css(
      "#dialogs > div > div > div.oob_button.flex-item.pri"
    );

    try {
      console.log("[Selenium Boot]", "Loading Tetrio...");
      await driver.get("https://tetr.io/");
      await driver.sleep(3000);

      console.log("[Selenium Boot]", "Username inputing...");
      await (
        await waitElement(userNameSelector)
      ).sendKeys(process.env.ID || "", Key.RETURN);

      console.log("[Selenium Boot]", "Password inputing...");
      await (
        await waitElement(passWordSelector)
      ).sendKeys(process.env.PW || "", Key.RETURN);

      console.log("[Selenium Boot]", "Update Log Cool...");
      await driver.sleep(10000);
      await (await waitElement(updateLogCoolSelector)).click();

      console.log("[Selenium Boot]", "Multiplayer...");
      await driver.sleep(5000);
      await driver.findElement(By.css("body")).sendKeys(Key.DOWN, Key.RETURN);

      console.log("[Selenium Boot]", "Create Room...");
      await driver.sleep(3000);
      await driver
        .findElement(By.css("body"))
        .sendKeys(Key.DOWN, Key.DOWN, Key.RETURN);

      console.log("[Selenium Boot]", "Private...");
      await driver.sleep(1000);
      await driver
        .findElement(By.css("body"))
        .sendKeys(Key.DOWN, Key.DOWN, Key.DOWN, Key.RETURN);

      console.log("[Selenium Boot]", "Changing into Spectating mode...");
      await driver.sleep(3000);
      await driver.executeScript(
        `document.querySelector("#room_switchbracket").click()`
      );

      console.log("[Selenium Boot]", "Changing option type to GAME...");
      await driver.sleep(3000);
      await driver.executeScript(
        `document.querySelector("#room_opts_game").click()`
      );

      console.log("[Selenium Boot]", "Getting Room ID...");
      await driver.sleep(3000);
      roomID = await driver.findElement(By.id("roomid")).getText();
    } finally {
      console.log("Selenium Boot Process Completed!");
      seleniumBooted = true;
    }
  })();

  // discord booter
  (() => {
    client.on("ready", (bot) => {
      console.log("[Discord Boot]", `Logged in as ${bot.user.tag}!`);

      (async () => {
        try {
          console.log(
            "[Discord Boot]",
            "Started refreshing application (/) commands."
          );

          await rest.put(d_Routes.applicationCommands(bot.user.id), {
            body: discordCommands.map((i) => i.toJSON()),
          });

          console.log(
            "[Discord Boot]",
            "Successfully reloaded application (/) commands."
          );
        } catch (error) {
          console.error(error);
        }
      })();

      client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        let commandName = interaction.commandName;

        switch (commandName) {
          case "roomid":
            if (seleniumBooted)
              interaction.reply(`방 ID는 \`` + roomID + `\`입니다!`);
            else interaction.reply("아직 Tetr.io를 키고 있어요.");
            return;
          case "play":
            if (seleniumBooted) {
              interaction.reply(
                `게임 시작을 요청했어요! 곧 시작될테니 준비하세요.`
              );
              await driver.executeScript(
                `document.getElementById("startroom").click()`
              );
            } else interaction.reply("아직 Tetr.io를 키고 있어요.");
          case "options":
            if (!seleniumBooted) {
              interaction.reply("아직 Tetr.io를 키고 있어요.");
              return;
            }
            const type = interaction.options.getString("opt") || "";
            const val = interaction.options.getNumber("val") || 1;

            const rs = async (tn: string, va: number) => {
              await driver.executeScript(
                `document.querySelector("${tn
                  .replace('"]', '\\"]')
                  .replace('"', '\\"')}").value = '';`
              );

              await driver.sleep(200);
              await driver.findElement(By.css(tn)).sendKeys(va.toString());

              await driver.executeScript(
                `setTimeout(() => {document.getElementById("room_opts_save").click()}, 500);`
              );

              await interaction.reply("설정을 변경했어요.");
            };

            switch (type) {
              case "bw":
                return await rs(bw, val);
              case "bh":
                return await rs(bh, val);
              case "g":
                return await rs(g, val);
              case "gi":
                return await rs(gi, val);
            }
            return;
          default:
            return;
        }
      });
    });

    console.log("[Discord Boot]", "Signing in...");
    client.login(token);
  })();
})();
