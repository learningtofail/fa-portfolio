import { render } from "@testing-library/react";
import UtmAuditor from "../../src/components/UtmAuditor.jsx";
import { statValue, uploadFile } from "./helpers.js";

describe("UtmAuditor (current behavior)", () => {
  it("reports a clean file as having no flagged rows", async () => {
    const { container } = render(<UtmAuditor />);
    await uploadFile(
      container,
      "clean.csv",
      "utm_source,utm_medium,utm_campaign\ngoogle,cpc,spring-sale\nbing,cpc,spring-sale\n",
    );
    expect(await statValue("Rows with issues")).toBe("0");
  });

  it("flags a missing required field", async () => {
    const { container } = render(<UtmAuditor />);
    await uploadFile(container, "missing.csv", "utm_source,utm_medium,utm_campaign\ngoogle,cpc,\n");
    expect(await statValue("Rows with issues")).toBe("1");
  });

  it("flags casing drift on both rows that share a value", async () => {
    const { container } = render(<UtmAuditor />);
    await uploadFile(
      container,
      "case.csv",
      "utm_source,utm_medium,utm_campaign\nGoogle,cpc,spring\ngoogle,cpc,spring\n",
    );
    expect(await statValue("Rows with issues")).toBe("2");
  });

  it("reads UTM parameters out of a url column", async () => {
    const { container } = render(<UtmAuditor />);
    await uploadFile(
      container,
      "urls.csv",
      "url\nhttps://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring\nhttps://example.com/?utm_source=google\n",
    );
    expect(await statValue("Rows with issues")).toBe("1");
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "audits a value named %s without throwing (D2)",
    async (name) => {
      const { container } = render(<UtmAuditor />);
      await uploadFile(
        container,
        "proto.csv",
        `utm_source,utm_medium,utm_campaign\n${name},cpc,spring\n${name.toUpperCase()},cpc,spring\n`,
      );
      expect(await statValue("Rows with issues")).toBe("2");
    },
  );
});
