import { chromium, type Browser, type Page } from "playwright";
import { z } from "zod";
import { canonicalTerms, type Terms, type Receipt } from "./shared.js";

const TermsSchema = z.object({
  passenger: z.string(),
  pickup: z.string(),
  destinationId: z.string(),
  destination: z.string(),
  date: z.string(),
  time: z.string(),
  fare: z.number(),
  currency: z.literal("INR"),
  version: z.number(),
});
const ReceiptSchema = TermsSchema.extend({
  reference: z.string(),
  requestId: z.string(),
  createdAt: z.string(),
});
export class PortalAdapter {
  private browser?: Promise<Browser>;
  constructor(public baseUrl: string) {}
  private getBrowser() {
    return (this.browser ??= chromium.launch({
      headless: true,
      executablePath: process.env.HANDBACK_BROWSER_EXECUTABLE || undefined,
    }));
  }
  private async page<T>(fn: (page: Page) => Promise<T>) {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    try {
      return await fn(page);
    } finally {
      await context.close();
    }
  }
  private url(
    terms: Pick<Terms, "passenger" | "pickup" | "destinationId" | "date">,
    requestId?: string,
  ) {
    return `${this.baseUrl}/provider/book?${new URLSearchParams({ ...terms, ...(requestId ? { requestId } : {}) }).toString()}`;
  }
  async quote(
    input: Pick<Terms, "passenger" | "pickup" | "destinationId" | "date">,
  ): Promise<Terms> {
    return this.page(async (page) => {
      await page.goto(this.url(input));
      await page
        .getByRole("button", { name: "Review trip", exact: true })
        .click();
      const quote = page.getByTestId("provider-quote");
      await quote.waitFor({ state: "visible" });
      return TermsSchema.parse(
        JSON.parse((await quote.getAttribute("data-terms"))!),
      );
    });
  }
  async submit(
    expected: Terms,
    requestId: string,
    beforeSubmit?: () => void,
  ): Promise<"submitted" | "changed" | "uncertain"> {
    return this.page(async (page) => {
      await page.goto(this.url(expected, requestId));
      await page
        .getByRole("button", { name: "Review trip", exact: true })
        .click();
      const el = page.getByTestId("provider-quote");
      await el.waitFor({ state: "visible" });
      const current = TermsSchema.parse(
        JSON.parse((await el.getAttribute("data-terms"))!),
      );
      if (canonicalTerms(current) !== canonicalTerms(expected))
        return "changed";
      beforeSubmit?.();
      await page
        .getByRole("button", { name: "Confirm reservation", exact: true })
        .click();
      await page
        .locator('[data-testid="provider-result"]')
        .waitFor({ state: "visible" });
      const result = await page
        .getByTestId("provider-result")
        .getAttribute("data-outcome");
      return result === "accepted"
        ? "submitted"
        : result === "changed"
          ? "changed"
          : "uncertain";
    });
  }
  async readReceipt(requestId: string): Promise<Receipt | undefined> {
    return this.page(async (page) => {
      await page.goto(
        `${this.baseUrl}/provider/history?requestId=${encodeURIComponent(requestId)}`,
      );
      await page.getByTestId("provider-history").waitFor({ state: "visible" });
      if (
        (await page
          .getByTestId("provider-history")
          .getAttribute("data-available")) !== "true"
      )
        throw new Error("Provider booking history is temporarily unavailable");
      const row = page.locator(`[data-request-id="${requestId}"]`);
      if (!(await row.count())) return undefined;
      return ReceiptSchema.parse(
        JSON.parse((await row.getAttribute("data-receipt"))!),
      );
    });
  }
  async close() {
    if (this.browser) await (await this.browser).close();
    this.browser = undefined;
  }
}
