import { describe, expect, it } from "vitest";
import { evaluatePolicy, type RiskEventInput } from "@agenttrace/shared";

function ev(partial: Partial<RiskEventInput> & { seqNo: number }): RiskEventInput {
  return {
    eventType: "e",
    actionClass: "OTHER",
    toolName: null,
    targetSystem: null,
    mutatesState: false,
    irreversible: false,
    metadataJson: {},
    hasApproval: false,
    ...partial,
  };
}

describe("deterministic policy evaluation", () => {
  it("flags denied action classes as critical violations", () => {
    const flags = evaluatePolicy(
      { denyActionClasses: ["SECRET_ACCESS"], requireApprovalFor: [], forbidIrreversibleWithoutApproval: false },
      [ev({ seqNo: 0, actionClass: "READ" }), ev({ seqNo: 1, actionClass: "SECRET_ACCESS" })],
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.flagType).toBe("policy_violation");
    expect(flags[0]!.severity).toBe("CRITICAL");
    expect(flags[0]!.eventSeqNo).toBe(1);
  });

  it("flags missing approvals for required action classes", () => {
    const rules = { denyActionClasses: [], requireApprovalFor: ["EXTERNAL_CALL"], forbidIrreversibleWithoutApproval: false };
    const unapproved = evaluatePolicy(rules, [
      ev({ seqNo: 0, actionClass: "EXTERNAL_CALL", mutatesState: true, hasApproval: false }),
    ]);
    expect(unapproved).toHaveLength(1);
    expect(unapproved[0]!.title).toMatch(/approval required/i);

    const approved = evaluatePolicy(rules, [
      ev({ seqNo: 0, actionClass: "EXTERNAL_CALL", mutatesState: true, hasApproval: true }),
    ]);
    expect(approved).toHaveLength(0);
  });

  it("is deterministic - same input yields identical output", () => {
    const rules = { denyActionClasses: ["CODE_EXECUTION"], requireApprovalFor: [], forbidIrreversibleWithoutApproval: true };
    const events = [
      ev({ seqNo: 0, actionClass: "CODE_EXECUTION" }),
      ev({ seqNo: 1, irreversible: true, hasApproval: false }),
    ];
    expect(JSON.stringify(evaluatePolicy(rules, events))).toBe(
      JSON.stringify(evaluatePolicy(rules, events)),
    );
  });
});
