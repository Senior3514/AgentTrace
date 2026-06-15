import type { CreateEventInput } from "@agenttrace/shared";
import { RunStatus } from "@agenttrace/shared";
import { prisma } from "../db.js";
import { conflict, notFound, unprocessable } from "../lib/errors.js";

/**
 * Append an event to a run, enforcing the core evidence rules:
 *  - the run must exist and still be RUNNING (no appends after finalization)
 *  - sequence numbers are unique within a run
 *  - events must arrive in order: seqNo == lastSeqNo + 1
 *    (the first event may baseline at 0 or 1)
 */
export async function appendEvent(input: CreateEventInput) {
  const run = await prisma.run.findUnique({ where: { id: input.runId } });
  if (!run) throw notFound(`Run ${input.runId} not found`);
  if (run.status !== RunStatus.RUNNING) {
    throw conflict(
      `Run ${input.runId} is ${run.status}; finalized runs cannot receive new events`,
    );
  }

  const last = await prisma.event.findFirst({
    where: { runId: input.runId },
    orderBy: { seqNo: "desc" },
    select: { seqNo: true },
  });

  if (last === null) {
    if (input.seqNo !== 0 && input.seqNo !== 1) {
      throw unprocessable(
        `First event of a run must have seqNo 0 or 1, received ${input.seqNo}`,
      );
    }
  } else {
    const expected = last.seqNo + 1;
    if (input.seqNo !== expected) {
      throw unprocessable(
        `Out-of-order event: expected seqNo ${expected}, received ${input.seqNo}`,
      );
    }
  }

  try {
    return await prisma.event.create({
      data: {
        runId: input.runId,
        seqNo: input.seqNo,
        eventType: input.eventType,
        timestamp: input.timestamp ?? new Date(),
        actorType: input.actorType as never,
        actorId: input.actorId ?? null,
        toolName: input.toolName ?? null,
        targetSystem: input.targetSystem ?? null,
        actionClass: input.actionClass as never,
        mutatesState: input.mutatesState,
        irreversible: input.irreversible,
        inputHash: input.inputHash ?? null,
        outputHash: input.outputHash ?? null,
        metadataJson: input.metadataJson as never,
      },
    });
  } catch (err: unknown) {
    // Unique (runId, seqNo) violation — concurrent append of the same seqNo.
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") {
      throw conflict(`Sequence number ${input.seqNo} already exists for run ${input.runId}`);
    }
    throw err;
  }
}
