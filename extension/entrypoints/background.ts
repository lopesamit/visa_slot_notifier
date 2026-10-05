import { parseDates } from "../src/dates";
import { pendingShare } from "../src/pending-share";

const MENU_ID = "share-selected-date";

/**
 * Adds "Share this date" to the right-click menu for highlighted text. Chrome
 * passes only the highlighted text; the extension never runs on the page.
 */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Share this date with Visa Slot Notifier",
      contexts: ["selection"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== MENU_ID) return;
    await pendingShare.setValue({ dates: parseDates(info.selectionText ?? ""), at: Date.now() });
    try {
      await browser.action.openPopup();
    } catch {
      await browser.windows.create({
        url: browser.runtime.getURL("/popup.html"),
        type: "popup",
        width: 380,
        height: 640,
      });
    }
  });
});
