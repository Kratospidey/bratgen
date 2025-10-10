import { describe, expect, it } from "vitest";
import { buildAutomationExpression } from "../index";

describe("buildAutomationExpression", () => {
  it("returns null when no automation points are provided", () => {
    expect(buildAutomationExpression([])).toBeNull();
  });

  it("builds a constant gain expression when only one point is provided", () => {
    const expression = buildAutomationExpression([{ at: 0, gainDb: 0 }]);
    expect(expression).toBe("if(lt(t,0.000),1.000000,1.000000)");
  });

  it("produces a piecewise linear ramp between automation points", () => {
    const expression = buildAutomationExpression([
      { at: 0, gainDb: 0 },
      { at: 1.2, gainDb: -6 },
      { at: 2.4, gainDb: 3 }
    ]);

    expect(expression).toBe(
      "if(lt(t,0.000),1.000000,if(lt(t,1.200),1.000000+(-0.415677)*(t-0.000),if(lt(t,2.400),0.501187+(0.759459)*(t-1.200),1.412538)))"
    );
  });

  it("ignores non-increasing points to avoid invalid segments", () => {
    const expression = buildAutomationExpression([
      { at: 0, gainDb: 0 },
      { at: 0, gainDb: -3 },
      { at: 1, gainDb: -6 }
    ]);

    expect(expression).toBe("if(lt(t,0.000),1.000000,if(lt(t,1.000),1.000000+(-0.498813)*(t-0.000),0.501187))");
  });

  it("filters out non-finite timestamps", () => {
    const expression = buildAutomationExpression([
      { at: Number.NaN, gainDb: 0 },
      { at: 0.5, gainDb: -3 }
    ]);

    expect(expression).toBe("if(lt(t,0.500),0.707946,0.707946)");
  });
});
