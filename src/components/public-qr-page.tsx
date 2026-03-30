"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getQrPackageDetail, qrSvgUrl, updateQrPackageDetail } from "@/lib/backend";
import type { PublicQrPackagePatch, QrPackageDetail } from "@/lib/operations-types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PublicQrPage({ qrToken }: { qrToken: string }) {
  const [detail, setDetail] = useState<QrPackageDetail | null>(null);
  const [draft, setDraft] = useState<PublicQrPackagePatch>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFeedback("");

    void getQrPackageDetail(qrToken)
      .then((payload) => {
        if (!active) {
          return;
        }
        if (!payload) {
          setFeedback("Backend API is not configured.");
          return;
        }
        setDetail(payload);
        setDraft({
          teamName: payload.teamName,
          factoryName: payload.factoryName,
          deploymentDate: payload.deploymentDate,
          receivedSdCardsCount:
            payload.package.receivedSdCardsCount ?? payload.package.shippedSdCardsCount,
          receivedDevicesCount:
            payload.package.receivedDevicesCount ?? payload.package.shippedDevicesCount,
          receivedUsbHubsCount:
            payload.package.receivedUsbHubsCount ?? payload.package.shippedUsbHubsCount,
          receivedCablesCount:
            payload.package.receivedCablesCount ?? payload.package.shippedCablesCount,
          note: payload.package.note,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setFeedback(error instanceof Error ? error.message : "Failed to load QR packet.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [qrToken]);

  async function handleSave() {
    if (!detail) {
      return;
    }

    setPending(true);
    setFeedback("");
    try {
      const updated = await updateQrPackageDetail(detail.package.qrToken, draft);
      if (!updated) {
        throw new Error("Backend API is not configured.");
      }
      setDetail(updated);
      setDraft({
        teamName: updated.teamName,
        factoryName: updated.factoryName,
        deploymentDate: updated.deploymentDate,
        receivedSdCardsCount:
          updated.package.receivedSdCardsCount ?? updated.package.shippedSdCardsCount,
        receivedDevicesCount:
          updated.package.receivedDevicesCount ?? updated.package.shippedDevicesCount,
        receivedUsbHubsCount:
          updated.package.receivedUsbHubsCount ?? updated.package.shippedUsbHubsCount,
        receivedCablesCount:
          updated.package.receivedCablesCount ?? updated.package.shippedCablesCount,
        note: updated.package.note,
      });
      setEditing(false);
      setFeedback("QR details saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to save QR details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid-overlay min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-4 py-8 sm:px-6 lg:px-10">
        <section className="panel-shell w-full overflow-hidden">
          <div className="grid gap-6 border-b border-[color:var(--border)] px-5 py-5 lg:grid-cols-[1.12fr_0.88fr] lg:px-7 lg:py-7">
            <div className="space-y-4">
              <span className="inline-flex border border-[color:var(--border)] bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                Public Packet Page
              </span>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)]">
                  QR-linked packet details
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[color:var(--muted-foreground)]">
                  Factory and ingestion teams can scan this label without login. Team,
                  factory, deployment date, shipped counts, and received counts stay attached
                  to the packet.
                </p>
              </div>
              {detail ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Ticket
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                      {detail.title}
                    </p>
                  </div>
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Packet
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                      {detail.package.packageCode}
                    </p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      {detail.package.qrToken}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border border-[color:var(--border)] bg-white/78 p-5">
              {detail?.qrSvgPath ? (
                <Image
                  src={qrSvgUrl(detail.package.qrToken)}
                  alt={`${detail.package.packageCode} QR`}
                  width={224}
                  height={224}
                  className="mx-auto h-56 w-56"
                  unoptimized
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[0.92fr_1.08fr] lg:px-7 lg:py-7">
            <div className="space-y-4">
              <div className="border border-[color:var(--border)] bg-[color:var(--accent-soft)] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--info-foreground)]">
                  Edit window
                </p>
                {detail?.editWindowExpiresAt ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                    Editable until {formatDateTime(detail.editWindowExpiresAt)}. After that,
                    this QR becomes read-only for the public flow.
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                    The edit window starts after the first successful save and then remains open
                    until end of day.
                  </p>
                )}
                {!detail?.editable && detail?.lockedReason ? (
                  <p className="mt-3 text-sm text-[color:var(--error-foreground)]">
                    {detail.lockedReason}
                  </p>
                ) : null}
              </div>
              {feedback ? (
                <div className="border border-[color:var(--border)] bg-white/78 p-4 text-sm text-[color:var(--muted-foreground)]">
                  {feedback}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              {loading ? (
                <div className="border border-[color:var(--border)] bg-white/78 p-4 text-sm text-[color:var(--muted-foreground)]">
                  Loading packet details...
                </div>
              ) : detail ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border border-[color:var(--border)] bg-white/78 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Team name
                      </p>
                      <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                        {detail.teamName || "Not set"}
                      </p>
                    </div>
                    <div className="border border-[color:var(--border)] bg-white/78 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Factory name
                      </p>
                      <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                        {detail.factoryName || "Not set"}
                      </p>
                    </div>
                    <div className="border border-[color:var(--border)] bg-white/78 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Deployment date
                      </p>
                      <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                        {detail.deploymentDate || "Not set"}
                      </p>
                    </div>
                    <div className="border border-[color:var(--border)] bg-white/78 p-4 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Logistics packed
                      </p>
                      <dl className="mt-2 grid gap-2 text-sm text-[color:var(--muted-foreground)] sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3">
                          <dt>SD cards</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.shippedSdCardsCount}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Devices</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.shippedDevicesCount}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>USB hubs</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.shippedUsbHubsCount}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Cables</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.shippedCablesCount}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="border border-[color:var(--border)] bg-white/78 p-4 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Factory confirmed received
                      </p>
                      <dl className="mt-2 grid gap-2 text-sm text-[color:var(--muted-foreground)] sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3">
                          <dt>SD cards</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.receivedSdCardsCount ?? "Not set"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Devices</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.receivedDevicesCount ?? "Not set"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>USB hubs</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.receivedUsbHubsCount ?? "Not set"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Cables</dt>
                          <dd className="font-semibold text-[color:var(--foreground)]">
                            {detail.package.receivedCablesCount ?? "Not set"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {editing ? (
                    <div className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={draft.teamName ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, teamName: event.target.value }))
                          }
                          placeholder="Team name"
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          value={draft.factoryName ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, factoryName: event.target.value }))
                          }
                          placeholder="Factory name"
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          type="date"
                          value={draft.deploymentDate ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              deploymentDate: event.target.value,
                            }))
                          }
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          type="number"
                          min={0}
                          value={draft.receivedSdCardsCount ?? 0}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              receivedSdCardsCount: Number(event.target.value),
                            }))
                          }
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          type="number"
                          min={0}
                          value={draft.receivedDevicesCount ?? 0}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              receivedDevicesCount: Number(event.target.value),
                            }))
                          }
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          type="number"
                          min={0}
                          value={draft.receivedUsbHubsCount ?? 0}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              receivedUsbHubsCount: Number(event.target.value),
                            }))
                          }
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          type="number"
                          min={0}
                          value={draft.receivedCablesCount ?? 0}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              receivedCablesCount: Number(event.target.value),
                            }))
                          }
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                      </div>
                      <textarea
                        value={draft.note ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, note: event.target.value }))
                        }
                        rows={4}
                        className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        placeholder="Packet note"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          Save once and keep editing only until end of day.
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={pending}
                            className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {pending ? "Saving..." : "Save Details"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                      <p className="text-sm leading-6 text-[color:var(--foreground)]">
                        Review the details first, then edit only if team, factory, date, or SD card
                        count must be corrected for this packet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        disabled={!detail.editable}
                        className="border border-[color:var(--foreground)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] disabled:opacity-60"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="border border-[color:var(--border)] bg-white/78 p-4 text-sm text-[color:var(--muted-foreground)]">
                  QR packet not found.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
