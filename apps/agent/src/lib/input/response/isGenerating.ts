import type { Provider } from "@oneglanse/types";
import {
	PROVIDER_MODEL_RESPONSE_SELECTORS,
	PROVIDER_RESPONSE_GENERATION_SELECTORS,
} from "@oneglanse/utils";
import type { Page } from "playwright";

export async function getGenerationStateSignature(
	page: Page,
	provider: Provider,
) : Promise<string> {
	return await page.evaluate((selectors) =>
		(selectors || [])
			.map((selector) => {
				const parts = Array.from(document.querySelectorAll(selector)).map((node) => {
					const element = node as HTMLElement;
					const style = window.getComputedStyle(element);
					const visible =
						element.offsetParent !== null &&
						style.visibility !== "hidden" &&
						style.display !== "none";
					const text = (element.textContent || "").trim();
					const ariaLabel = element.getAttribute("aria-label") || "";
					const disabled = element.getAttribute("disabled") ? "1" : "0";
					return `${visible ? 1 : 0}:${text}:${ariaLabel}:${disabled}`;
				});
				return `${selector}=>${parts.join("|")}`;
			})
			.join("||"),
		PROVIDER_RESPONSE_GENERATION_SELECTORS[provider] || [],
	);
}

export async function hasVisibleGenerationIndicator(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	return await page.evaluate((selectors) =>
		(selectors || []).some((selector) =>
			Array.from(document.querySelectorAll(selector)).some((node) => {
				const element = node as HTMLElement;
				const style = window.getComputedStyle(element);
				return (
					element.offsetParent !== null &&
					style.visibility !== "hidden" &&
					style.display !== "none"
				);
			}),
		),
		PROVIDER_RESPONSE_GENERATION_SELECTORS[provider] || [],
	);
}

export async function getResponseStateSignature(
	page: Page,
	provider: Provider,
): Promise<{ signature: string; textLength: number }> {
	return await page.evaluate(({ selectors, provider: currentProvider }) => {
		const visible = (element: Element | null): element is HTMLElement => {
			if (!(element instanceof HTMLElement)) return false;
			if (!element.isConnected) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0"
			) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		};

		const textOf = (el: HTMLElement) =>
			(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();

		const findLatestChatGpt = (): HTMLElement | null => {
			const assistants = Array.from(
				document.querySelectorAll('[data-message-author-role="assistant"]'),
			);
			for (const root of assistants.reverse()) {
				if (!(root instanceof HTMLElement)) continue;
				const markdown = root.querySelector(
					'.markdown, .prose, [class*="markdown"]',
				);
				if (markdown instanceof HTMLElement && textOf(markdown).length > 0) {
					return markdown;
				}
				if (textOf(root).length > 0) return root;
			}
			const turn = document.querySelector(".agent-turn:last-of-type");
			return turn instanceof HTMLElement && textOf(turn).length > 0
				? turn
				: null;
		};

		const elements = (selectors || [])
			.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
			.filter((el): el is HTMLElement => visible(el) && textOf(el).length > 0);

		let latest = elements.at(-1) ?? null;

		if (!latest && currentProvider === "chatgpt") {
			latest = findLatestChatGpt();
			if (!latest) {
				const articles = Array.from(
					document.querySelectorAll(
						'article[data-testid^="conversation-turn"], article',
					),
				).filter((el): el is HTMLElement => el instanceof HTMLElement);
				latest = articles.at(-1) ?? null;
			}
			if (!latest) {
				const main = document.querySelector("main");
				if (main instanceof HTMLElement && textOf(main).length > 80) {
					latest = main;
				}
			}
		}

		if (!latest) {
			return { signature: "", textLength: 0 };
		}

		const text = textOf(latest);
		const signature =
			currentProvider === "chatgpt"
				? `${text.length}`
				: `${text.length}:${latest.innerHTML.length}:${latest.childElementCount}:${text.slice(-120)}`;
		return {
			signature,
			textLength: text.length,
		};
	}, {
		selectors: PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || [],
		provider,
	});
}
