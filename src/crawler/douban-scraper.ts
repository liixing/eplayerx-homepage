/**
 * Douban scraper - fetch hot content
 */

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export interface DoubanItem {
	title: string;
}

/**
 * Fetch Douban collection using Puppeteer
 */
async function fetchDoubanCollection(url: string): Promise<DoubanItem[]> {
	let browser;
	try {
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
			"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
		);

		// Navigate to page
		await page.goto(url, {
			waitUntil: "networkidle2",
			timeout: 30000,
		});

		// Wait for content to load
		await page
			.waitForSelector(".frc-subject-info-title", {
				timeout: 10000,
			})
			.catch(() => {
				// If selector not found, continue anyway
			});

		// Extract titles using Puppeteer's DOM API
		const items: DoubanItem[] = await page.evaluate(() => {
			const titles: DoubanItem[] = [];
			const elements = document.querySelectorAll(".frc-subject-info-title");

			elements.forEach((element) => {
				const title = element.textContent?.trim();
				if (title) {
					// Only keep content before the first space
					const titleBeforeSpace = title.split(" ")[0];
					if (titleBeforeSpace) {
						titles.push({ title: titleBeforeSpace });
					}
				}
			});

			return titles;
		});

		return items;
	} catch (error) {
		console.error("Error fetching Douban:", error);
		return [];
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

/**
 * Fetch hot movies from Douban
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
	return await fetchDoubanCollection(
		"https://m.douban.com/subject_collection/movie_real_time_hotest",
	);
}

/**
 * Fetch hot TV series from Douban
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
	return await fetchDoubanCollection(
		"https://m.douban.com/subject_collection/tv_real_time_hotest",
	);
}
