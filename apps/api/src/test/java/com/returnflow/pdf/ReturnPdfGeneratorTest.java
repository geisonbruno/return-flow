package com.returnflow.pdf;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.pdfparser.PDFStreamParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Layout and content behavior of the generated document, asserted by parsing
 * the real PDF back with PDFBox — never by comparing bytes, which would break
 * on any harmless layout change.
 */
class ReturnPdfGeneratorTest {

	private final ReturnPdfGenerator generator = new ReturnPdfGenerator("Australia/Sydney");

	@Test
	void producesAValidSingleSectionPdf() throws IOException {
		byte[] bytes = generator.generate(document());

		assertThat(bytes).startsWith("%PDF".getBytes(StandardCharsets.US_ASCII));
		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			assertThat(pdf.getNumberOfPages()).isEqualTo(1);
		}
	}

	@Test
	void rendersEveryTrustedReturnFieldAsText() throws IOException {
		String text = extractText(generator.generate(document()));

		assertThat(text).contains("ReturnFlow");
		assertThat(text).contains("Return Record");
		assertThat(text).contains("RF-000123");
		assertThat(text).contains("CLOSED");
		assertThat(text).contains("Acme Pty Ltd");
		assertThat(text).contains("Blue Widget 500ml");
		assertThat(text).contains("3 CTN");
		assertThat(text).contains("Damaged");
		assertThat(text).contains("Crushed in transit");
		assertThat(text).contains("Driver One");
		assertThat(text).contains("R1");
		assertThat(text).contains("Route One");
	}

	@Test
	void rendersWarehouseDecisionsAsYesOrNo() throws IOException {
		String text = extractText(generator.generate(document()));

		assertThat(text).contains("Sellable");
		assertThat(text).contains("Credit customer");
		assertThat(text).contains("Charge customer");
		assertThat(text).contains("Charge driver");
		assertThat(text).contains("Yes");
		assertThat(text).contains("No");
		assertThat(text).contains("Warehouse Rep");
		assertThat(text).contains("Admin One");
		assertThat(text).contains("Jane Doe");
	}

	@Test
	void rendersLifecycleTimestampsInTheConfiguredBusinessZone() throws IOException {
		String text = extractText(generator.generate(document()));

		// 2026-08-16T00:30:00Z is 10:30 the same morning in Sydney (AEST, +10).
		assertThat(text).contains("16 Aug 2026");
		assertThat(text).contains("10:30 AM AEST");
		assertThat(text).contains("Created at");
		assertThat(text).contains("Closed at");
		assertThat(text).contains("Review started at");
	}

	@Test
	void neverEmbedsAnImageBecausePhotosAreExcluded() throws IOException {
		try (PDDocument pdf = Loader.loadPDF(generator.generate(document()))) {
			for (PDPage page : pdf.getPages()) {
				assertThat(page.getResources().getXObjectNames()).isEmpty();
			}
		}
		assertThat(extractText(generator.generate(document()))).doesNotContainIgnoringCase("photo");
	}

	@Test
	void drawsBothSignaturesAsVectorStrokes() throws IOException {
		byte[] withSignatures = generator.generate(document());
		byte[] withoutSignatures = generator.generate(documentWithoutSignatures());

		assertThat(extractText(withSignatures)).contains("Customer signature").contains("Warehouse signature");
		assertThat(extractText(withSignatures)).doesNotContain("Not captured.");
		// Two signatures of two strokes each add real line geometry; the
		// signature-less document draws only its section rules.
		assertThat(countLineOperators(withSignatures)).isGreaterThan(countLineOperators(withoutSignatures));
	}

	@Test
	void statesWhenASignatureIsMissingInsteadOfDrawingAnEmptyBox() throws IOException {
		String text = extractText(generator.generate(documentWithoutSignatures()));

		assertThat(text).contains("Customer signature");
		assertThat(text).contains("Warehouse signature");
		assertThat(text).contains("Not captured.");
	}

	@Test
	void wrapsLongFreeTextAcrossMultiplePagesWithoutFailing() throws IOException {
		ReturnPdfDocument longDocument = new ReturnPdfDocument(
				"RF-000123", "CLOSED", "A".repeat(200), "B".repeat(200), 12, "EA",
				"Other", "C".repeat(500), "D".repeat(2000), "Driver One", "R1", "Route One",
				Instant.parse("2026-08-16T00:30:00Z"), Instant.parse("2026-08-16T01:00:00Z"),
				Instant.parse("2026-08-16T02:00:00Z"),
				true, false, false, true, "E".repeat(2000), "Warehouse Rep", "Admin One", "Admin One",
				"Jane Doe", Instant.parse("2026-08-16T00:45:00Z"), signatureSvg(), signatureSvg());

		byte[] bytes = generator.generate(longDocument);

		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
			// Every page must carry the footer, proving pagination ran through
			// the same cursor rather than spilling past the bottom margin.
			for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
				PDFTextStripper stripper = new PDFTextStripper();
				stripper.setStartPage(page);
				stripper.setEndPage(page);
				assertThat(stripper.getText(pdf)).contains("Page " + page);
			}
		}
	}

	@Test
	void survivesCharactersTheStandardPdfFontsCannotRepresent() throws IOException {
		ReturnPdfDocument unusual = new ReturnPdfDocument(
				"RF-000123", "CLOSED", "客户名称 😀", "Café “Naïve” — 200ml", 1, "EA",
				"Other", "Details… with ellipsis", "Line one\nLine two", "Drivér Öne", "R1", "Route One",
				Instant.parse("2026-08-16T00:30:00Z"), null, Instant.parse("2026-08-16T02:00:00Z"),
				true, false, false, true, null, "Warehouse Rep", "Admin One", "Admin One",
				"Jane Doe", null, signatureSvg(), signatureSvg());

		assertThatCode(() -> generator.generate(unusual)).doesNotThrowAnyException();

		String text = extractText(generator.generate(unusual));
		// The smart punctuation is transliterated rather than lost entirely.
		assertThat(text).contains("Naïve");
		assertThat(text).contains("200ml");
		assertThat(text).contains("Line one");
		assertThat(text).contains("Line two");
	}

	@Test
	void setsSafeDocumentMetadata() throws IOException {
		try (PDDocument pdf = Loader.loadPDF(generator.generate(document()))) {
			assertThat(pdf.getDocumentInformation().getTitle()).contains("RF-000123");
			assertThat(pdf.getDocumentInformation().getSubject()).isEqualTo("Return Record");
			assertThat(pdf.getDocumentInformation().getAuthor()).isEqualTo("ReturnFlow");
			assertThat(pdf.getDocumentInformation().getCreator()).isEqualTo("ReturnFlow");
		}
	}

	private static ReturnPdfDocument document() {
		return new ReturnPdfDocument(
				"RF-000123", "CLOSED", "Acme Pty Ltd", "Blue Widget 500ml", 3, "CTN",
				"Damaged", null, "Crushed in transit", "Driver One", "R1", "Route One",
				Instant.parse("2026-08-16T00:30:00Z"), Instant.parse("2026-08-16T01:00:00Z"),
				Instant.parse("2026-08-16T02:00:00Z"),
				true, false, false, true, "Repacked", "Warehouse Rep", "Admin One", "Admin One",
				"Jane Doe", Instant.parse("2026-08-16T00:45:00Z"), signatureSvg(), signatureSvg());
	}

	private static ReturnPdfDocument documentWithoutSignatures() {
		return new ReturnPdfDocument(
				"RF-000123", "CLOSED", "Acme Pty Ltd", "Blue Widget 500ml", 3, "CTN",
				"Damaged", null, "Crushed in transit", "Driver One", "R1", "Route One",
				Instant.parse("2026-08-16T00:30:00Z"), Instant.parse("2026-08-16T01:00:00Z"),
				Instant.parse("2026-08-16T02:00:00Z"),
				true, false, false, true, "Repacked", "Warehouse Rep", "Admin One", "Admin One",
				"Jane Doe", Instant.parse("2026-08-16T00:45:00Z"), null, null);
	}

	/** Mirrors {@code returnrecord.SvgSignatureRenderer}'s output shape exactly. */
	private static byte[] signatureSvg() {
		String content = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
				+ "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1000 300\" width=\"1000\" height=\"300\">"
				+ "<rect x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" fill=\"white\"/>"
				+ "<path d=\"M 100.00 150.00 L 200.00 120.00 L 350.00 165.00\" fill=\"none\" stroke=\"black\"/>"
				+ "<path d=\"M 400.00 100.00 L 500.00 200.00\" fill=\"none\" stroke=\"black\"/>"
				+ "</svg>";
		return content.getBytes(StandardCharsets.UTF_8);
	}

	private static String extractText(byte[] bytes) throws IOException {
		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			return new PDFTextStripper().getText(pdf);
		}
	}

	/** Counts {@code l} (lineTo) operators across every page — structural proof that vector strokes were drawn. */
	private static int countLineOperators(byte[] bytes) throws IOException {
		int lineOperators = 0;
		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			for (PDPage page : pdf.getPages()) {
				PDFStreamParser parser = new PDFStreamParser(page);
				for (Object token = parser.parseNextToken(); token != null; token = parser.parseNextToken()) {
					if (token instanceof Operator operator && "l".equals(operator.getName())) {
						lineOperators++;
					} else if (!(token instanceof COSBase) && !(token instanceof Operator)) {
						break;
					}
				}
			}
		}
		return lineOperators;
	}
}
