import { beforeEach, describe, expect, it, vi } from "vitest";

const extractTextMock = vi.fn();
const getDocumentProxyMock = vi.fn(async (data: Uint8Array) => data);
const extractRawTextMock = vi.fn();

vi.mock("unpdf", () => ({
  getDocumentProxy: (data: Uint8Array) => getDocumentProxyMock(data),
  extractText: () => extractTextMock(),
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: () => extractRawTextMock() },
}));

const { extractDocumentText, normalizeText } = await import(
  "@/lib/rag/extraction"
);
const { ExtractionError } = await import("@/lib/errors");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeText", () => {
  it("collapses whitespace and blank-line runs while keeping paragraphs", () => {
    expect(normalizeText("a  \t b\r\n\n\n\nc   ")).toBe("a b\n\nc");
  });
});

describe("extractDocumentText", () => {
  it("extracts and normalises PDF text via unpdf", async () => {
    extractTextMock.mockResolvedValue({ text: "  Hello   world \n\n\n from PDF " });
    const result = await extractDocumentText("pdf", Buffer.from("pdf-bytes"));
    expect(result).toBe("Hello world\n\nfrom PDF");
    expect(extractTextMock).toHaveBeenCalledOnce();
    expect(extractRawTextMock).not.toHaveBeenCalled();
  });

  it("extracts and normalises DOCX text via mammoth", async () => {
    extractRawTextMock.mockResolvedValue({ value: "Docx   text\r\nline" });
    const result = await extractDocumentText("docx", Buffer.from("docx-bytes"));
    expect(result).toBe("Docx text\nline");
    expect(extractRawTextMock).toHaveBeenCalledOnce();
    expect(extractTextMock).not.toHaveBeenCalled();
  });

  it("throws ExtractionError when no text can be extracted", async () => {
    extractTextMock.mockResolvedValue({ text: "   \n  " });
    await expect(
      extractDocumentText("pdf", Buffer.from("empty")),
    ).rejects.toBeInstanceOf(ExtractionError);
  });

  it("wraps parser failures in ExtractionError", async () => {
    extractRawTextMock.mockRejectedValue(new Error("corrupt zip"));
    await expect(
      extractDocumentText("docx", Buffer.from("corrupt")),
    ).rejects.toBeInstanceOf(ExtractionError);
  });
});
