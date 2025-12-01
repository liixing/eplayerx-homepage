/**
 * Bilibili scraper - fetch hot anime
 */

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export interface BilibiliItem {
  title: string;
}

/**
 * Fetch hot anime from Bilibili
 */
export async function fetchBilibiliHotAnime(): Promise<BilibiliItem[]> {
  let browser;
  try {
    // Configure chromium for Vercel environment
    chromium.setGraphicsMode = false;

    // Launch browser with chromium for Vercel compatibility
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });

    const page = await browser.newPage();

    // Navigate to page
    await page.goto("https://www.bilibili.com/v/popular/rank/anime", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for content to load
    await page
      .waitForSelector(".content .info a", {
        timeout: 10000,
      })
      .catch(() => {
        // If selector not found, continue anyway
      });

    // Extract titles using Puppeteer's DOM API
    const items: BilibiliItem[] = await page.evaluate(() => {
      const titles: BilibiliItem[] = [];
      const titleSet = new Set<string>();

      // Extract from .content .info a tags, limit to 12
      const linkElements = document.querySelectorAll(".content .info a");

      for (let i = 0; i < Math.min(linkElements.length, 12); i++) {
        const element = linkElements[i];
        const title = element.textContent?.trim();
        if (title) {
          // Only keep content before the first space
          const titleBeforeSpace = title.split(" ")[0];
          if (titleBeforeSpace && !titleSet.has(titleBeforeSpace)) {
            titleSet.add(titleBeforeSpace);
            titles.push({ title: titleBeforeSpace });
          }
        }
      }

      return titles;
    });

    return items;
  } catch (error) {
    console.error("Error fetching Bilibili:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fetch hot guochuang from Bilibili
 */
export async function fetchBilibiliHotGuochuang(): Promise<BilibiliItem[]> {
  let browser;
  try {
    // Configure chromium for Vercel environment
    chromium.setGraphicsMode = false;

    // Launch browser with chromium for Vercel compatibility
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to page
    await page.goto("https://www.bilibili.com/v/popular/rank/guochuang", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for content to load
    await page
      .waitForSelector(".content .info a", {
        timeout: 10000,
      })
      .catch(() => {
        // If selector not found, continue anyway
      });

    // Extract titles using Puppeteer's DOM API
    const items: BilibiliItem[] = await page.evaluate(() => {
      const titles: BilibiliItem[] = [];
      const titleSet = new Set<string>();

      // Extract from .content .info a tags, limit to 12
      const linkElements = document.querySelectorAll(".content .info a");

      for (let i = 0; i < Math.min(linkElements.length, 12); i++) {
        const element = linkElements[i];
        const title = element.textContent?.trim();
        if (title) {
          // Only keep content before the first space
          const titleBeforeSpace = title.split(" ")[0];
          if (titleBeforeSpace && !titleSet.has(titleBeforeSpace)) {
            titleSet.add(titleBeforeSpace);
            titles.push({ title: titleBeforeSpace });
          }
        }
      }

      return titles;
    });

    return items;
  } catch (error) {
    console.error("Error fetching Bilibili guochuang:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
