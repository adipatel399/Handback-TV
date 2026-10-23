import { randomUUID, randomBytes } from "node:crypto";
import { Store } from "./store.js";
import { PortalAdapter } from "./adapter.js";
import { canonicalTerms, localDate, type Task, type Terms } from "./shared.js";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class Coordinator {
  constructor(
    public store: Store,
    public adapter: PortalAdapter,
  ) {}
  private permitted(destinationId: string) {
    const cap = this.store.capability();
    if (Date.parse(cap.expiresAt) <= Date.now())
      throw new AppError(
        403,
        "Your helper needs to renew this task before it can be used.",
      );
    if (!cap.allowedDestinations.includes(destinationId))
      throw new AppError(
        403,
        "This destination is not included in your supported trips.",
      );
    return cap;
  }
  private ready(task: Task) {
    const cap = this.permitted(task.terms.destinationId);
    if (task.capabilityRevision !== cap.revision)
      throw new AppError(
        409,
        "Your helper changed the task settings. Please start a fresh trip.",
      );
    if (task.terms.fare > cap.maxFare)
      throw new AppError(
        403,
        "This fare is above your trip limit. Ask your helper to review it.",
      );
    return cap;
  }
  async preview(destinationId: string, date: string) {
    const cap = this.permitted(destinationId);
    if (date < localDate(1) || date > localDate(14))
      throw new AppError(400, "Please choose a trip within the next 14 days.");
    // Unresolved writes are kept visible until verified; a new task must not hide them.
    const unresolved = this.store
      .tasks()
      .find((t) => t.state === "submitting" || t.state === "unknown");
    if (unresolved)
      throw new AppError(
        409,
        "Please check your unfinished booking before starting another trip.",
      );
    const terms = await this.adapter.quote({
      passenger: cap.passenger,
      pickup: cap.pickup,
      destinationId,
      date,
    });
    if (
      this.store
        .tasks()
        .some((t) => t.state === "submitting" || t.state === "unknown")
    )
      throw new AppError(
        409,
        "Please check your unfinished booking before starting another trip.",
      );
    if (this.store.capability().revision !== cap.revision)
      throw new AppError(
        409,
        "Your helper changed the task settings. Please choose your trip again.",
      );
    if (terms.fare > cap.maxFare)
      throw new AppError(
        403,
        "This fare is above your trip limit. Ask your helper to review it.",
      );
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      state: "awaiting_confirmation",
      terms,
      capabilityRevision: cap.revision,
      confirmationToken: randomBytes(24).toString("hex"),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      createdAt: now,
      updatedAt: now,
      message: "Please review your trip. Nothing has been booked yet.",
    };
    this.store.saveTask(task);
    this.store.event(
      task.id,
      "preview",
      "Read the current trip terms from the provider interface.",
    );
    return task;
  }
  private refresh(task: Task, terms: Terms, message: string) {
    task.state = "awaiting_confirmation";
    task.terms = terms;
    task.confirmationToken = randomBytes(24).toString("hex");
    task.expiresAt = new Date(Date.now() + 120000).toISOString();
    task.message = message;
    this.store.saveTask(task);
    this.store.event(task.id, "terms_changed", message);
    return task;
  }
  async confirm(id: string, confirmationToken: string) {
    const task = this.store.task(id);
    if (!task) throw new AppError(404, "We could not find this trip.");
    if (
      task.state === "verified" ||
      task.state === "submitting" ||
      task.state === "unknown"
    )
      return task;
    if (task.state !== "awaiting_confirmation")
      throw new AppError(
        409,
        "This trip is no longer waiting for confirmation.",
      );
    if (confirmationToken !== task.confirmationToken)
      throw new AppError(
        409,
        "The trip review has changed. Please review the latest details.",
      );
    this.ready(task);
    if (
      this.store
        .tasks()
        .some(
          (t) =>
            t.id !== task.id &&
            (t.state === "submitting" || t.state === "unknown"),
        )
    )
      throw new AppError(
        409,
        "Please check your unfinished booking before confirming another trip.",
      );
    if (!this.store.claim(task.id)) return this.store.task(task.id)!;
    task.state = "submitting";
    task.message = "Checking the latest terms before booking…";
    this.store.saveTask(task);
    let writeAttempted = false;
    try {
      const latest = await this.adapter.quote(task.terms);
      this.ready(task); // Helper settings may have changed while the browser was loading.
      if (
        canonicalTerms(latest) !== canonicalTerms(task.terms) ||
        Date.parse(task.expiresAt) <= Date.now()
      ) {
        if (latest.fare > this.store.capability().maxFare)
          throw new AppError(
            403,
            "The new fare is above your trip limit. Ask your helper to review it.",
          );
        return this.refresh(
          task,
          latest,
          "The trip details or review time changed. Please review and confirm these current terms.",
        );
      }
      this.store.event(
        task.id,
        "confirmed",
        "Confirmation matched the exact current trip, fare, passenger, and task settings.",
      );
      // From this point, exceptions may follow a successful write. Reconcile before any retry.
      const result = await this.adapter.submit(task.terms, task.id, () => {
        this.ready(task);
        if (Date.parse(task.expiresAt) <= Date.now())
          throw new AppError(
            409,
            "The review expired before submission. Please start a fresh trip.",
          );
        writeAttempted = true;
      });
      if (result === "changed")
        return this.refresh(
          task,
          await this.adapter.quote(task.terms),
          "The provider updated the trip before accepting it. Please review the new details.",
        );
      return await this.reconcile(task);
    } catch (error) {
      if (error instanceof AppError) {
        task.state = "failed";
        task.message = error.message;
        this.store.saveTask(task);
        this.store.event(task.id, "blocked", error.message);
        return task;
      }
      if (!writeAttempted) {
        task.state = "failed";
        task.message =
          "We could not read the current provider page. Nothing was submitted. Please try again when the service is available.";
        this.store.saveTask(task);
        this.store.event(
          task.id,
          "failed_before_submit",
          "The provider interface could not be read; submission was never initiated.",
        );
        return task;
      }
      task.state = "unknown";
      task.message =
        "We could not confirm whether your booking completed. Check the result before trying again.";
      this.store.saveTask(task);
      this.store.event(
        task.id,
        "unknown",
        "Browser or provider did not return a conclusive result. No automatic resubmission.",
      );
      // A read is safe even if the submit response was lost.
      try {
        return await this.reconcile(task);
      } catch {
        return task;
      }
    }
  }
  private async reconcile(task: Task) {
    try {
      const receipt = await this.adapter.readReceipt(task.id);
      if (receipt) {
        const { reference, requestId, createdAt, ...actual } = receipt;
        if (
          requestId !== task.id ||
          canonicalTerms(actual) !== canonicalTerms(task.terms)
        )
          throw new Error(
            "Provider receipt does not match the confirmed terms",
          );
        task.state = "verified";
        task.receipt = { ...receipt, verifiedAt: new Date().toISOString() };
        task.message =
          "Your trip is booked. We checked the provider’s stored reservation.";
        this.store.event(
          task.id,
          "verified",
          `Read back provider reservation ${receipt.reference}; exact confirmed terms matched.`,
        );
      } else {
        task.state = "unknown";
        task.message =
          "The provider has not shown a matching booking yet. We will not submit it again automatically.";
        this.store.event(
          task.id,
          "unknown",
          "No matching stored reservation was visible.",
        );
      }
    } catch {
      task.state = "unknown";
      task.message =
        "The provider’s booking history is unavailable. Your booking may have completed. Please check again later.";
      this.store.event(
        task.id,
        "unknown",
        "Stored result cannot currently be checked.",
      );
    }
    this.store.saveTask(task);
    return task;
  }
  async check(id: string) {
    const t = this.store.task(id);
    if (!t) throw new AppError(404, "Trip not found.");
    if (t.state === "submitting") return t;
    if (t.state === "verified") return t;
    if (t.state !== "unknown")
      throw new AppError(409, "This trip does not need a result check.");
    return this.reconcile(t);
  }
  cancel(id: string) {
    const t = this.store.task(id);
    if (!t) throw new AppError(404, "Trip not found.");
    if (t.state !== "awaiting_confirmation")
      throw new AppError(409, "A submitted trip cannot be cancelled here.");
    t.state = "cancelled";
    t.message = "This draft was closed. No reservation was submitted.";
    this.store.saveTask(t);
    return t;
  }
}
